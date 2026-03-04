 from pydantic import BaseModel

 from app.models.project import Discipline


 class BlockMappingBase(BaseModel):
     block_name_pattern: str
     material_description: str
     unit: str = "un"
     discipline: Discipline = Discipline.generic


 class BlockMappingCreate(BlockMappingBase):
     is_default: bool = False


 class BlockMappingRead(BlockMappingBase):
     id: int
     is_default: bool

     class Config:
         from_attributes = True
