import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class EvidenceCategory(str, enum.Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    DOCUMENT = "DOCUMENT"
    OTHER = "OTHER"


class RegistrationStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    evidence_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(
        Enum(EvidenceCategory, name="evidence_categories", native_enum=False),
        nullable=False,
        index=True,
    )
    case_number = Column(String(100), nullable=False, index=True)
    collection_location = Column(String(255), nullable=False)
    collection_datetime = Column(DateTime(timezone=True), nullable=False)

    # File storage details
    original_filename = Column(String(255), nullable=False)
    storage_filename = Column(String(255), unique=True, nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)
    original_sha256 = Column(String(66), nullable=False, index=True)  # cached original hash

    # Custody references (cached application state, blockchain is authoritative)
    initial_custodian_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    current_custodian_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Lifecycle & Blockchain confirmation
    registration_status = Column(
        Enum(RegistrationStatus, name="registration_statuses", native_enum=False),
        nullable=False,
        default=RegistrationStatus.PENDING,
        index=True,
    )
    blockchain_transaction_hash = Column(String(66), nullable=True, index=True)
    blockchain_block_number = Column(Integer, nullable=True)

    # Audit & Timestamps
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    initial_custodian = relationship("User", foreign_keys=[initial_custodian_id])
    current_custodian = relationship("User", foreign_keys=[current_custodian_id])
    creator = relationship("User", foreign_keys=[created_by])
    transactions = relationship("Transaction", back_populates="evidence", cascade="all, delete-orphan")
    integrity_checks = relationship("IntegrityCheck", back_populates="evidence", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Evidence id={self.id} evidence_id='{self.evidence_id}' title='{self.title}' status='{self.registration_status}'>"

