 import asyncio

 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware

 from app.api.routes import auth, billing, block_mappings, projects, upload
 from app.core.config import get_settings
 from app.db.session import init_db

 settings = get_settings()
 app = FastAPI(title=settings.project_name, version="0.1.0")

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
 app.include_router(block_mappings.router, prefix=settings.api_v1_prefix)
 app.include_router(billing.router, prefix=settings.api_v1_prefix)


 @app.on_event("startup")
 async def on_startup() -> None:
     await init_db()


 @app.get("/health", tags=["Health"])
 async def healthcheck() -> dict[str, str]:
     return {"status": "ok"}
