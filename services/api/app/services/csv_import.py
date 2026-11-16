"""Importación CSV de estudiantes autorizados: validar → previsualizar → confirmar (transaccional e idempotente)."""
from __future__ import annotations

import csv
import io

from email_validator import EmailNotValidError, validate_email
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import normalize_email
from app.models import AcademicTerm, Course, Enrollment, Program, Role, Section, User

REQUIRED_HEADERS = ["first_name", "last_name", "email", "program", "academic_term", "course_code", "section_code"]
MAX_ROWS = 2000
MAX_BYTES = 1024 * 1024


class CsvFormatError(ValueError):
    pass


def parse_csv(data: bytes) -> list[dict[str, str]]:
    if len(data) > MAX_BYTES:
        raise CsvFormatError("El archivo CSV supera 1 MB.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvFormatError("El archivo debe estar codificado en UTF-8.") from exc
    reader = csv.DictReader(io.StringIO(text))
    headers = [h.strip() for h in (reader.fieldnames or [])]
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if missing:
        raise CsvFormatError(f"Faltan encabezados obligatorios: {', '.join(missing)}. Se esperan: {','.join(REQUIRED_HEADERS)}.")
    rows = []
    for raw in reader:
        rows.append({k.strip(): (v or "").strip() for k, v in raw.items() if k})
        if len(rows) > MAX_ROWS:
            raise CsvFormatError(f"El CSV supera el máximo de {MAX_ROWS} filas.")
    if not rows:
        raise CsvFormatError("El CSV no contiene filas de datos.")
    return rows


def validate_rows(db: Session, rows: list[dict[str, str]]) -> list[dict]:
    programs = db.scalars(select(Program)).all()
    seen_pairs: set[tuple[str, int]] = set()
    names_by_email: dict[str, tuple[str, str]] = {}
    result = []
    for i, row in enumerate(rows, start=2):  # fila 1 = encabezados
        errors: list[str] = []
        first, last = row.get("first_name", ""), row.get("last_name", "")
        if not first or not last:
            errors.append("Nombre y apellido son obligatorios.")
        email = normalize_email(row.get("email", ""))
        try:
            validate_email(email, check_deliverability=False)
        except EmailNotValidError:
            errors.append("Correo electrónico no válido.")
        prog_value = row.get("program", "").lower()
        program = next((p for p in programs if p.code.lower() == prog_value or p.name.lower() == prog_value), None)
        if program is None:
            errors.append(f"Programa «{row.get('program')}» no existe.")
        elif not program.active:
            errors.append(f"Programa «{program.name}» no está autorizado (inactivo).")
        term = db.scalars(select(AcademicTerm).where(func.lower(AcademicTerm.code) == row.get("academic_term", "").lower())).first()
        if term is None:
            errors.append(f"Ciclo «{row.get('academic_term')}» no existe.")
        elif not term.active:
            errors.append(f"Ciclo «{term.code}» está inactivo.")
        course = db.scalars(select(Course).where(func.lower(Course.code) == row.get("course_code", "").lower())).first()
        if course is None:
            errors.append(f"Asignatura «{row.get('course_code')}» no existe.")
        elif program is not None and course.program_id != program.id:
            errors.append(f"La asignatura {course.code} no pertenece al programa indicado.")
        section = None
        if course is not None and term is not None:
            section = db.scalars(select(Section).where(Section.course_id == course.id, Section.term_id == term.id,
                                                      func.lower(Section.code) == row.get("section_code", "").lower())).first()
            if section is None:
                errors.append(f"Sección «{row.get('section_code')}» no existe para {course.code} en {term.code}.")
        if email and first and last:
            prev = names_by_email.setdefault(email, (first, last))
            if prev != (first, last):
                errors.append("El mismo correo aparece con nombres distintos en el lote.")
        if section is not None:
            if (email, section.id) in seen_pairs:
                errors.append("Fila duplicada en el lote (mismo correo y sección).")
            seen_pairs.add((email, section.id))
        existing = db.scalars(select(User).where(User.email == email)).first() if email else None
        action = "ERROR"
        if existing is not None and existing.role != Role.STUDENT:
            errors.append("El correo pertenece a una cuenta que no es de estudiante.")
        if not errors:
            if existing is None:
                action = "CREATE_AND_ENROLL"
            elif db.scalar(select(Enrollment.id).where(Enrollment.student_id == existing.id, Enrollment.section_id == section.id)):
                action = "ALREADY_ENROLLED"
            else:
                action = "ENROLL_EXISTING"
        result.append({"line": i, "first_name": first, "last_name": last, "email": email,
                       "program_id": program.id if program else None, "section_id": section.id if section else None,
                       "section_label": f"{course.code}-{section.code} ({term.code})" if section else None,
                       "action": action, "errors": errors})
    return result


def summarize(rows: list[dict]) -> dict:
    from collections import Counter
    c = Counter(r["action"] for r in rows)
    return {"total": len(rows), "create_and_enroll": c["CREATE_AND_ENROLL"], "enroll_existing": c["ENROLL_EXISTING"],
            "already_enrolled": c["ALREADY_ENROLLED"], "errors": c["ERROR"]}


def apply_rows(db: Session, rows: list[dict]) -> tuple[dict, list[User]]:
    """Aplica filas válidas dentro de la transacción actual. Nunca elimina ni mueve matrículas existentes."""
    created: list[User] = []
    imported = skipped = 0
    for r in rows:
        if r["action"] == "ERROR":
            continue
        user = db.scalars(select(User).where(User.email == r["email"])).first()
        if user is None:
            user = User(email=r["email"], first_name=r["first_name"], last_name=r["last_name"], role=Role.STUDENT,
                        is_active=False, program_id=r["program_id"])
            db.add(user)
            db.flush()
            created.append(user)
        exists = db.scalar(select(Enrollment.id).where(Enrollment.student_id == user.id, Enrollment.section_id == r["section_id"]))
        if exists:
            skipped += 1
            continue
        db.add(Enrollment(student_id=user.id, section_id=r["section_id"]))
        imported += 1
    return {"enrollments_created": imported, "users_created": len(created), "skipped_existing": skipped,
            "rows_with_errors": sum(1 for r in rows if r["action"] == "ERROR")}, created
