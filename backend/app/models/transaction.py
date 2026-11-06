import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class TransactionType(str, enum.Enum):
    REGISTRATION = "REGISTRATION"
    TRANSFER = "TRANSFER"


class TransactionStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    evidence_id = Column(
        String(64),
        ForeignKey("evidence.evidence_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_hash = Column(String(66), unique=True, index=True, nullable=False)
    transaction_type = Column(
        Enum(TransactionType, name="transaction_types", native_enum=False),
        nullable=False,
        index=True,
    )
    block_number = Column(Integer, nullable=True, index=True)
    from_address = Column(String(42), nullable=True)
    to_address = Column(String(42), nullable=True)
    status = Column(
        Enum(TransactionStatus, name="transaction_statuses", native_enum=False),
        nullable=False,
        default=TransactionStatus.CONFIRMED,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    evidence = relationship("Evidence", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction hash='{self.transaction_hash}' type='{self.transaction_type}' status='{self.status}'>"

