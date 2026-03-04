 from fastapi import APIRouter, Depends, HTTPException, status
 from sqlalchemy.ext.asyncio import AsyncSession
 from sqlmodel import delete, select

 from app.api import deps
 from app.db.session import get_session
 from app.models.block_mapping import BlockMapping
 from app.models.user import User
 from app.schemas.block_mapping import BlockMappingCreate, BlockMappingRead

 router = APIRouter(prefix="/block-mappings", tags=["BlockMappings"])


 @router.get("", response_model=list[BlockMappingRead])
 async def list_mappings(
     current_user: User = Depends(deps.get_current_user),
     session: AsyncSession = Depends(get_session),
 ):
     stmt = select(BlockMapping).where(
         (BlockMapping.user_id == current_user.id) | (BlockMapping.user_id.is_(None))
     )
     result = await session.execute(stmt)
     return result.scalars().all()


 @router.post("", response_model=BlockMappingRead, status_code=201)
 async def create_mapping(
     payload: BlockMappingCreate,
     current_user: User = Depends(deps.get_current_user),
     session: AsyncSession = Depends(get_session),
 ):
     mapping = BlockMapping(
         block_name_pattern=payload.block_name_pattern,
         material_description=payload.material_description,
         unit=payload.unit,
         discipline=payload.discipline,
         user_id=None if payload.is_default else current_user.id,
         is_default=payload.is_default,
     )
     session.add(mapping)
     await session.commit()
     await session.refresh(mapping)
     return mapping


 @router.delete("/{mapping_id}", status_code=204)
 async def delete_mapping(
     mapping_id: int,
     current_user: User = Depends(deps.get_current_user),
     session: AsyncSession = Depends(get_session),
 ):
     stmt = select(BlockMapping).where(BlockMapping.id == mapping_id)
     result = await session.execute(stmt)
     mapping = result.scalar_one_or_none()
     if not mapping:
         raise HTTPException(status_code=404, detail="Mapeamento não encontrado")
     if mapping.user_id and mapping.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Sem permissão para remover")
     await session.execute(delete(BlockMapping).where(BlockMapping.id == mapping_id))
     await session.commit()
     return None
