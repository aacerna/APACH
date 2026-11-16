from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record(db: Session, actor: User | None, action: str, entity_type: str, entity_id=None, **details) -> None:
    db.add(AuditEvent(actor_id=actor.id if actor else None, action=action, entity_type=entity_type,
                      entity_id=str(entity_id) if entity_id is not None else None, details=details))
