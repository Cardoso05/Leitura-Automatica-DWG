from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.config import get_settings
from app.db.session import get_session
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.services.dwg_converter import DWGConverter
from app.services.storage import StorageService

router = APIRouter(tags=["Upload"])

_ALLOWED_CONTENT_TYPES = {
    "application/acad",
    "application/dwg",
    "application/dxf",
    "application/octet-stream",
}


async def _process_single_upload(
    file: UploadFile,
    current_user: User,
    session: AsyncSession,
) -> dict:
    """Valida, salva e cria um Project para um único arquivo."""
    settings = get_settings()

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400, detail=f"Formato não suportado: {file.filename}"
        )

    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo ausente.")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ("dwg", "dxf"):
        raise HTTPException(
            status_code=400,
            detail=f"Extensão não suportada em {file.filename}. Envie .dwg ou .dxf.",
        )

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{file.filename} excede o limite de {settings.max_upload_size_mb}MB.",
        )
    await file.seek(0)

    storage = StorageService()
    stored_path = await storage.save_upload(file)
    dxf_path = stored_path

    if file.filename.lower().endswith(".dwg"):
        converter = DWGConverter()
        if not converter.available:
            raise HTTPException(
                status_code=400,
                detail="Conversão de DWG não disponível. Exporte como DXF.",
            )
        dxf_path = await converter.convert_to_dxf(stored_path)

    project = Project(
        user_id=current_user.id,
        name=file.filename.rsplit(".", 1)[0],
        original_filename=file.filename,
        file_path=stored_path,
        dxf_path=dxf_path,
        status=ProjectStatus.waiting_layers,
    )
    session.add(project)
    await session.flush()

    return {"project_id": project.id, "filename": file.filename, "status": project.status}


@router.post("/upload", status_code=201)
async def upload_project(
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upload de um único arquivo DWG/DXF."""
    result = await _process_single_upload(file, current_user, session)
    await session.commit()
    return result


@router.post("/upload/batch", status_code=201)
async def upload_batch(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upload de múltiplos arquivos DWG/DXF de uma vez."""
    if not files:
        raise HTTPException(status_code=400, detail="Nenhum arquivo enviado.")

    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Máximo de 20 arquivos por vez.")

    results = []
    errors = []

    for file in files:
        try:
            result = await _process_single_upload(file, current_user, session)
            results.append(result)
        except HTTPException as exc:
            errors.append({"filename": file.filename or "unknown", "error": exc.detail})
        except Exception as exc:
            logger.error("Erro ao processar %s: %s", file.filename, exc)
            errors.append({"filename": file.filename or "unknown", "error": str(exc)})

    if results:
        await session.commit()

    if not results and errors:
        raise HTTPException(status_code=400, detail=errors)

    return {
        "uploaded": results,
        "errors": errors,
        "total_success": len(results),
        "total_errors": len(errors),
    }
