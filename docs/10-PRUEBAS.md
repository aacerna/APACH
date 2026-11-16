# 10 — QA, fixtures y criterios transversales

## Herramientas
Backend: pytest + tests de endpoints y reglas; frontend: Vitest + Testing Library; E2E: Playwright. Agregar lint/format/typecheck apropiados. Pruebas reproducibles con fixtures en repo y DB aislada.

## Cobertura prioritaria
- Healthchecks, migraciones, arranque local.
- Login válido/inválido, activación, recuperación, rate limits.
- ADMIN/TEACHER/STUDENT: acceso permitido y prohibido en servidor.
- CSV duplicado/mal formado/idempotente.
- Upload DOCX válido/no válido/archivo excesivo/path traversal/mime alterado.
- Extracción de texto y metadatos reales; diez reglas APA con casos positivos/negativos/ambiguos.
- Informe persistido, ubicación conocida/no verificable.
- Referencias de libro, revista, web y video; autores, sin fecha, DOI/URL, cursivas en DOCX cuando aplique.
- Comentarios docente y filtros por sección.
- Funciones offline de guía/generador; caché no contiene API protegida.

## Fixtures
Crear DOCX con propiedades controladas: márgenes/interlineado/sangría; citas con y sin referencias; referencias ordenadas/desordenadas; texto de 40+ palabras con y sin atribución. Los scripts de fixtures deben ser reproducibles. Usar nombres/obras ficticios, no datos personales reales.

## Entrega y trazabilidad
En `docs/11-ROADMAP.md`, registrar para cada fase: estado TODO/IN_PROGRESS/DONE/BLOCKED, comandos ejecutados, resultados, fallos y limitaciones. Si un test no se ejecutó, indicar explícitamente «NO EJECUTADO». Evitar afirmaciones «100% APA».

## Criterio MVP
Se ejecuta localmente con instrucciones; arranca DB/API/web; se autentica estudiante demo; carga DOCX fixture; backend genera y persiste evidencia; UI muestra hallazgos; guía enlazada; generador produce referencia y citas; docente puede consultar el trabajo de sección. Sin mocks ocultos.
