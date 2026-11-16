from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.models import (
    Course,
    Enrollment,
    Role,
    Section,
    SystemSetting,
    TemplateLink,
    User,
)
from app.schemas import PublicSettingsOut, TemplateOut

router = APIRouter(tags=["public"])


def template_out(t: TemplateLink) -> TemplateOut:
    return TemplateOut(id=t.id, name=t.name, description=t.description, program_id=t.program_id,
                       program_name=t.program.name if t.program else None, template_type=t.template_type, url=t.url,
                       active=t.active, updated_by=t.updated_by.full_name if t.updated_by else None, updated_at=t.updated_at)


def read_settings(db: Session) -> dict:
    s = get_settings()
    stored = {row.key: row.value.get("value") for row in db.scalars(select(SystemSetting))}
    return {
        "institutional_contact": stored.get("institutional_contact") or s.institutional_contact,
        "welcome_video_url": stored.get("welcome_video_url") or s.welcome_video_url or None,
    }


@router.get("/settings/public", response_model=PublicSettingsOut)
def public_settings(db: Session = Depends(get_db)):
    values = read_settings(db)
    return PublicSettingsOut(**values, ecc_guide_status="PENDIENTE", environment=get_settings().env)


@router.get("/templates", response_model=list[TemplateOut])
def templates(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(TemplateLink).options(selectinload(TemplateLink.program), selectinload(TemplateLink.updated_by)) \
        .where(TemplateLink.active.is_(True))
    if user.role == Role.STUDENT:
        program_ids = select(Course.program_id).join(Section, Section.course_id == Course.id) \
            .join(Enrollment, Enrollment.section_id == Section.id).where(Enrollment.student_id == user.id)
        conditions = [TemplateLink.program_id.is_(None), TemplateLink.program_id.in_(program_ids)]
        if user.program_id:
            conditions.append(TemplateLink.program_id == user.program_id)
        stmt = stmt.where(or_(*conditions))
    return [template_out(t) for t in db.scalars(stmt.order_by(TemplateLink.name)).all()]

