# API de APACH (FastAPI). Contexto de build: raíz del repositorio (necesita packages/shared/content).
# syntax=docker/dockerfile:1
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    APACH_SHARED_CONTENT_DIR=/app/shared-content APACH_STORAGE_DIR=/data/documents
WORKDIR /app/api
COPY services/api/requirements.txt services/api/requirements-dev.txt ./
# CA adicional opcional (proxy corporativo con inspección TLS). Vacía por defecto.
RUN --mount=type=secret,id=extra_ca \
    if [ -s /run/secrets/extra_ca ]; then export PIP_CERT=/run/secrets/extra_ca; fi; \
    pip install -r requirements-dev.txt
COPY services/api/ ./
COPY packages/shared/content/ /app/shared-content/
RUN useradd --system --uid 10001 apach && mkdir -p /data/documents && chown -R apach /data /app
USER apach
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health/live').status==200 else 1)"
# Aplica migraciones y arranca. La siembra demo es un paso explícito (ver README).
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
