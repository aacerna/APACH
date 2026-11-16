# 05 — Generador y catálogo APA 7

## Objetivo
Generador de citas y referencias conforme a APA 7 con formularios específicos, evidencia de reglas y funcionamiento en navegador **sin LLM**. Inspiración funcional: `https://normasapa.in/citar-apa-online/` y `https://normasapa.in/referencias/`; **no copiar** interfaz, código o contenido.

## P0 — fuentes a implementar y validar
- Libro.
- Capítulo de libro.
- Artículo de revista académica (DOI/URL condicional).
- Página web.
- Tesis.
- Video en línea.
- Artículo periodístico.
- Informe institucional.
Para demo, terminar y probar al menos libro, artículo académico, web y video antes de abrir más tipos. Los restantes pueden pasar a P1 si comprometen calidad.

## P1/P2 — ampliar de forma versionada
Redes sociales, podcast, fotografías, imágenes, software, herramientas de IA, documentos jurídicos y otros. El catálogo de ejemplos puede ser más amplio que los generadores implementados; etiquetar cada disponibilidad.

## Experiencia
Selector buscable por tipo/categoría; campos dinámicos por fuente; autores personales múltiples, grupos/instituciones, falta de autor/fecha; vista previa al cambiar datos; referencia, cita narrativa y parentética; copiar; guardar/editar/eliminar; ordenar bibliografía; exportar DOCX con cursivas semánticas y sangría francesa. Evitar guardar HTML arbitrario: modelar texto con segmentos formateados.

## Modelo de datos
Definir `ReferenceInput` discriminado por `source_type`; guardar campos estructurados, no solo el string renderizado; `ReferenceOutput` con `segments` (texto, italic boolean), `parenthetical_citation`, `narrative_citation`, `warnings`, versión de reglas. No inventar autor, año, DOI, editorial, título ni fecha; cuando la fuente no da dato, usar el tratamiento APA correspondiente o indicar insuficiencia.

## Reglas críticas
Nombres de autores, número y orden, autor corporativo, sin fecha, título/cursivas, datos de revista, volumen/número/páginas, DOI/URL, puntuación y sentence case donde corresponda, 3+ autores en citas, supuestos especiales. Verificar casos contra fuentes APA 7 confiables y documentar procedencia; no utilizar blogs como única autoridad. Usar pruebas golden con entradas y salidas justificadas. No copiar ejemplos protegidos: crear ejemplos ficticios originales.

## Catálogo «Explora las referencias APA»
Categorías: libros/capítulos; artículos; web; tesis/informes; redes; audiovisuales; software/IA; especiales. Cada ficha: cuándo usar, campos, estructura, ejemplo original, cita narrativa y parentética, CTA «Crear esta referencia» solo si implementada; búsqueda y filtros.

## Biblioteca
Guardar en IndexedDB offline para usuario autenticado; vincular a PostgreSQL cuando conectado. Diseñar sync con ids estables, marcas de tiempo y estrategia de conflictos; no mezclar referencias de usuarios en dispositivo compartido. El generador nunca requiere internet para formatos locales.

## Aceptación
Formulario de libro, web, revista y video produce referencia/citas útiles, conserva cursivas en Word en exportación cuando implementada, maneja validación de datos ausentes, permite copiar. Test casos 1/2/3+ autores, institucional, sin fecha, DOI y URL.
