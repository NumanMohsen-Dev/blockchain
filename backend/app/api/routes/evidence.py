import math
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_current_user, require_any_role
from app.blockchain.client import blockchain_client
from app.db.session import get_db
from app.models.evidence import EvidenceCategory, RegistrationStatus
from app.models.user import User, UserRole
from app.schemas.evidence import (
    CustodyHistoryItem,
    CustodyTransferRequest,
    CustodyTransferResponse,
    EvidenceListResponse,
    EvidenceResponse,
    IntegrityCheckResponse,
    IntegrityVerificationResult,
    TransactionResponse,
)
from app.services.audit_service import AuditService
from app.services.evidence_service import EvidenceService
from app.services.storage_service import storage_service

router = APIRouter(prefix="/evidence", tags=["Evidence Management"])


@router.post(
    "",
    response_model=EvidenceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_any_role([UserRole.EVIDENCE_COLLECTOR, UserRole.ADMIN]))],
)
async def register_evidence(
    file: UploadFile = File(..., description="Evidence payload file to upload"),
    title: str = Form(..., min_length=2, max_length=255),
    description: Optional[str] = Form(None, max_length=2000),
    category: EvidenceCategory = Form(...),
    case_number: str = Form(..., min_length=1, max_length=100),
    collection_location: str = Form(..., min_length=1, max_length=255),
    collection_datetime: datetime = Form(...),
    initial_custodian_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registers new digital evidence:
    - Calculates SHA-256 hash server-side.
    - Saves file securely off-chain in persistent volume.
    - Commits registerEvidence transaction to smart contract.
    - Records confirmed metadata, custodian, and blockchain transaction receipt.
    """
    evidence = await EvidenceService.register_evidence(
        db=db,
        title=title,
        description=description,
        category=category,
        case_number=case_number,
        collection_location=collection_location,
        collection_datetime=collection_datetime,
        initial_custodian_id=initial_custodian_id,
        upload_file=file,
        current_user=current_user,
    )
    return EvidenceResponse.model_validate(evidence)


@router.get("", response_model=EvidenceListResponse)
def list_evidence(
    search: Optional[str] = Query(None, description="Search keyword in title, description, case number, or evidence ID"),
    category: Optional[EvidenceCategory] = Query(None, description="Filter by evidence category"),
    case_number: Optional[str] = Query(None, description="Filter by exact case number"),
    custodian_id: Optional[int] = Query(None, description="Filter by current custodian user ID"),
    status_filter: Optional[RegistrationStatus] = Query(None, alias="status", description="Filter by registration status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists digital evidence with full-text search, multi-field filtering, and pagination."""
    items, total = EvidenceService.list_evidence(
        db=db,
        search=search,
        category=category,
        case_number=case_number,
        custodian_id=custodian_id,
        status_filter=status_filter,
        page=page,
        page_size=page_size,
    )

    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return EvidenceListResponse(
        items=[EvidenceResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence_detail(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves full evidence record, cross-referencing on-chain state to verify
    hash integrity and custodian synchronization.
    """
    evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence '{evidence_id}' was not found",
        )

    response = EvidenceResponse.model_validate(evidence)

    # Cross-reference with live smart contract if available
    try:
        on_chain = blockchain_client.get_evidence(evidence_id)
        if on_chain.get("exists"):
            response.on_chain_verified = (
                on_chain["original_sha256"].lower() == evidence.original_sha256.lower()
            )
            response.on_chain_current_custodian = on_chain["current_custodian"]
    except Exception:
        # Contract not loaded or offline; return cached DB metadata
        pass

    return response


@router.get("/{evidence_id}/download")
def download_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Streams the stored evidence file to authorized authenticated users.
    Logs each download access event in the application audit log.
    """
    evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence '{evidence_id}' was not found",
        )

    file_path = storage_service.get_file_path(evidence.storage_filename)

    # Record download in audit log
    AuditService.log(
        db=db,
        user_id=current_user.id,
        action="EVIDENCE_DOWNLOADED",
        resource_type="evidence",
        resource_id=evidence_id,
        description=f"User '{current_user.email}' downloaded file '{evidence.original_filename}'",
    )

    return FileResponse(
        path=file_path,
        filename=evidence.original_filename,
        media_type=evidence.mime_type,
    )


@router.post("/{evidence_id}/transfer", response_model=CustodyTransferResponse)
def transfer_custody(
    evidence_id: str,
    transfer_data: CustodyTransferRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Transfers custody of the specified evidence:
    - Enforces that requester is current custodian or system Administrator.
    - Submits transferCustody transaction to smart contract.
    - Waits for mined transaction receipt.
    - Updates cached database custodian reference and records transaction.
    """
    result = EvidenceService.transfer_custody(
        db=db,
        evidence_id=evidence_id,
        new_custodian_id=transfer_data.new_custodian_id,
        reason=transfer_data.reason,
        current_user=current_user,
    )
    return CustodyTransferResponse(**result)


@router.get("/{evidence_id}/history", response_model=List[CustodyHistoryItem])
def get_custody_history(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the authoritative, immutable chronological chain-of-custody transfer history
    directly from the smart contract on the blockchain.
    """
    return EvidenceService.get_custody_history(db, evidence_id)


@router.post("/{evidence_id}/verify", response_model=IntegrityVerificationResult)
def verify_integrity(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Performs real-time cryptographic integrity verification:
    - Calculates the current SHA-256 hash of the stored file on disk.
    - Compares against the immutable registered hash on the blockchain.
    - Confirms cryptographic match or raises integrity tampering warning.
    - Persists verification check record in database.
    """
    result = EvidenceService.verify_evidence_integrity(db, evidence_id, current_user)
    return IntegrityVerificationResult(**result)


@router.get("/{evidence_id}/integrity-checks", response_model=List[IntegrityCheckResponse])
def get_integrity_checks(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves all historical integrity checks performed for this evidence."""
    checks = EvidenceService.get_integrity_checks(db, evidence_id)
    return [IntegrityCheckResponse.model_validate(c) for c in checks]


@router.get("/{evidence_id}/transactions", response_model=List[TransactionResponse])
def get_evidence_transactions(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieves all blockchain transaction receipts linked to the given evidence."""
    evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence '{evidence_id}' was not found",
        )

    transactions = EvidenceService.get_evidence_transactions(db, evidence_id)
    return [TransactionResponse.model_validate(tx) for tx in transactions]
