import json

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def record(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str = "",
    user: User | None = None,
    metadata: dict | None = None,
) -> None:
    entry = AuditLog(
        user_id=user.id if user else None,
        role=user.role if user else "",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata_json=json.dumps(metadata or {}, default=str),
    )
    db.add(entry)
