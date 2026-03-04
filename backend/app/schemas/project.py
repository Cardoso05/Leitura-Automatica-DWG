 from datetime import datetime
 from typing import Dict, List, Optional

 from pydantic import BaseModel

 from app.models.project import Discipline, ProjectStatus


 class ProjectBase(BaseModel):
     name: str


 class ProjectRead(ProjectBase):
     id: int
     original_filename: str
     status: ProjectStatus
     created_at: datetime
     updated_at: datetime
    result_summary: Dict | None = None

     class Config:
         from_attributes = True


 class LayerInfo(BaseModel):
     name: str
     entity_count: int
     suggested_discipline: Discipline | None = None


 class ProcessRequest(BaseModel):
     layer_map: Dict[str, Discipline]
     scale_ratio: float | None = None


 class TakeoffItemRead(BaseModel):
    discipline: Optional[str] = None
     category: str
     description: str
     unit: str
     quantity: float
     layer: Optional[str] = None
     block_name: Optional[str] = None


 class TakeoffResult(BaseModel):
     project_id: int
     summary: Dict[str, float]
     items: List[TakeoffItemRead]
     metadata: Dict[str, str | int | float]
