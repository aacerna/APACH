from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models import (
    AcademicTerm,
    Course,
    Enrollment,
    Program,
    Section,
    TeacherAssignment,
    User,
)
from app.schemas import CourseOut, ProgramOut, SectionOut, TermOut
from app.services import access

router = APIRouter(tags=["catalog"])


def section_out(db: Session, s: Section, with_counts: bool = False) -> SectionOut:
    teachers = db.scalars(select(User).join(TeacherAssignment, TeacherAssignment.teacher_id == User.id)
                          .where(TeacherAssignment.section_id == s.id).order_by(User.last_name)).all()
    count = None
    if with_counts:
        count = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.section_id == s.id))
    return SectionOut(id=s.id, code=s.code, active=s.active, course=CourseOut.model_validate(s.course),
                      term=TermOut.model_validate(s.term), teachers=[t.full_name for t in teachers], student_count=count)


@router.get("/programs", response_model=list[ProgramOut])
def programs(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Program).order_by(Program.name)).all()


@router.get("/terms", response_model=list[TermOut])
def terms(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(AcademicTerm).order_by(AcademicTerm.start_date.desc())).all()


@router.get("/courses", response_model=list[CourseOut])
def courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    section_scope = access.scope_sections(select(Section.course_id), user)
    stmt = select(Course).options(selectinload(Course.program)).where(Course.id.in_(section_scope)).order_by(Course.code)
    return db.scalars(stmt).all()


@router.get("/sections", response_model=list[SectionOut])
def sections(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = access.scope_sections(select(Section), user).options(
        selectinload(Section.course).selectinload(Course.program), selectinload(Section.term)).order_by(Section.id)
    return [section_out(db, s) for s in db.scalars(stmt).all()]
