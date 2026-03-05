from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete, select

from app.api import deps
from app.db.session import async_session_factory, get_session
from app.models.project import Discipline, Project, ProjectStatus, Takeoff, TakeoffItem
from app.models.user import User
from app.schemas.project import (
    LayerInfo,
    ProcessRequest,
    ProjectRead,
    TakeoffItemRead,
    TakeoffResult,
)
from app.services.dxf_parser import DXFParser
from app.services.excel_exporter import build_excel
from app.services.takeoff_engine import TakeoffEngine
from app.services.usage_limits import can_process_project, register_project_processed

router = APIRouter(prefix="/projects", tags=["Projects"])


async def _get_project_or_404(
    project_id: int,
    session: AsyncSession,
    current_user: User,
) -> Project:
    stmt = select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return project


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    stmt = select(Project).where(Project.user_id == current_user.id).order_by(Project.created_at.desc())
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project = await _get_project_or_404(project_id, session, current_user)
    return project


@router.get("/{project_id}/layers", response_model=list[LayerInfo])
async def list_layers(
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project = await _get_project_or_404(project_id, session, current_user)
    if not project.dxf_path:
        raise HTTPException(status_code=400, detail="Projeto sem DXF disponível.")
    parser = DXFParser()
    summaries = parser.list_layers(project.dxf_path)
    return [
        LayerInfo(
            name=summary.name,
            entity_count=summary.entity_count,
            suggested_discipline=summary.suggested_discipline,
        )
        for summary in summaries
    ]


async def _run_takeoff_in_background(
    project_id: int,
    user_id: int,
    layer_map: dict[str, Discipline],
    scale_ratio: float | None,
) -> None:
    """Roda o takeoff em background com sessão própria."""
    async with async_session_factory() as session:
        try:
            project = await session.get(Project, project_id)
            if not project:
                return

            engine = TakeoffEngine()
            takeoff = await engine.process(
                project=project,
                session=session,
                layer_map=layer_map,
                scale_ratio=scale_ratio,
            )

            user = await session.get(User, user_id)
            if user:
                register_project_processed(user)
                session.add(user)
            await session.commit()
            logger.info("Background takeoff finished for project %s", project_id)
        except Exception as exc:
            logger.error("Background takeoff failed for project %s: %s", project_id, exc)
            project = await session.get(Project, project_id)
            if project:
                project.status = ProjectStatus.failed
                session.add(project)
                await session.commit()


@router.post("/{project_id}/process", response_model=TakeoffResult)
async def process_project(
    project_id: int,
    payload: ProcessRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project = await _get_project_or_404(project_id, session, current_user)

    existing_stmt = select(Takeoff).where(Takeoff.project_id == project.id).order_by(Takeoff.id.desc())
    existing_result = await session.execute(existing_stmt)
    existing_takeoffs = existing_result.scalars().all()

    if project.status == ProjectStatus.processing and existing_takeoffs:
        raise HTTPException(status_code=409, detail="Projeto já está sendo processado")

    if project.status == ProjectStatus.processing and not existing_takeoffs:
        project.status = ProjectStatus.uploaded

    if not can_process_project(current_user):
        raise HTTPException(status_code=402, detail="Limite do plano Free atingido")

    for old_takeoff in existing_takeoffs:
        await session.execute(delete(TakeoffItem).where(TakeoffItem.takeoff_id == old_takeoff.id))
        await session.execute(delete(Takeoff).where(Takeoff.id == old_takeoff.id))

    project.status = ProjectStatus.processing
    project.layer_map = {layer: discipline.value for layer, discipline in payload.layer_map.items()}
    session.add(project)
    await session.commit()
    await session.refresh(project)

    background_tasks.add_task(
        _run_takeoff_in_background,
        project_id=project.id,
        user_id=current_user.id,
        layer_map=payload.layer_map,
        scale_ratio=payload.scale_ratio,
    )

    return TakeoffResult(
        project_id=project.id,
        summary={},
        items=[],
        metadata={"status": "processing"},
    )


@router.get("/{project_id}/result", response_model=TakeoffResult)
async def project_result(
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project = await _get_project_or_404(project_id, session, current_user)
    stmt = select(Takeoff).where(Takeoff.project_id == project.id).order_by(Takeoff.id.desc())
    result = await session.execute(stmt)
    takeoff = result.scalars().first()
    if not takeoff:
        raise HTTPException(status_code=404, detail="Projeto ainda não processado")
    items_stmt = select(TakeoffItem).where(TakeoffItem.takeoff_id == takeoff.id)
    items_result = await session.execute(items_stmt)
    items = items_result.scalars().all()
    return TakeoffResult(
        project_id=project.id,
        summary=takeoff.result_json.get("summary", {}),
        items=[
            TakeoffItemRead(
                discipline=item.discipline,
                category=item.category,
                description=item.description,
                unit=item.unit,
                quantity=item.quantity,
                layer=item.layer,
                block_name=item.block_name,
            )
            for item in items
        ],
        metadata=takeoff.result_json.get("metadata", {}),
    )


@router.get("/{project_id}/export")
async def export_project(
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    project = await _get_project_or_404(project_id, session, current_user)
    stmt = select(Takeoff).where(Takeoff.project_id == project.id).order_by(Takeoff.id.desc())
    result = await session.execute(stmt)
    takeoff = result.scalars().first()
    if not takeoff:
        raise HTTPException(status_code=404, detail="Projeto ainda não processado")

    items_stmt = select(TakeoffItem).where(TakeoffItem.takeoff_id == takeoff.id)
    items_result = await session.execute(items_stmt)
    db_items = items_result.scalars().all()
    items = [
        {
            "discipline": item.discipline,
            "category": item.category,
            "description": item.description,
            "unit": item.unit,
            "quantity": item.quantity,
            "layer": item.layer,
            "block_name": item.block_name,
        }
        for item in db_items
    ]
    content = build_excel(
        items,
        takeoff.result_json.get("summary", {}),
        takeoff.result_json.get("metadata", {}),
    )
    filename = f"takeoff-{project.id}.xlsx"
    response = StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response
