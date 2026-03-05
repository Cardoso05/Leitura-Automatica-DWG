from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel


class PlanType(str, Enum):
    free = "free"
    pro = "pro"
    business = "business"


if TYPE_CHECKING:
    from app.models.project import Project


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: str | None = None
    company: str | None = None
    plan: PlanType = Field(default=PlanType.free)
    is_active: bool = Field(default=True)
    is_superuser: bool = Field(default=False)
    asaas_customer_id: str | None = None
    projects_this_month: int = Field(default=0)
    projects_cycle_start: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    projects: list["Project"] = Relationship(back_populates="owner")
