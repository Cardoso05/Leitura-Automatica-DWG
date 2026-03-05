from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRET_VALUES = {
    "",
    "change-me",
    "troque-esta-chave",
    "__CHANGE_ME_32_CHARS__",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    project_name: str = "TAKEOFF.AI"
    api_v1_prefix: str = "/api"
    environment: str = "local"

    secret_key: str = Field(default="change-me", validation_alias="SECRET_KEY")
    access_token_expire_minutes: int = 60

    backend_cors_origins: List[str] = ["http://localhost:3000"]

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/takeoff"
    redis_url: str = "redis://localhost:6379/0"

    storage_provider: str = "local"  # local | s3
    storage_local_path: Path = Path("storage/uploads")
    storage_results_path: Path = Path("storage/results")

    aws_access_key_id: str | None = None
    aws_secret_access_key: str | None = None
    aws_region: str | None = None
    aws_s3_bucket: str | None = None

    oda_converter_path: str | None = None
    # Formato de entrada: aceitar qualquer DWG até 2018
    oda_input_format: str = "ACAD2018"
    # Formato de saída: "ACAD2004DXF" = 2004 ASCII DXF — binário do ezdxf lê mais rápido que R12,
    # mas ASCII DXF 2004 ainda é muito mais rápido que R12 ASCII (LWPOLYLINE vs POLYLINE).
    # Opções ODA disponíveis: ACAD2018DXF, ACAD2013DXF, ACAD2010DXF, ACAD2007DXF,
    #                          ACAD2004DXF, ACAD2000DXF, ACAD14DXF, ACAD13DXF, ACAD12DXF
    oda_output_format: str = "ACAD2004DXF"

    free_projects_per_month: int = 3

    max_upload_size_mb: int = 100
    rate_limit_per_minute: int = 60

    asaas_api_key: str | None = None
    asaas_api_url: str = "https://www.asaas.com/api/v3"
    asaas_webhook_secret: str | None = None

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    log_level: str = "INFO"

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def assemble_cors(cls, value: List[str] | str) -> List[str]:
        if isinstance(value, str):
            value = value.strip()
            if value.startswith("[") and value.endswith("]"):
                # JSON array em string
                import json

                return json.loads(value)
            return [host.strip() for host in value.split(",")]
        return value

    @field_validator("storage_local_path", "storage_results_path", mode="before")
    @classmethod
    def ensure_path(cls, value: str | Path) -> Path:
        return Path(value)

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        sanitized = value.strip()
        if sanitized in INSECURE_SECRET_VALUES or len(sanitized) < 32:
            raise ValueError(
                "SECRET_KEY deve ser configurada com pelo menos 32 caracteres aleatórios."
            )
        return sanitized


@lru_cache
def get_settings() -> Settings:
    return Settings()
