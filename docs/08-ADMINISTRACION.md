# 08 — Administración académica

## CRUD
Programas, ciclos, asignaturas, secciones, usuarios, docentes, matrículas, asignaciones. Campos obligatorios, unicidad y validación en backend. Desactivación preferible a borrado de usuarios con trabajos. Auditoría para asignaciones y privilegios.

## CSV
Ver `03-USUARIOS-ROLES.md`. Vista previa, mapeo controlado de programa/curso, reporte importado/rechazado, reimportación idempotente. No habilitar cuentas fuera de programas autorizados.

## Plantillas
Registrar links HTTPS a Google Drive; **enlaces pendientes**. No crear credenciales Google ni implementar OAuth en MVP salvo necesidad real. Validar URLs y registrar responsable de actualización.

## Reglas ECC
CRUD de metadatos de reglas: identificador, nombre, fuente oficial, versión, vigencia, habilitación. No implementar comprobaciones técnicas inventadas. Habilitar regla solo cuando sea verificable y esté programada/testeada.

## Reportes
Por ciclo, programa, sección: documentos y tipos de hallazgos; sin revelar datos ajenos a usuarios autorizados. Registrar cuándo se generó reporte y su alcance.

## Aceptación
Admin crea programa/ciclo/asignatura/sección, asigna docente y matrícula; CSV importa correctamente; plantillas configuradas aparecen a estudiantes autorizados; no existen acciones «guardar» que no persistan.
