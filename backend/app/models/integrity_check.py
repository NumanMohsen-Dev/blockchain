import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class IntegrityResult(str, enum.Enum):
    MATCH = "MATCH"
    MISMATCH = "MISMATCH"
    ERROR = "ERROR"


class IntegrityCheck(Base):
    __tablename__ = "integrity_checks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    evidence_id = Column(
        String(64),
        ForeignKey("evidence.evidence_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    calculated_hash = Column(String(66), nullable=False)
    blockchain_hash = Column(String(66), nullable=False)
    result = Column(
        Enum(IntegrityResult, name="integrity_results", native_enum=False),
        nullable=False,
        index=True,
    )
    checked_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    evidence = relationship("Evidence", back_populates="integrity_checks")
    checker = relationship("User", foreign_keys=[performed_by])

    def __repr__(self) -> str:
        return f"<IntegrityCheck evidence='{self.evidence_id}' result='{self.result}'>"

