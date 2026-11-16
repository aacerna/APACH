"""Siembra idempotente de datos FICTICIOS para desarrollo y demostración (Feria NODOS).

Uso:  python -m app.scripts.seed_demo
Se niega a ejecutarse con APACH_ENV=production. Cambia la contraseña demo si expones la instancia.
"""
import sys
from datetime import date

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import session_factory
from app.core.security import hash_password
from app.models import AcademicTerm, Course, Enrollment, Program, Role, Section, TeacherAssignment, User
from app.services.analysis import sync_rule_registry

DEMO_PASSWORD = "Apach-Demo-2026"
DOMAIN = "demo.example.edu"

PROGRAMS = [("COM", "Comunicaciones"), ("ITD", "Innovación y Transformación Digital")]
TERM = ("2026-02", "Ciclo 02-2026", date(2026, 7, 13), date(2026, 12, 12))
COURSES = [
    ("COM-RED", "Redacción Académica", "COM"),
    ("COM-INV", "Investigación en Comunicación", "COM"),
    ("ITD-MET", "Metodología de la Investigación Digital", "ITD"),
]
SECTIONS = [("COM-RED", "01"), ("COM-INV", "01"), ("ITD-MET", "01")]
USERS = [
    # email local, nombre, apellido, rol, programa
    ("admin", "Ana", "Administradora Demo", Role.ADMIN, None),
    ("docente.com", "Daniel", "Docente Comunicaciones", Role.TEACHER, "COM"),
    ("docente.itd", "Diana", "Docente Innovación", Role.TEACHER, "ITD"),
    ("estudiante1", "Elena", "Estudiante Uno", Role.STUDENT, "COM"),
    ("estudiante2", "Ernesto", "Estudiante Dos", Role.STUDENT, "COM"),
    ("estudiante3", "Eva", "Estudiante Tres", Role.STUDENT, "COM"),
    ("estudiante4", "Emilio", "Estudiante Cuatro", Role.STUDENT, "ITD"),
    ("estudiante5", "Esther", "Estudiante Cinco", Role.STUDENT, "ITD"),
    ("estudiante6", "Esteban", "Estudiante Seis (sin matrícula)", Role.STUDENT, "ITD"),
]
ENROLLMENTS = [
    ("estudiante1", "COM-RED"), ("estudiante1", "COM-INV"), ("estudiante2", "COM-RED"), ("estudiante3", "COM-INV"),
    ("estudiante4", "ITD-MET"), ("estudiante5", "ITD-MET"),
]
ASSIGNMENTS = [("docente.com", "COM-RED"), ("docente.com", "COM-INV"), ("docente.itd", "ITD-MET")]


def seed(db) -> dict:
    programs = {}
    for code, name in PROGRAMS:
        p = db.scalars(select(Program).where(Program.code == code)).first() or Program(code=code, name=name)
        db.add(p)
        programs[code] = p
    db.flush()
    term = db.scalars(select(AcademicTerm).where(AcademicTerm.code == TERM[0])).first()
    if term is None:
        term = AcademicTerm(code=TERM[0], name=TERM[1], start_date=TERM[2], end_date=TERM[3])
        db.add(term)
    courses = {}
    for code, name, prog in COURSES:
        c = db.scalars(select(Course).where(Course.code == code)).first() or Course(code=code, name=name, program_id=programs[prog].id)
        db.add(c)
        courses[code] = c
    db.flush()
    sections = {}
    for course_code, scode in SECTIONS:
        c = courses[course_code]
        s = db.scalars(select(Section).where(Section.course_id == c.id, Section.term_id == term.id, Section.code == scode)).first()
        if s is None:
            s = Section(course_id=c.id, term_id=term.id, code=scode)
            db.add(s)
        sections[course_code] = s
    db.flush()
    users = {}
    pw = hash_password(DEMO_PASSWORD)
    for local, first, last, role, prog in USERS:
        email = f"{local}@{DOMAIN}"
        u = db.scalars(select(User).where(User.email == email)).first()
        if u is None:
            u = User(email=email, first_name=first, last_name=last, role=role, password_hash=pw, is_active=True,
                     program_id=programs[prog].id if prog else None)
            db.add(u)
        users[local] = u
    db.flush()
    for local, course_code in ENROLLMENTS:
        sid, uid = sections[course_code].id, users[local].id
        if not db.scalar(select(Enrollment.id).where(Enrollment.student_id == uid, Enrollment.section_id == sid)):
            db.add(Enrollment(student_id=uid, section_id=sid))
    for local, course_code in ASSIGNMENTS:
        sid, uid = sections[course_code].id, users[local].id
        if not db.scalar(select(TeacherAssignment.id).where(TeacherAssignment.teacher_id == uid, TeacherAssignment.section_id == sid)):
            db.add(TeacherAssignment(teacher_id=uid, section_id=sid))
    db.commit()
    sync_rule_registry(db)
    return {"users": len(users), "sections": len(sections)}


def main() -> int:
    settings = get_settings()
    if settings.env not in ("development", "demo", "test"):
        print(f"seed_demo rechazado: APACH_ENV={settings.env}. Solo development/demo/test.", file=sys.stderr)
        return 1
    with session_factory()() as db:
        result = seed(db)
    print(f"Datos demo listos: {result}. Usuarios @{DOMAIN}; contraseña demo documentada en docs/DEMO.md (rotarla si se expone).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
