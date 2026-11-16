# Guion de demostración — Feria NODOS (24 de noviembre de 2026)

> Documento local, no público. Todos los usuarios, cursos y obras son **ficticios**.
> Contraseña demo de todas las cuentas: `Apach-Demo-2026`. **Rótala** (o vuelve a crear la base) si la instancia se expone fuera del equipo de la demo.

## Cuentas demo (`@demo.example.edu`)

| Cuenta | Rol | Contexto |
|---|---|---|
| `admin` | ADMIN | Todo |
| `docente.com` | TEACHER | COM-RED-01 y COM-INV-01 |
| `docente.itd` | TEACHER | ITD-MET-01 |
| `estudiante1` | STUDENT | COM-RED-01 y COM-INV-01 |
| `estudiante2` / `estudiante3` | STUDENT | COM-RED-01 / COM-INV-01 |
| `estudiante4` / `estudiante5` | STUDENT | ITD-MET-01 |
| `estudiante6` | STUDENT | Sin matrícula (muestra el estado vacío) |

Archivo para la demo: `services/api/tests/fixtures/docx/demo_trabajo_nodos.docx`
(otros: `compliant.docx`, `violations.docx`, `ambiguous.docx`, `no_references.docx`).

## Antes de empezar

1. `./scripts/demo-up.sh` y comprobar `http://localhost:8080/api/v1/health`.
2. Abrir http://localhost:8080 una vez con conexión (para que la PWA precargue guía y generador).

## Recorrido (≈8 minutos)

1. **Estudiante** `estudiante1` → «Revisar mi documento» → curso *Redacción Académica* → `demo_trabajo_nodos.docx`.
   Resultado esperado (calculado en vivo): 4 errores verificados (interlineado 1.5, sin sangría francesa, orden alfabético, cita larga entre comillas) y 2 posibles problemas (cita «Navarro, 2023» sin referencia; referencia «Zamora, 2018» sin cita).
2. Abrir «Ver evidencia medida» y «Aprender a corregir» (la ficha se abre sin perder los resultados).
3. «Crear una referencia» → *Video en línea* → guardar en la biblioteca → exportar a Word.
4. **Docente** `docente.com` → «Mis secciones» → documento → comentar → «Marcar como revisado».
   Mostrar que `docente.itd` no puede abrir la misma URL.
5. **Administración** `admin` → resumen, usuarios, estructura académica, importar CSV (vista previa con errores por fila → confirmar).
6. **Offline** (opcional): desconectar la red, abrir «Aprende APA» y el generador; «Revisar documento» indica que necesita el servidor.

Si algo falla durante la demo, `docker compose ps` muestra la salud de cada servicio y `docker compose logs api` el detalle.
