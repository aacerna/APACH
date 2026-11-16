# 00 — Definición del proyecto APACH

## Identidad
- Sistema: **APACH**.
- Experiencia: **Apapacho: Tu asistente virtual de APA**.
- Institución: **Universidad Dr. José Matías Delgado**, Escuela de Ciencias de la Comunicación (ECC), El Salvador.
- Programas iniciales: **Comunicaciones** e **Innovación y Transformación Digital**.
- Mascota prevista: **Pacho**. Reservar espacio para activo oficial; no generar imagen/logotipo institucional improvisado.
- MVP local: **Feria NODOS, 24 de noviembre de 2026**.
- Meta futura: versión institucional ampliable durante 2027.

## Problema y propuesta
Estudiantes necesitan ayuda para aplicar normas APA y preparar referencias; docentes necesitan revisar hallazgos y orientar. APACH guía **antes** (aprender/generar), **durante** (creación de referencias) y **después** (revisión del documento y feedback docente).

## Roles y recorridos
**STUDENT**: activar cuenta → acceder a su curso → subir DOCX → recibir hallazgos con evidencia → abrir «Aprender a corregir» → crear/guardar referencia → ver comentarios.
**TEACHER**: iniciar sesión → ver solo secciones asignadas → revisar documentos/observaciones → comentar.
**ADMIN**: iniciar sesión → gestionar programas, ciclos, cursos, secciones, matrículas y usuarios → importar CSV → configurar plantillas/reglas → reportes.

## Prioridades
**P0 para demo:** repositorio y stack local, login y permisos, estudiante/cursos demo, carga DOCX, reglas APA reales verificables, resultados y guías enlazadas, generador mínimo fiable, lectura docente, datos de prueba, recorrido comprobado.
**P1:** CSV robusto, comentarios docentes, CRUD completo, biblioteca y exportación DOCX, PWA/guía-generador offline, plantillas, analítica básica.
**P2:** conversión DOC, PDF avanzado, Word comentado, integraciones externas, catálogo ampliado, sofisticación institucional ECC.

## Límites explícitos
- El revisor **no califica** trabajos ni sustituye al docente.
- La detección de citas/referencias es heurística; hallazgos ambiguos no son errores confirmados.
- No hay guía institucional ECC disponible: no inventar portada, índices ni otras normas locales.
- Las plantillas están en Drive, pero falta suministrar enlaces; configúralos por administración.
- El generador no debe fabricar datos faltantes ni prometer precisión sin casos de prueba.
- El sistema no necesita internet para flujo de demo local; Google Drive sí lo necesita.

## Indicadores de aceptación del recorrido demo
Desde una instalación nueva: iniciar stack, migrar, sembrar datos ficticios, autenticar estudiante, cargar DOCX de fixture, observar evidencia calculada, abrir guía, generar referencia, cambiar a docente, consultar trabajo propio de sección y comentar (si P1 habilitado). Sin mocks presentados como análisis real.

## Diseño de referencia funcional
Sitios de inspiración (analizar si hay acceso, declarar si no):
- https://normasapa.in/descargar-plantillas-de-normas-apa-en-word/
- https://normasapa.in/citar-apa-online/
- https://normasapa.in/referencias/
Usar **patrones funcionales**, no diseño editorial de blog, textos copiados ni código/activos de terceros.
