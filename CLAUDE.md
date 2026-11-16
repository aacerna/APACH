# APACH — instrucciones permanentes para Claude Code

## Propósito
Desarrollar desde cero **APACH / Apapacho: Tu asistente virtual de APA**, PWA académica de la Escuela de Ciencias de la Comunicación (ECC), Universidad Dr. José Matías Delgado (UJMD), El Salvador. MVP demostrable localmente el **24 de noviembre de 2026**; evolución institucional en 2027.

## Fuente de verdad y orden de lectura
1. `docs/00-PROYECTO.md` — alcance, prioridades, definiciones.
2. `docs/01-ARQUITECTURA.md` — stack, servicios y modelo.
3. Documento del módulo activo (`docs/02-...` a `docs/10-...`).
4. `docs/11-ROADMAP.md` — fases, decisiones y estado.
Ante contradicción, registrar la decisión en `docs/DECISIONES.md`; no inventar requerimientos institucionales.

## Reglas innegociables
- **Proyecto nuevo**: crear código fuente real, no pantallas con datos ficticios como sustituto del backend.
- **Sin IA para revisar APA**: motor determinista basado en reglas y evidencia; ninguna llamada a LLM para analizar archivos.
- **Sin afirmaciones exageradas**: no garantizar cumplimiento total de APA 7 ni clasificar incertidumbre como error seguro.
- **Acceso restringido**: ADMIN, TEACHER, STUDENT; autorización por objeto validada en servidor; sin auto-registro público.
- **Local primero**: desarrollo reproducible con Docker Compose, PostgreSQL, API Python y frontend React.
- **Offline limitado**: guía APA precargada y generador de referencias pueden funcionar offline; análisis de documentos requiere backend local.
- **Guía institucional pendiente**: no inventar normas de portada, índice o evaluación ECC; mantener configuración institucional inactiva.
- **Plantillas Drive disponibles pero enlaces pendientes**: permitir configuración, sin URLs ficticias.
- **Originalidad**: normasapa.in es inspiración funcional, nunca plantilla visual o fuente para copiar textos/código.
- **Seguridad**: archivos privados; validar identidad, permisos y tipos; no exponer secretos ni ejecutar macros.
- **Pruebas honestas**: documentar comandos ejecutados y resultados reales; no marcar «probado» sin ejecutar.
- **Alcance estricto**: terminar flujo P0 antes de ampliar P1/P2; documentar pendientes.

## Convenciones de trabajo
- Antes de cambiar código, revisar plan, archivos relevantes y dependencias.
- Trabajar en incrementos pequeños, probar después de cada módulo y registrar avances en `docs/11-ROADMAP.md`.
- Actualizar `README.md` con comandos realmente verificables.
- Registrar cambios arquitectónicos en `docs/DECISIONES.md`.
- Emplear interfaces y comentarios en español; código identificadores y pruebas en inglés de forma consistente.
- Mantener un solo origen de verdad de reglas, categorías y tipos de referencia.
- No instalar ni activar servicios externos de pago.

## Criterio de terminado
Una función está «lista» solo si existe UI, lógica, datos persistentes cuando corresponda, permisos y pruebas relevantes verificadas. Mantener lista explícita de limitaciones.
