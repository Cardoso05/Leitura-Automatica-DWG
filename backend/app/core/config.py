 from functools import lru_cache
 from pathlib import Path
 from typing import List

 from pydantic import AnyHttpUrl, field_validator
 from pydantic_settings import BaseSettings, SettingsConfigDict


 class Settings(BaseSettings):
     model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

     project_name: str = "TAKEOFF.AI"
     api_v1_prefix: str = "/api"
     environment: str = "local"

     secret_key: str = "change-me"
     access_token_expire_minutes: int = 60

     backend_cors_origins: List[AnyHttpUrl | str] = ["http://localhost:3000"]

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
    oda_input_format: str = "ACAD2018"
    oda_output_format: str = "ACAD2018"

     free_projects_per_month: int = 3

     asaas_api_key: str | None = None
     asaas_api_url: str = "https://www.asaas.com/api/v3"
     asaas_webhook_secret: str | None = None

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


 @lru_cache
 def get_settings() -> Settings:
     return Settings()
