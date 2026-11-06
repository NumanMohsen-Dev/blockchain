from datetime import datetime
from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.evidence import Evidence, RegistrationStatus
from app.models.integrity_check import IntegrityCheck, IntegrityResult
from app.models.transaction import Transaction, TransactionType
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Provides key summary metrics for the operational dashboard."""
    total_evidence = (
        db.query(func.count(Evidence.id))
        .filter(Evidence.registration_status == RegistrationStatus.CONFIRMED)
        .scalar()
        or 0
    )

    my_custody = (
        db.query(func.count(Evidence.id))
        .filter(
            Evidence.current_custodian_id == current_user.id,
            Evidence.registration_status == RegistrationStatus.CONFIRMED,
        )
        .scalar()
        or 0
    )

    total_transfers = (
        db.query(func.count(Transaction.id))
        .filter(Transaction.transaction_type == TransactionType.TRANSFER)
        .scalar()
        or 0
    )

    integrity_warnings = (
        db.query(func.count(IntegrityCheck.id))
        .filter(IntegrityCheck.result == IntegrityResult.MISMATCH)
        .scalar()
        or 0
    )

    total_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0

    return {
        "total_evidence": total_evidence,
        "my_custody": my_custody,
        "total_transfers": total_transfers,
        "integrity_warnings": integrity_warnings,
        "total_users": total_users,
    }


@router.get("/recent-activity")
def get_recent_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """Returns the most recent system activity and audit events."""
    logs = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "description": log.description,
            "user_email": log.user.email if log.user else "System",
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return result

