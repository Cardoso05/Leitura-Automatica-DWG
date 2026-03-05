from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.routes import auth, billing, block_mappings, blocks, projects, upload
from app.core.config import get_settings
from app.db.session import init_db

settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.rate_limit_per_minute}/minute"],
)

app = FastAPI(title=settings.project_name, version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(upload.router, prefix=settings.api_v1_prefix)
app.include_router(projects.router, prefix=settings.api_v1_prefix)
app.include_router(blocks.router, prefix=settings.api_v1_prefix)
app.include_router(block_mappings.router, prefix=settings.api_v1_prefix)
app.include_router(billing.router, prefix=settings.api_v1_prefix)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.get("/health", tags=["Health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
