from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete, select

from app.api import deps
from app.db.session import get_session
from app.models.block_mapping import BlockMapping
from app.models.project import Project, TakeoffItem
from app.models.user import User
from app.schemas.block_mapping import (
    BlockMappingCreate,
    BlockMappingRead,
    BlockMappingUpdate,
    UnmappedBlock,
)

router = APIRouter(prefix="/block-mappings", tags=["BlockMappings"])


@router.get("", response_model=list[BlockMappingRead])
async def list_mappings(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Lista todos os mapeamentos de blocos do usuário e globais."""
    stmt = select(BlockMapping).where(
        (BlockMapping.user_id == current_user.id) | (BlockMapping.user_id.is_(None))
    ).order_by(BlockMapping.is_default.desc(), BlockMapping.block_name_pattern)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=BlockMappingRead, status_code=201)
async def create_mapping(
    payload: BlockMappingCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Cria um novo mapeamento de bloco para o usuário."""
    mapping = BlockMapping(
        block_name_pattern=payload.block_name_pattern,
        material_description=payload.material_description,
        unit=payload.unit,
        discipline=payload.discipline,
        is_material=payload.is_material,
        use_regex=payload.use_regex,
        category=payload.category,
        user_id=current_user.id,
        is_default=False,
    )
    session.add(mapping)
    await session.commit()
    await session.refresh(mapping)
    return mapping


@router.put("/{mapping_id}", response_model=BlockMappingRead)
async def update_mapping(
    mapping_id: int,
    payload: BlockMappingUpdate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Atualiza um mapeamento de bloco existente."""
    stmt = select(BlockMapping).where(BlockMapping.id == mapping_id)
    result = await session.execute(stmt)
    mapping = result.scalar_one_or_none()
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapeamento não encontrado")
    if mapping.user_id is None:
        raise HTTPException(
            status_code=403,
            detail="Mapeamentos globais não podem ser editados",
        )
    if mapping.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão para editar")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mapping, field, value)
    
    await session.commit()
    await session.refresh(mapping)
    return mapping


@router.delete("/{mapping_id}", status_code=204)
async def delete_mapping(
    mapping_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Remove um mapeamento de bloco do usuário."""
    stmt = select(BlockMapping).where(BlockMapping.id == mapping_id)
    result = await session.execute(stmt)
    mapping = result.scalar_one_or_none()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapeamento não encontrado")
    if mapping.user_id is None:
        raise HTTPException(
            status_code=403,
            detail="Mapeamentos globais não podem ser removidos por contas padrão",
        )
    if mapping.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão para remover")
    await session.execute(delete(BlockMapping).where(BlockMapping.id == mapping_id))
    await session.commit()
    return None


@router.get("/unmapped/{project_id}", response_model=list[UnmappedBlock])
async def list_unmapped_blocks(
    project_id: int,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Lista blocos de um projeto que não possuem mapeamento."""
    project_stmt = select(Project).where(
        Project.id == project_id,
        Project.user_id == current_user.id
    )
    project_result = await session.execute(project_stmt)
    project = project_result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    
    mapping_stmt = select(BlockMapping).where(
        (BlockMapping.user_id == current_user.id) | (BlockMapping.user_id.is_(None))
    )
    mapping_result = await session.execute(mapping_stmt)
    mappings = mapping_result.scalars().all()
    mapped_patterns = {m.block_name_pattern.lower() for m in mappings}
    
    items_stmt = select(TakeoffItem).join(
        TakeoffItem.takeoff
    ).where(
        TakeoffItem.takeoff.has(project_id=project_id),
        TakeoffItem.category == "block"
    )
    items_result = await session.execute(items_stmt)
    items = items_result.scalars().all()
    
    unmapped = []
    seen_blocks = set()
    
    for item in items:
        block_name = item.block_name or item.description
        if not block_name or block_name.lower() in seen_blocks:
            continue
        
        is_mapped = any(
            pattern in block_name.lower() or block_name.lower() in pattern
            for pattern in mapped_patterns
        )
        
        if not is_mapped:
            seen_blocks.add(block_name.lower())
            unmapped.append(UnmappedBlock(
                block_name=block_name,
                resolved_name=None,
                layer=item.layer or "",
                quantity=int(item.quantity),
            ))
    
    unmapped.sort(key=lambda x: -x.quantity)
    return unmapped[:50]
