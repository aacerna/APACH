# 07 — Panel docente

## Funcionalidad
Docente ve solo asignaturas/secciones asignadas y estudiantes matriculados; lista documentos cargados con estado y fecha; abre análisis APA con evidencia, filtros, resultados y limitaciones; registra observaciones textuales con autor/fecha; marca trabajo «revisado» si se implementa estado. No alterar el documento original ni los hallazgos automáticos silenciosamente.

## Estadísticas básicas
Cantidad de estudiantes matriculados, documentos, revisados/pendientes, hallazgos por regla (separar errores verificables de posibles y no verificables). Los indicadores no equivalen a nota oficial ni evaluación de calidad académica integral.

## Seguridad
Comprobar asignación a sección en **cada endpoint** de consulta/comentario; pruebas de docente A intentando acceder a sección B. Admin puede auditar bajo permisos pertinentes.

## Aceptación
Teacher A ve y comenta trabajo de su propia sección, no puede acceder a documento de otra; estudiante ve solo comentarios de su trabajo; datos persisten luego de reiniciar backend.
