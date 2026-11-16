# 04 — Motor de análisis de documentos APA 7

## Principio
**Sin modelos generativos ni tokens**. Evaluación determinista, con evidencia auditable y límites claros. Documento DOCX como objetivo P0. PDF parcial P2 (PyMuPDF); DOC antiguo solo si hay conversión segura instalada y probada, nunca ejecución de macros.

## Pipeline
1. Validar archivo (extensión, MIME real, tamaño máx. configurable, DOCX ZIP y límites de extracción).
2. Almacenar privado, registrar hash y estado.
3. Extraer OOXML: secciones, márgenes, estilos, runs, párrafos, tablas, referencias, propiedades; resolver herencia de estilos cuando sea posible.
4. Detectar secciones/fragmentos relevantes con heurísticas conservadoras (no asumir que cualquier «Referencias» inicia bibliografía válida).
5. Ejecutar reglas independientes con versionado.
6. Guardar hallazgos y metadatos de localización (índice de párrafo, sección, texto abreviado, no número de página inventado).
7. Ofrecer resultados y vínculo a guía.

## Clasificación
`severity`: `ERROR`, `POSSIBLE_PROBLEM`, `NEEDS_TEACHER`.
`verification_status`: `CHECKED`, `NOT_VERIFIABLE`, `NOT_APPLICABLE`.
Solo certeza suficiente permite ERROR. Un valor sin verificar **no suma al contador de errores**. Los resultados no deben denominarse «100% cumplimiento APA».

## 10 comprobaciones iniciales
| Código | Comprobación | Precaución |
|---|---|---|
| APA-01 | Márgenes | Comparar propiedades reales de cada sección; reportar secciones distintas. |
| APA-02 | Fuente y tamaño | Evaluar fuentes permitidas por APA 7 y equivalencias/estilos; no exigir una única fuente universal. |
| APA-03 | Interlineado | Medir párrafos pertinentes y excepciones de estilo; herencia de configuración. |
| APA-04 | Sangría de primera línea | Excluir encabezados, títulos, resumen u otras excepciones verificables. |
| APA-05 | Presencia/sección de referencias | Detectar con cautela y marcar si ambiguo. |
| APA-06 | Sangría francesa de referencias | Solo referencias detectadas con fiabilidad, considerando estilos. |
| APA-07 | Orden alfabético | Normalización consistente y casos especiales (autores institucionales/sin autor). |
| APA-08 | Citas del texto sin referencia | Heurística; posibles falsos positivos por nombres, et al., varias citas. |
| APA-09 | Referencias sin cita textual detectable | Heurística; no confundir fuentes consultadas/formatos especiales. |
| APA-10 | Posibles citas de >=40 palabras | Solo si detecta evidencia clara de cita textual; clasificar ambiguos como posibles/revisión docente. |

## Salida mínima por hallazgo
`rule_code`, `severity`, `verification_status`, `message` (español), `evidence` (datos extraídos), `location` (párrafo y texto cuando posible), `suggestion`, `guide_slug`, `rule_set_version`.

## Referencias institucionales
No aplicar requisitos ECC específicos hasta recibir guía oficial; tabla `apa_rules` permite `scope=ECC`, fuente/versionado, estado `disabled` por defecto. No inventar portada ni índice.

## Fixtures y tests
Generar DOCX reales, al menos uno correcto para cada regla, uno con violación verificable y uno ambiguo; tests unitarios por regla y de integración con persistencia. No usar resultados hardcodeados. Documentar límites de python-docx para estilos heredados y paginación, y cualquier regla que no se haya podido verificar de modo robusto.

## Aceptación P0
Al subir un DOCX fixture, el backend extrae realmente contenido y propiedades, produce hallazgos explicables, los guarda y muestra en UI; no produce un resultado demo prefabricado. El mismo archivo/revisión da salida determinista bajo una versión fija de reglas.

## Implementación (2026-11-16)
- Código: `services/api/app/apa_engine/` (`extractor.py`, `structure.py`, `citations.py`, `rules.py`, `engine.py`). Versión de reglas: `apa7-general-2026.11.1`.
- Herencia resuelta por atributo: formato directo → estilo de carácter → cadena `basedOn` del estilo de párrafo → estilo por defecto → `docDefaults` → fuentes del tema (`theme1.xml`).
- Se recorren párrafos dentro de controles de contenido (`w:sdt`, p. ej. bibliografías de Word) y se ignoran las eliminaciones de control de cambios.
- Portada: se detecta solo si hay salto de página/sección explícito en los primeros párrafos.
- Tolerancias: márgenes ±0.06 cm; sangrías ±0.13 cm; doble espacio = `line` 470–490 con `lineRule=auto`.
- Fuentes recomendadas: Times New Roman 12, Georgia 11, Calibri 11, Arial 11, Lucida Sans Unicode 10, Computer Modern 10. Otra fuente → NEEDS_TEACHER; tamaño fuera de 10–12 pt → ERROR.
- Fixtures reproducibles: `services/api/tests/fixtures/builder.py` (`compliant`, `violations`, `ambiguous`, `no_references`, `demo_trabajo_nodos`).
- Límites: ver «Limitaciones conocidas» en `docs/11-ROADMAP.md`.
