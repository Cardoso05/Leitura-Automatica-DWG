from pydantic import BaseModel

from app.models.payment import CheckoutType


class CheckoutRequest(BaseModel):
    checkout_type: CheckoutType
    project_id: int | None = None


class CheckoutResponse(BaseModel):
    payment_id: str
    invoice_url: str | None = None
    status: str
