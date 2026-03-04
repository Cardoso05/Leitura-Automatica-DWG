from pydantic import BaseModel

from app.models.project import Discipline


class BlockMappingBase(BaseModel):
    block_name_pattern: str
    material_description: str
    unit: str = "un"
    discipline: Discipline = Discipline.generic
    is_material: bool = True
    use_regex: bool = False
    category: str | None = None


class BlockMappingCreate(BlockMappingBase):
    pass


class BlockMappingUpdate(BaseModel):
    block_name_pattern: str | None = None
    material_description: str | None = None
    unit: str | None = None
    discipline: Discipline | None = None
    is_material: bool | None = None
    category: str | None = None


class BlockMappingRead(BlockMappingBase):
    id: int
    is_default: bool
    user_id: int | None = None

    class Config:
        from_attributes = True


class UnmappedBlock(BaseModel):
    block_name: str
    resolved_name: str | None
    layer: str
    quantity: int
    suggested_description: str | None = None
