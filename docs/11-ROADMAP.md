# 11 — Plan de ejecución y control

> **Fecha inicial:** 16 de noviembre de 2026. **Demo objetivo:** 24 de noviembre de 2026. Cronograma orientativo y sujeto a pruebas; no sustituir calidad por fechas.

## Fases y estado (actualizado 2026-11-16)
| Fase | Entregable principal | Prioridad | Estado | Evidencia |
|---|---|---|---|---|
| 1 | Monorepo, Compose, DB, API, web, healthchecks, migración, README | P0 | DONE | `docker compose up --build`: postgres/api/web *healthy*; `/api/v1/health` → migración `0001`; migración probada arriba/abajo |
| 2 | Auth real, roles, datos demo, permisos | P0 | DONE | `tests/test_auth.py` (13), IDOR en `test_documents_permissions.py`; `seed_demo` idempotente (2 ejecuciones, mismos 9 usuarios) |
| 3 | Cursos, secciones, upload privado y storage | P0 | DONE | `test_upload_validation.py` (15), flujo upload en pytest y E2E |
| 4 | Motor DOCX + reglas APA + fixtures y persistencia | P0 | DONE | `test_engine.py` (21) con DOCX generados; hallazgos persistidos y deterministas |
| 5 | Pantalla resultados + fichas guía + enlaces | P0 | DONE | E2E «1. Estudiante carga un DOCX…»; captura `docs/capturas/02-resultados-analisis.png` |
| 6 | Generador APA (8 tipos; libro, artículo, web y video verificados) | P0 | DONE | 21 pruebas golden (`format.test.ts`), E2E «2. …guarda en su biblioteca» |
| 7 | Docente consulta y comenta trabajos de su sección | P0 | DONE | pytest docente A/B; E2E «4.» y «5.»; persistencia tras `docker compose restart api` verificada (4 docs, 2 comentarios, 24 hallazgos antes y después) |
| 8 | Importación CSV, comentarios docentes, CRUD y plantillas | P1 | DONE | `test_admin.py` (CSV idempotente, duplicados, malformado, programa inactivo, plantillas HTTPS/visibilidad, reglas ECC); E2E «6.» |
| 9 | Biblioteca, exportación Word, PWA/offline y catálogo ampliado | P1 | DONE (catálogo: 6 tipos solo ficha) | Vitest IndexedDB y DOCX; E2E offline (sin `/api/` en caché, sync al reconectar) |
| 10 | Tests E2E, ensayo demo, documentación de límites | P0 | DONE | Playwright 8/8 (escritorio + Pixel 7); `docs/DEMO.md` |

## Orden de trabajo
Completar fases P0 1–7, verificar ruta de demostración; agregar P1 solo cuando flujo principal esté estable. Fase 10 incluye pruebas incrementales desde fase 1 y cierre previo a demo. PDF avanzado/DOC legacy/Word comentado y ECC oficial son P2.

## Diario de ejecución
Claude Code: actualizar al terminar cada fase con fecha, commits/archivos, comandos ejecutados, salida de tests, limitaciones y siguiente paso. Nunca escribir DONE si falla un criterio de aceptación.

## Comandos verificados
`docker compose up --build -d` · `docker compose down` · migraciones automáticas al arrancar la API (`alembic upgrade head`) · `docker compose exec api python -m app.scripts.seed_demo` · `cd services/api && .venv/bin/python -m pytest` · `cd apps/web && npm run test` · `cd apps/web && npx playwright test --trace off`. Detalle en README.

## Ensayo de Feria NODOS
1. Arrancar stack local y verificar healthchecks.
2. Login STUDENT ficticio de Comunicaciones/Innovación.
3. Elegir curso y cargar fixture DOCX con infracciones reales.
4. Mostrar hallazgos extraídos, severidad y guía asociada.
5. Generar cita/referencia y guardarla.
6. Login TEACHER, ver documento permitido y revisar/comentar según fase alcanzada.
7. Login ADMIN, visualizar usuarios/cursos; importar CSV solo si P1 completado.
8. Demostrar guía/generador offline solo si implementación y pruebas lo permiten.

## Faltantes institucionales
- Guía APA ECC oficial: **PENDIENTE**.
- Enlaces de plantillas ECC en Drive: **PENDIENTE DE CONFIGURACIÓN**.
- Activo oficial de Pacho y video: **PENDIENTES/OPCIONALES**.
- Datos académicos reales: no necesarios para demo; usar únicamente ficticios.

## Diario de ejecución

### 2026-11-16 — Fases 1 a 10
- Entorno: contenedor Linux en la nube con Docker 29, Python 3.13, Node 22, PostgreSQL 16 (imagen `postgres:16-alpine`).
- Resultados reales: pytest **73 passed** (PostgreSQL real, base `apach_test`); ruff sin errores; Vitest **30 passed**; `tsc` sin errores; `vite build` OK (PWA, 12 entradas en precaché); Playwright **8 passed** contra el stack Compose.
- Incidencias resueltas durante las pruebas (no simuladas): regex de «s. f.» en citas; párrafos del cuerpo confundidos con referencias sueltas; conexiones IndexedDB no cerradas que bloqueaban el borrado al cerrar sesión; estado de sesión residual tras cerrar sesión en el cliente.
- Bloqueos de entorno: Docker Hub respondió 429 a la primera descarga (reintento OK); el build de imágenes necesitó la CA del proxy del entorno (secreto opcional `extra_ca`, ver DECISIONES).

## Limitaciones conocidas
- Motor: sin paginación (ubicación por párrafo); la sangría aportada por numeración (listas) no se resuelve; si ningún nivel define fuente/tamaño se marca «no verificable»; citas y referencias se detectan por patrones (posibles falsos positivos/negativos, p. ej. citas dentro de tablas, notas al pie o formatos no autor-año); no se evalúan portada, encabezados de página, tablas/figuras ni criterios ECC.
- Generador: no convierte títulos a tipo oración (solo advierte); convenciones de idioma provisionales hasta la guía ECC; 6 tipos del catálogo son solo fichas (redes sociales, pódcast, imagen, software, IA, jurídico).
- Sin SMTP: los enlaces de activación/restablecimiento los entrega la administración (visibles solo en development/demo).
- PWA en otros dispositivos de la LAN requiere HTTPS con certificado confiable (`localhost` sí es contexto seguro).
- Biblioteca offline: si se cierra sesión sin conexión con cambios pendientes, los datos quedan en IndexedDB del dispositivo (ocultos en la app, no cifrados).
- PDF, DOC antiguo y Word comentado (P2) no implementados.
- Accesibilidad: diseñada con etiquetas, foco visible, navegación por teclado y contraste de marca; no se ha ejecutado una auditoría WCAG formal.
