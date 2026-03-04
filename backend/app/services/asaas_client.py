from typing import Any, Dict

import httpx

from app.core.config import get_settings


class AsaasClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.asaas_api_url.rstrip("/")
        self.headers = {
            "Content-Type": "application/json",
            "access_token": self.settings.asaas_api_key or "",
        }
        self._client_kwargs = {"timeout": httpx.Timeout(10.0, connect=5.0)}

    async def create_customer(self, *, name: str, email: str) -> Dict[str, Any]:
        payload = {"name": name, "email": email}
        async with httpx.AsyncClient(**self._client_kwargs) as client:
            resp = await client.post(
                f"{self.base_url}/customers", json=payload, headers=self.headers
            )
            resp.raise_for_status()
            return resp.json()

    async def create_payment(
        self,
        *,
        customer_id: str,
        value: float,
        description: str,
        billing_type: str = "PIX",
        due_date: str | None = None,
        callback_url: str | None = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "customer": customer_id,
            "value": round(value, 2),
            "description": description,
            "billingType": billing_type,
        }
        if due_date:
            payload["dueDate"] = due_date
        if callback_url:
            payload["callbackUrl"] = callback_url

        async with httpx.AsyncClient(**self._client_kwargs) as client:
            resp = await client.post(
                f"{self.base_url}/payments", json=payload, headers=self.headers
            )
            resp.raise_for_status()
            return resp.json()

    async def get_payment(self, payment_id: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(**self._client_kwargs) as client:
            resp = await client.get(
                f"{self.base_url}/payments/{payment_id}", headers=self.headers
            )
            resp.raise_for_status()
            return resp.json()
