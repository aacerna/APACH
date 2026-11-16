from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import not_found, require_roles
from app.api.routes.catalog import section_out
from app.api.routes.documents import latest_run
from app.core.db import get_db
from app.models import Course, Document, Enrollment, ReviewStatus, Role, Section, User
from app.services import access

router = APIRouter(prefix="/teacher", tags=["teacher"])


def _section_stats(db: Session, section_id: int) -> dict:
    docs = db.scalars(select(Document).where(Document.section_id == section_id)).all()
    by_rule: Counter = Counter()
    verified, possible, unverifiable = Counter(), Counter(), Counter()
    for d in docs:
        run = latest_run(db, d.id)
        if run is None:
            continue
        for f in run.findings:
            by_rule[f.rule_code] += 1
            if f.verification_status.value != "CHECKED":
                unverifiable[f.rule_code] += 1
            elif f.severity.value == "ERROR":
                verified[f.rule_code] += 1
            else:
                possible[f.rule_code] += 1
    students = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.section_id == section_id))
    return {
        "students": students,
        "documents": len(docs),
        "reviewed": sum(1 for d in docs if d.review_status == ReviewStatus.REVIEWED),
        "pending": sum(1 for d in docs if d.review_status == ReviewStatus.PENDING),
        "students_with_documents": len({d.student_id for d in docs}),
        "findings_by_rule": [
            {"rule_code": code, "verified_errors": verified[code], "possible_or_teacher": possible[code],
             "not_verifiable": unverifiable[code]} for code in sorted(by_rule)
        ],
        "disclaimer": "Indicadores orientativos: no equivalen a una nota ni a una evaluación académica integral.",
    }


@router.get("/sections")
def my_sections(user: User = Depends(require_roles(Role.TEACHER)), db: Session = Depends(get_db)):
    stmt = select(Section).where(Section.id.in_(access.teacher_section_ids(user.id))).options(
        selectinload(Section.course).selectinload(Course.program), selectinload(Section.term))
    return [{"section": section_out(db, s, with_counts=True), "stats": _section_stats(db, s.id)}
            for s in db.scalars(stmt.order_by(Section.id)).all()]


@router.get("/sections/{section_id}/students")
def section_students(section_id: int, user: User = Depends(require_roles(Role.TEACHER)), db: Session = Depends(get_db)):
    if not access.is_teacher_of(db, user.id, section_id):
        raise not_found("Sección")
    rows = db.execute(select(User).join(Enrollment, Enrollment.student_id == User.id)
                      .where(Enrollment.section_id == section_id).order_by(User.last_name)).scalars().all()
    result = []
    for s in rows:
        count = db.scalar(select(func.count()).select_from(Document).where(
            Document.student_id == s.id, Document.section_id == section_id))
        result.append({"id": s.id, "full_name": s.full_name, "email": s.email, "is_active": s.is_active, "documents": count})
    return result
