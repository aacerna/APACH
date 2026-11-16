"""Autorización por objeto. Los filtros se aplican en la consulta SQL, no en la UI."""
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models import Document, Enrollment, Role, Section, TeacherAssignment, User


def teacher_section_ids(teacher_id: int):
    return select(TeacherAssignment.section_id).where(TeacherAssignment.teacher_id == teacher_id)


def student_section_ids(student_id: int):
    return select(Enrollment.section_id).where(Enrollment.student_id == student_id)


def scope_documents(stmt: Select, user: User) -> Select:
    if user.role == Role.ADMIN:
        return stmt
    if user.role == Role.TEACHER:
        return stmt.where(Document.section_id.in_(teacher_section_ids(user.id)))
    return stmt.where(Document.student_id == user.id)


def scope_sections(stmt: Select, user: User) -> Select:
    if user.role == Role.ADMIN:
        return stmt
    if user.role == Role.TEACHER:
        return stmt.where(Section.id.in_(teacher_section_ids(user.id)))
    return stmt.where(Section.id.in_(student_section_ids(user.id)))


def get_document_for(db: Session, user: User, document_id: int) -> Document | None:
    stmt = scope_documents(select(Document).where(Document.id == document_id), user)
    return db.scalars(stmt).first()


def is_teacher_of(db: Session, teacher_id: int, section_id: int) -> bool:
    return db.scalar(select(TeacherAssignment.id).where(
        TeacherAssignment.teacher_id == teacher_id, TeacherAssignment.section_id == section_id)) is not None


def is_enrolled(db: Session, student_id: int, section_id: int) -> bool:
    return db.scalar(select(Enrollment.id).where(
        Enrollment.student_id == student_id, Enrollment.section_id == section_id)) is not None
