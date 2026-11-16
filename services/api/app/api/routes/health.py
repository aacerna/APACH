from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.apa_engine.engine import RULE_SET_VERSION
from app.core.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health/live")
def live():
    return {"status": "ok"}


@router.get("/health")
def health(response: Response, db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        revision = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        return {"status": "ok", "database": "ok", "migration": revision, "rule_set_version": RULE_SET_VERSION}
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "database": "unavailable"}
