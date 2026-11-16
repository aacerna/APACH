# 03 — Identidad, matriculación y autorización

## Roles
`ADMIN`: todos los CRUD y configuración; reportes agregados y auditoría.
`TEACHER`: solo secciones asignadas, estudiantes y documentos de esas secciones, comentarios y estado de revisión.
`STUDENT`: solo sus matrículas, documentos, análisis y referencias.
No dar acceso entre estudiantes o docentes ajenos a una sección. Evaluar permisos tanto en UI como en endpoints backend.

## Importación CSV (P1; acceso por estudiantes autorizados)
Encabezados exigidos: `first_name,last_name,email,program,academic_term,course_code,section_code`. Validar correo, programa, fechas/ciclo, duplicados en lote y ya existentes, asignaciones. Proceso: carga → validación y vista previa → confirmación explícita → importación transaccional/idempotente → informe filas ok/error. No reasignar de forma silenciosa matrícula de otros ciclos. CSV UTF-8 y ejemplos ficticios.

## Autenticación
- Sin registro público. Solo ADMIN aprovisiona cuentas.
- Activación por token aleatorio, hasheado en DB, expiración y uso único; configurar contraseña fuerte.
- Login por email + contraseña hasheada con Argon2id; protección de fuerza bruta.
- Recuperación: token de un uso y vencimiento; interfaz no revela si correo existe.
- SMTP opcional: modo local presenta un enlace de desarrollo solo al admin/desarrollador bajo configuración NO disponible en producción; no afirmar envío de email.
- Sesiones seguras mediante cookies HttpOnly y CSRF cuando corresponda.

## Autorización por objeto
Para leer documento, comprobar propiedad (`student_id`) o que teacher esté asignado a `section_id`; para editar comentarios, teacher asignado; admin con permiso explícito y auditoría. En listados aplicar filtros **en consulta de BD**. Descarga autorizada. Tests negativos de IDOR obligatorios.

## Datos demo
1 admin, 2 docentes, 6 estudiantes, programas, dos o más cursos/secciones. Usuarios y archivos **ficticios**, seed idempotente y disponible solo en entorno `development/demo`. Credenciales o enlace de acceso demo mostrados solo en documentación local no pública, con aviso de rotación.

## Aceptación
Una cuenta sin matrícula no ve documentos; docente A no lee curso B; estudiante A no lee documento B ni alterando URL; admin importa CSV sin duplicar cuentas; activación/reset invalidan el token después de uso.
