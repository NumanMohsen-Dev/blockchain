import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.sql import func
from app.db.base import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    EVIDENCE_COLLECTOR = "EVIDENCE_COLLECTOR"
    INVESTIGATOR = "INVESTIGATOR"
    FORENSIC_ANALYST = "FORENSIC_ANALYST"
    COURT_REVIEWER = "COURT_REVIEWER"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(
        Enum(UserRole, name="user_roles", native_enum=False),
        nullable=False,
        default=UserRole.INVESTIGATOR,
        index=True,
    )
    blockchain_address = Column(String(42), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}' role='{self.role}' active={self.is_active}>"

