from fastapi import APIRouter, Depends, HTTPException, Request, status
 from sqlalchemy.ext.asyncio import AsyncSession

 from app.api import deps
 from app.core.config import get_settings
 from app.db.session import get_session
 from app.models.user import User
 from app.schemas.billing import CheckoutRequest, CheckoutResponse, CheckoutType
 from app.services.asaas_client import AsaasClient

 router = APIRouter(prefix="/billing", tags=["Billing"])

 PLAN_PRICING = {
     CheckoutType.pay_per_use: 19.9,
     CheckoutType.pro: 97.0,
     CheckoutType.business: 247.0,
 }


 @router.post("/checkout", response_model=CheckoutResponse)
 async def generate_checkout(
     payload: CheckoutRequest,
     current_user: User = Depends(deps.get_current_user),
     session: AsyncSession = Depends(get_session),
 ):
     settings = get_settings()
     if not settings.asaas_api_key:
         raise HTTPException(
             status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
             detail="ASAAS não configurado",
         )
     client = AsaasClient()

     if not current_user.asaas_customer_id:
         customer = await client.create_customer(
             name=current_user.full_name or current_user.email.split("@")[0],
             email=current_user.email,
         )
         current_user.asaas_customer_id = customer["id"]
         session.add(current_user)
         await session.commit()
         await session.refresh(current_user)

     payment = await client.create_payment(
         customer_id=current_user.asaas_customer_id,
         value=PLAN_PRICING[payload.checkout_type],
         description=f"TAKEOFF.AI - {payload.checkout_type.value}",
         billing_type="PIX",
     )
     return CheckoutResponse(
         payment_id=payment["id"],
         invoice_url=payment.get("invoiceUrl") or payment.get("bankSlipUrl"),
         status=payment.get("status"),
     )


@router.post("/webhook")
async def asaas_webhook(request: Request):
    settings = get_settings()
    payload = await request.json()
    signature = request.headers.get("asaas-signature")
    if settings.asaas_webhook_secret and signature != settings.asaas_webhook_secret:
        raise HTTPException(status_code=401, detail="Assinatura inválida")
    # Em um cenário real, atualizaríamos o status do pagamento / plano
    return {"received": True, "event": payload.get("event")}
