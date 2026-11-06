import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    def log(
        db: Session,
        action: str,
        resource_type: str,
        user_id: Optional[int] = None,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        commit: bool = True,
    ) -> Optional[AuditLog]:
        """Records an audit log entry in the database."""
        try:
            entry = AuditLog(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                description=description,
            )
            db.add(entry)
            if commit:
                db.commit()
                db.refresh(entry)
            else:
                db.flush()
            return entry
        except Exception as e:
            logger.error(f"Failed to record audit log: {e}")
            return None
