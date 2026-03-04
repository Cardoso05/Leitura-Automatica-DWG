from typing import Optional

from sqlmodel import Field, SQLModel

from app.models.project import Discipline


class BlockMapping(SQLModel, table=True):
    __tablename__ = "block_mappings"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int | None = Field(default=None, foreign_key="users.id")
    block_name_pattern: str
    material_description: str
    discipline: Discipline = Field(default=Discipline.generic)
    unit: str = Field(default="un")
    is_default: bool = Field(default=False)
    is_material: bool = Field(default=True)
    use_regex: bool = Field(default=False)
    category: str | None = Field(default=None)
