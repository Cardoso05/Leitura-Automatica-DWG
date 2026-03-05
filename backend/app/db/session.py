from typing import AsyncGenerator

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel

from app.core.config import get_settings
import app.models.block_cache  # noqa: F401 — registrar tabela no metadata

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False, future=True)
async_session_factory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


async def init_db() -> None:
    """
    Em produção, use `alembic upgrade head` antes de iniciar o servidor.
    Este create_all é mantido como fallback para desenvolvimento local e
    para criar tabelas que ainda não tenham migration.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.create_all)
        logger.info("Database tables ensured via create_all (dev fallback)")
    except Exception as exc:
        logger.error("Failed to initialize database: %s", exc)
        raise
