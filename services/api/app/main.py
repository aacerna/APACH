"""Punto de entrada FastAPI de APACH."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    admin,
    apa,
    auth,
    catalog,
    documents,
    health,
    public,
    references,
    teacher,
)
from app.core.config import get_settings
from app.core.db import session_factory

log = logging.getLogger("apach")


@asynccontextmanager
async def lifespan(_: FastAPI):
    from app.services.analysis import sync_rule_registry

    try:
        with session_factory()() as db:
            sync_rule_registry(db)
    except Exception as exc:  # la API arranca; /health informará del estado de la BD
        log.warning("No se pudo sincronizar el registro de reglas: %s", exc)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="APACH API",
        description="API de APACH / Apapacho: Tu asistente virtual de APA (ECC, UJMD).",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.is_production else "/api/docs",
        openapi_url=None if settings.is_production else "/api/openapi.json",
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                       allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token"])

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    for r in (health.router, auth.router, auth.me_router, catalog.router, documents.router, apa.router,
              references.router, public.router, teacher.router, admin.router):
        app.include_router(r, prefix="/api/v1")
    return app


app = create_app()
