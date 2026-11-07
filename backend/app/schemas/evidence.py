from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from app.models.evidence import EvidenceCategory, RegistrationStatus
from app.models.integrity_check import IntegrityResult
from app.models.transaction import TransactionStatus, TransactionType
from app.schemas.user import UserResponse


class EvidenceBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    category: EvidenceCategory
    case_number: str = Field(..., min_length=1, max_length=100)
    collection_location: str = Field(..., min_length=1, max_length=255)
    collection_datetime: datetime


class EvidenceCreateForm(EvidenceBase):
    initial_custodian_id: int


class EvidenceResponse(EvidenceBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evidence_id: str
    original_filename: str
    storage_filename: str
    mime_type: str
    file_size: int
    original_sha256: str
    initial_custodian_id: int
    current_custodian_id: int
    registration_status: RegistrationStatus
    blockchain_transaction_hash: Optional[str] = None
    blockchain_block_number: Optional[int] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    initial_custodian: Optional[UserResponse] = None
    current_custodian: Optional[UserResponse] = None
    on_chain_verified: Optional[bool] = None
    on_chain_current_custodian: Optional[str] = None


class EvidenceListResponse(BaseModel):
    items: List[EvidenceResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evidence_id: str
    transaction_hash: str
    transaction_type: TransactionType
    block_number: Optional[int] = None
    from_address: Optional[str] = None
    to_address: Optional[str] = None
    status: TransactionStatus
    created_at: datetime


class CustodyHistoryItem(BaseModel):
    previous_custodian: str
    previous_custodian_user: Optional[UserResponse] = None
    new_custodian: str
    new_custodian_user: Optional[UserResponse] = None
    timestamp: int
    datetime_utc: Optional[datetime] = None
    reason: str


class CustodyTransferRequest(BaseModel):
    new_custodian_id: int
    reason: str = Field(..., min_length=3, max_length=500)


class CustodyTransferResponse(BaseModel):
    evidence_id: str
    previous_custodian_id: int
    previous_custodian: Optional[UserResponse] = None
    new_custodian_id: int
    new_custodian: Optional[UserResponse] = None
    reason: str
    transaction_hash: str
    block_number: Optional[int] = None
    transferred_at: datetime


class IntegrityCheckResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    evidence_id: str
    performed_by: int
    checker: Optional[UserResponse] = None
    calculated_hash: str
    blockchain_hash: str
    result: IntegrityResult
    checked_at: datetime


class IntegrityVerificationResult(BaseModel):
    evidence_id: str
    status: str  # "INTEGRITY_VERIFIED", "INTEGRITY_WARNING", "FILE_UNAVAILABLE"
    is_valid: bool
    calculated_sha256: str
    blockchain_sha256: str
    match: bool
    performed_by: Optional[UserResponse] = None
    checked_at: datetime
    message: str
