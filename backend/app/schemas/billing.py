 from enum import Enum

 from pydantic import BaseModel


 class CheckoutType(str, Enum):
     pay_per_use = "pay_per_use"
     pro = "pro"
     business = "business"


 class CheckoutRequest(BaseModel):
     checkout_type: CheckoutType
     project_id: int | None = None


 class CheckoutResponse(BaseModel):
     payment_id: str
     invoice_url: str | None = None
     status: str
