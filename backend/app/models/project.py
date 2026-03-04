from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Dict, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel


class ProjectStatus(str, Enum):
     uploaded = "uploaded"
     waiting_layers = "waiting_layers"
     processing = "processing"
     completed = "completed"
     failed = "failed"


class Discipline(str, Enum):
     electrical = "electrical"
     plumbing = "plumbing"
     networking = "networking"
     fire = "fire"
     hvac = "hvac"
     generic = "generic"


if TYPE_CHECKING:
    from app.models.user import User


class Project(SQLModel, table=True):
     __tablename__ = "projects"

     id: Optional[int] = Field(default=None, primary_key=True)
     user_id: int = Field(foreign_key="users.id")
     name: str
     original_filename: str
     status: ProjectStatus = Field(default=ProjectStatus.uploaded)
     file_path: str
     dxf_path: Optional[str] = None
     layer_map: Dict[str, str] | None = Field(
         default=None, sa_column=Column(JSON, nullable=True)
     )
    result_summary: Dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
     created_at: datetime = Field(default_factory=datetime.utcnow)
     updated_at: datetime = Field(default_factory=datetime.utcnow)

    owner: "User" = Relationship(back_populates="projects")
    takeoffs: list["Takeoff"] = Relationship(back_populates="project")


 class Takeoff(SQLModel, table=True):
     __tablename__ = "takeoffs"

     id: Optional[int] = Field(default=None, primary_key=True)
     project_id: int = Field(foreign_key="projects.id")
     discipline: Discipline = Field(default=Discipline.generic)
     status: ProjectStatus = Field(default=ProjectStatus.processing)
     result_json: Dict | None = Field(default=None, sa_column=Column(JSON))
     processed_at: datetime | None = None

     project: Project = Relationship(back_populates="takeoffs")
     items: list["TakeoffItem"] = Relationship(back_populates="takeoff")


 class TakeoffItem(SQLModel, table=True):
     __tablename__ = "takeoff_items"

     id: Optional[int] = Field(default=None, primary_key=True)
     takeoff_id: int = Field(foreign_key="takeoffs.id")
    discipline: str | None = None
    category: str
     description: str
     unit: str
     quantity: float
     layer: str | None = None
     block_name: str | None = None

     takeoff: Takeoff = Relationship(back_populates="items")


