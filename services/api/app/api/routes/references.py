"""Biblioteca de referencias. El formateo ocurre en el navegador (offline); aquí se persiste y sincroniza.

Conflictos: gana la versión con `updated_at` más reciente (last-write-wins), también para borrados (lápida).
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, not_found
from app.core.db import get_db
from app.models import ReferenceRecord, User
from app.schemas import ReferenceOut, ReferenceUpsertIn

router = APIRouter(prefix="/references", tags=["references"])
CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9\-]{8,64}$")
MAX_INPUT_BYTES = 20_000


def _out(r: ReferenceRecord) -> ReferenceOut:
    return ReferenceOut(client_id=r.client_id, source_type=r.source_type, input=r.input, output=r.output,
                        rules_version=r.rules_version, created_at=r.created_at, updated_at=r.updated_at,
                        deleted_at=r.deleted_at)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("", response_model=list[ReferenceOut])
def list_references(since: datetime | None = None, include_deleted: bool = False,
                    user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(ReferenceRecord).where(ReferenceRecord.owner_id == user.id)
    if since is not None:
        stmt = stmt.where(ReferenceRecord.updated_at > _aware(since))
    if not include_deleted and since is None:
        stmt = stmt.where(ReferenceRecord.deleted_at.is_(None))
    return [_out(r) for r in db.scalars(stmt.order_by(ReferenceRecord.updated_at.desc())).all()]


@router.put("/{client_id}", response_model=ReferenceOut)
def upsert_reference(client_id: str, payload: ReferenceUpsertIn, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    if not CLIENT_ID_RE.match(client_id):
        raise HTTPException(422, detail="Identificador de referencia inválido.")
    if len(str(payload.input)) > MAX_INPUT_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="La referencia es demasiado grande.")
    incoming = _aware(payload.updated_at)
    record = db.scalars(select(ReferenceRecord).where(ReferenceRecord.owner_id == user.id,
                                                      ReferenceRecord.client_id == client_id)).first()
    if record is None:
        record = ReferenceRecord(client_id=client_id, owner_id=user.id, created_at=incoming)
        db.add(record)
    elif _aware(record.updated_at) >= incoming:
        return _out(record)  # la versión del servidor es más reciente
    record.source_type = payload.source_type
    record.input = payload.input
    record.output = payload.output.model_dump()
    record.rules_version = payload.output.rules_version
    record.updated_at = incoming
    record.deleted_at = None
    db.commit()
    db.refresh(record)
    return _out(record)


@router.delete("/{client_id}", response_model=ReferenceOut)
def delete_reference(client_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.scalars(select(ReferenceRecord).where(ReferenceRecord.owner_id == user.id,
                                                      ReferenceRecord.client_id == client_id)).first()
    if record is None:
        raise not_found("Referencia")
    now = datetime.now(timezone.utc)
    record.deleted_at = now
    record.updated_at = now
    db.commit()
    db.refresh(record)
    return _out(record)
