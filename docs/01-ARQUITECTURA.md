# 01 — Arquitectura técnica y datos

## Stack decidido
Frontend **React + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + React Hook Form + Zod**. Backend **Python FastAPI + Pydantic + SQLAlchemy + Alembic**. PostgreSQL. Documentos **python-docx + lxml**, PDF solo análisis acotado con **PyMuPDF**. PWA **vite-plugin-pwa/Workbox + IndexedDB**. Tests **pytest, Vitest/Testing Library, Playwright**.

## Monorepo sugerido
```
apach/
  CLAUDE.md
  apps/web/
  services/api/app/{api,core,models,schemas,services,apa_engine,repositories}/
  services/api/alembic/
  packages/shared/
  docs/
  scripts/
  tests/
  docker-compose.yml
  .env.example
  README.md
```
Ajustar carpeta de raíz sin duplicar el starter y sin depender de servicios de nube.

## Entorno local
Compose: servicios `web`, `api`, `postgres` con healthchecks, restart razonable, variables `.env`, volúmenes persistentes `postgres_data`, `document_storage`, redes internas; exponer solo puertos necesarios. `web` consume base URL de API configurable. Documentar `docker compose up --build`, migraciones, siembra y tests. Incluir estrategia de backup local y restauración básica.

## Entidades principales
- `users` (email único normalizado, role enum, password_hash, is_active, must_change_password, program_id nullable, created_at).
- `programs`, `academic_terms`, `courses`, `sections` (relación a curso/término), `enrollments` (student_id, section_id), `teacher_assignments` (teacher_id, section_id).
- `documents` (student_id, section_id, filename original, objeto almacenado con UUID, mime, size, sha256, status, timestamps).
- `analysis_runs` (document_id, rule_set_version, status, summary, processing timestamps).
- `apa_rules` (code, scope general/ECC, version, enabled, explanation slug, reference/source).
- `analysis_findings` (run_id, rule_code, severity, verification_status, message, evidence JSON, location JSON, suggestion, guide_slug).
- `teacher_comments` (document_id, teacher_id, body, timestamps), `reference_records` (student_id, type, input JSON, output JSON, timestamps).
- `template_links` (name, description, program, type, https_url, active), `system_settings`, `audit_events`.
- `account_tokens` (hashed token, user_id, purpose activation/reset, expires_at, used_at).
Agregar índices/constraints y migraciones reales; no almacenar tokens sin hash.

## Contrato API inicial
Usar `/api/v1` y generar OpenAPI: `POST /auth/login`, `/auth/logout`, `/auth/activate`, `/auth/request-reset`, `/auth/reset`; `GET /me`; `GET /programs`, `/terms`, `/courses`, `/sections`; `POST /documents`, `GET /documents`, `GET /documents/{id}`, `POST /documents/{id}/analyze`, `GET /documents/{id}/analysis`; `GET /apa/rules`, `GET /apa/guides/{slug}`; `POST /references/format`, CRUD `/references`; secciones/docentes y CRUD administrador. Responder 401/403/404 con criterio consistente, no exponer archivos por rutas públicas.

## Seguridad arquitectónica
- Cookie HttpOnly de sesión con atributos apropiados, CSRF cuando proceda; configurar SameSite/CORS cuidadosamente para entorno local.
- Contraseñas Argon2id; tokens de activación y reset de uso único con vencimiento; sin correos falsamente «enviados».
- Guardar archivos fuera de carpeta servida, UUID, validar tamaño, zip bomb potencial, formato MIME y límites de proceso; no ejecutar macros.
- Verificar en cada ruta quién posee el recurso y pertenencia a la sección; administrar autorización por servidor, no solo UI.
- Descarga de documentos solo por endpoint autorizado.

## Persistencia / estado
Resultados históricos deben vincularse a versión del conjunto de reglas. Reanálisis crea nueva corrida o marca versión. Registrar fallos de procesamiento sin pérdida del documento original. No exponer credenciales demo en producción.
