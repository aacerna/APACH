# APACH · Apapacho: Tu asistente virtual de APA

PWA académica de la Escuela de Ciencias de la Comunicación (ECC) de la Universidad Dr. José Matías Delgado.
Ayuda a estudiantes a **revisar** documentos Word con reglas APA 7 programadas (sin IA generativa), **aprender** a
corregir y **crear referencias**; permite a docentes revisar y comentar los trabajos de sus secciones y a la
administración gestionar la estructura académica.

> APACH es una herramienta de apoyo: no califica trabajos ni garantiza el cumplimiento total de APA 7.
> Los criterios institucionales ECC están **pendientes** de incorporación.

## Arquitectura

```
apps/web/            React 19 + TypeScript + Vite + Tailwind 4 + React Router + TanStack Query + RHF/Zod + PWA
services/api/        FastAPI + SQLAlchemy 2 + Alembic + python-docx/lxml + Argon2id
  app/apa_engine/    Motor APA determinista: extractor OOXML, estructura, citas, 10 reglas
  alembic/           Migraciones
  tests/             pytest (+ generador reproducible de DOCX de prueba en tests/fixtures/builder.py)
packages/shared/     Fuente única compartida
  content/guides.json      Fichas «Aprende APA» (API + frontend offline)
  src/references/          Formateador APA 7, tipos y catálogo (generador offline)
docker-compose.yml   postgres + api + web (Nginx). Solo se expone el puerto web.
scripts/             demo-up.sh, backup.sh, restore.sh
docs/                Especificación, decisiones (DECISIONES.md), roadmap con evidencia, DEMO.md
```

## Inicio rápido (Docker)

Requisitos: Docker con Compose v2.

```bash
cp .env.example .env
```

Edita `POSTGRES_PASSWORD` en `.env` y luego:

```bash
docker compose up --build -d
```

```bash
docker compose exec api python -m app.scripts.seed_demo
```

Abre http://localhost:8080. Las migraciones se aplican al arrancar la API (`alembic upgrade head`).
Atajo que hace todo lo anterior: `./scripts/demo-up.sh`.

Salud: `curl http://localhost:8080/api/v1/health` → `{"status":"ok","database":"ok","migration":"0001",...}`.
Documentación OpenAPI (fuera de producción): http://localhost:8080/api/docs

Detener (conserva datos): `docker compose down`. Respaldo: `./scripts/backup.sh`. Restauración: `./scripts/restore.sh backups/<fecha>`.

Credenciales y guion de la demostración: [`docs/DEMO.md`](docs/DEMO.md) (datos **ficticios**; rota la contraseña si expones la instancia).

Si construyes detrás de un proxy con inspección TLS, define `EXTRA_CA_FILE` en `.env` con la ruta (dentro del repositorio) de la CA.

## Desarrollo sin Docker para API y web

PostgreSQL 16 accesible (por ejemplo `docker run -d -p 5433:5432 -e POSTGRES_USER=apach -e POSTGRES_PASSWORD=apach_dev -e POSTGRES_DB=apach postgres:16-alpine`).

```bash
cd services/api && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
```

```bash
cd services/api && .venv/bin/alembic upgrade head && .venv/bin/python -m app.scripts.seed_demo
```

```bash
cd services/api && .venv/bin/uvicorn app.main:app --reload --port 8000
```

```bash
cd apps/web && npm ci && npm run dev
```

La web de desarrollo (http://localhost:5173) reenvía `/api` a `localhost:8000`.
Variables de la API: prefijo `APACH_` (ver `services/api/app/core/config.py`); por defecto `APACH_DATABASE_URL=postgresql+psycopg://apach:apach_dev@localhost:5433/apach`.

## Pruebas

| Suite | Comando | Último resultado (2026-11-16) |
|---|---|---|
| Backend (pytest, PostgreSQL real en base `apach_test`) | `cd services/api && .venv/bin/python -m pytest` | **73 passed** |
| Lint backend | `cd services/api && .venv/bin/ruff check app tests` | sin errores |
| Frontend + formateador (Vitest) | `cd apps/web && npm run test` | **30 passed** (21 golden del generador) |
| Typecheck | `cd apps/web && npm run typecheck` | sin errores |
| E2E (Playwright contra el stack de Compose) | `cd apps/web && npx playwright test --trace off` | **8 passed** |

La base de pruebas se crea una vez: `createdb apach_test` (o `psql -c "create database apach_test"`).
Las E2E esperan el stack en `http://localhost:8080` con la siembra demo (`E2E_BASE_URL` para otra URL).
Regenerar los DOCX de prueba: `cd services/api && .venv/bin/python -m tests.fixtures.builder`.

## Qué incluye (MVP)

- **Roles** ADMIN / TEACHER / STUDENT, sin registro público; activación y restablecimiento con token de un uso (hash SHA-256, vencimiento), Argon2id, límite de intentos, cookie HttpOnly + CSRF, autorización por objeto en SQL (pruebas IDOR).
- **Carga DOCX** privada (UUID fuera de carpetas servidas), validación de extensión/MIME real/ZIP bomb/rutas/macros.
- **Motor APA 7** con 10 reglas (márgenes, fuente, interlineado, sangría, sección de referencias, sangría francesa, orden alfabético, citas↔referencias, citas ≥40 palabras), evidencia medida, ubicación por párrafo, clasificación honesta y versionado; reanálisis = nueva corrida.
- **Resultados** con filtros, evidencia, «Aprender a corregir» en diálogo, historial y límites explícitos.
- **Generador** de 8 tipos (libro, capítulo, artículo, web, tesis, video, periódico, informe), cita narrativa/parentética, copiar con cursivas, **biblioteca** IndexedDB + PostgreSQL con sincronización, **exportación Word** con cursivas y sangría francesa.
- **Aprende APA** (16 fichas) y **catálogo** de 14 tipos (8 con generador).
- **Panel docente**: secciones asignadas, estadísticas separando errores verificados/posibles/no verificables, comentarios, estado «revisado».
- **Administración**: CRUD de programas, ciclos, asignaturas, secciones, usuarios, matrículas, asignaciones; **CSV** con vista previa e importación idempotente; plantillas Drive (HTTPS); metadatos de reglas ECC (no habilitables sin implementación); ajustes; reportes y auditoría.
- **PWA**: instalable, guía y generador offline, `/api` nunca cacheada, aviso de actualización.

Limitaciones conocidas: ver `docs/11-ROADMAP.md` (sección «Limitaciones») y `docs/04-MOTOR-APA.md`.
