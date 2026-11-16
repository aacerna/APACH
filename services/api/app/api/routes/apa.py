from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, not_found
from app.core.db import get_db
from app.models import ApaRule, User
from app.schemas import RuleOut
from app.services import content

router = APIRouter(prefix="/apa", tags=["apa"])


@router.get("/rules", response_model=list[RuleOut])
def rules(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(ApaRule).order_by(ApaRule.scope, ApaRule.code)).all()


@router.get("/guides")
def list_guides():
    """Contenido educativo público (el mismo JSON empaquetado offline en el frontend)."""
    return [{k: g[k] for k in ("slug", "title", "category", "summary", "version")} for g in content.guides()]


@router.get("/guides/{slug}")
def guide(slug: str):
    g = content.guide_by_slug(slug)
    if g is None:
        raise not_found("Guía")
    return g
