import hashlib
import hmac
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api import deps
from app.core.config import get_settings
from app.db.session import get_session
from app.models.payment import CheckoutType, Payment, PaymentStatus
from app.models.user import PlanType, User
from app.schemas.billing import CheckoutRequest, CheckoutResponse
from app.services.asaas_client import AsaasClient

router = APIRouter(prefix="/billing", tags=["Billing"])

PLAN_PRICING = {
    CheckoutType.pay_per_use: 19.9,
    CheckoutType.pro: 97.0,
    CheckoutType.business: 247.0,
}

SUCCESSFUL_STATUSES = {PaymentStatus.confirmed, PaymentStatus.received}
STATUS_ALIASES = {"CANCELLED": "CANCELED"}


def _map_payment_status(status: str | None) -> PaymentStatus:
    if not status:
        return PaymentStatus.pending
    normalized = STATUS_ALIASES.get(status.upper(), status.upper())
    try:
        return PaymentStatus(normalized)
    except ValueError:
        return PaymentStatus.pending


def _extract_payment_id(payload: dict) -> str | None:
    if isinstance(payload.get("payment"), dict):
        return payload["payment"].get("id")
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("payment"), dict):
        return data["payment"].get("id")
    return payload.get("paymentId")


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
    payment_record = Payment(
        user_id=current_user.id,
        project_id=payload.project_id,
        checkout_type=payload.checkout_type,
        asaas_payment_id=payment["id"],
        value=PLAN_PRICING[payload.checkout_type],
        status=_map_payment_status(payment.get("status")),
        raw_response=payment,
    )
    session.add(payment_record)
    await session.commit()
    return CheckoutResponse(
        payment_id=payment["id"],
        invoice_url=payment.get("invoiceUrl") or payment.get("bankSlipUrl"),
        status=payment.get("status"),
    )


@router.post("/webhook")
async def asaas_webhook(request: Request, session: AsyncSession = Depends(get_session)):
    settings = get_settings()
    if not settings.asaas_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook ASAAS não configurado",
        )

    signature = request.headers.get("asaas-signature")
    if not signature:
        raise HTTPException(status_code=401, detail="Assinatura ausente")

    raw_body = await request.body()
    expected_signature = hmac.new(
        settings.asaas_webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected_signature, signature):
        raise HTTPException(status_code=401, detail="Assinatura inválida")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Payload inválido")

    payment_id = _extract_payment_id(payload)
    if not payment_id:
        raise HTTPException(status_code=400, detail="paymentId ausente no webhook")

    stmt = select(Payment).where(Payment.asaas_payment_id == payment_id)
    result = await session.execute(stmt)
    payment_record = result.scalar_one_or_none()
    if not payment_record:
        return {"received": True, "ignored": "Pagamento não registrado"}

    client = AsaasClient()
    remote_payment = await client.get_payment(payment_id)
    remote_value = float(remote_payment.get("value", 0))
    if abs(remote_value - payment_record.value) > 0.01:
        raise HTTPException(status_code=400, detail="Valor divergente do registrado")

    new_status = _map_payment_status(remote_payment.get("status"))
    payment_record.status = new_status
    payment_record.raw_response = remote_payment
    payment_record.updated_at = datetime.utcnow()

    if new_status in SUCCESSFUL_STATUSES:
        user = await session.get(User, payment_record.user_id)
        if user:
            if payment_record.checkout_type == CheckoutType.pro:
                user.plan = PlanType.pro
            elif payment_record.checkout_type == CheckoutType.business:
                user.plan = PlanType.business
            session.add(user)

    session.add(payment_record)
    await session.commit()
    return {
        "received": True,
        "status": payment_record.status.value,
        "event": payload.get("event"),
    }
