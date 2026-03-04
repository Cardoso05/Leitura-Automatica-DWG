from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class CheckoutType(str, Enum):
    pay_per_use = "pay_per_use"
    pro = "pro"
    business = "business"


class PaymentStatus(str, Enum):
    pending = "PENDING"
    confirmed = "CONFIRMED"
    received = "RECEIVED"
    overdue = "OVERDUE"
    canceled = "CANCELED"
    refunded = "REFUNDED"
    chargeback = "CHARGEBACK"


class Payment(SQLModel, table=True):
    __tablename__ = "payments"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    project_id: int | None = Field(default=None, foreign_key="projects.id")
    checkout_type: CheckoutType
    asaas_payment_id: str = Field(index=True, unique=True)
    value: float
    status: PaymentStatus = Field(default=PaymentStatus.pending)
    raw_response: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
