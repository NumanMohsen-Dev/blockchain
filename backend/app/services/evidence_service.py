import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.blockchain.client import blockchain_client
from app.models.evidence import Evidence, EvidenceCategory, RegistrationStatus
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.services.audit_service import AuditService
from app.services.storage_service import storage_service

logger = logging.getLogger(__name__)


class EvidenceService:
    @staticmethod
    def generate_evidence_id(db: Session) -> str:
        """Generates a collision-resistant unique evidence ID."""
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        while True:
            suffix = uuid.uuid4().hex[:8].upper()
            candidate_id = f"EVID-{date_str}-{suffix}"
            exists = db.query(Evidence).filter(Evidence.evidence_id == candidate_id).first()
            if not exists:
                return candidate_id

    @staticmethod
    async def register_evidence(
        db: Session,
        title: str,
        description: Optional[str],
        category: EvidenceCategory,
        case_number: str,
        collection_location: str,
        collection_datetime: datetime,
        initial_custodian_id: int,
        upload_file: UploadFile,
        current_user: User,
    ) -> Evidence:
        """
        Coordinates full evidence registration workflow:
        1. Validates initial custodian.
        2. Generates unique evidence ID.
        3. Saves uploaded file and calculates SHA-256.
        4. Submits registerEvidence transaction on the blockchain.
        5. Persists metadata and transaction records on confirmation.
        """
        # Validate initial custodian exists and is active
        custodian = db.query(User).filter(User.id == initial_custodian_id).first()
        if not custodian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Initial custodian with ID {initial_custodian_id} not found",
            )
        if not custodian.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Custodian '{custodian.full_name}' is currently deactivated",
            )
        if not custodian.blockchain_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Custodian '{custodian.full_name}' has no registered blockchain address",
            )

        evidence_id = EvidenceService.generate_evidence_id(db)

        # Step 1: Save file and stream SHA-256 hash
        storage_filename, sha256_hex, file_size, mime_type = (
            await storage_service.save_evidence_file(upload_file)
        )

        # Step 2: Create initial PENDING database record
        evidence = Evidence(
            evidence_id=evidence_id,
            title=title,
            description=description,
            category=category,
            case_number=case_number,
            collection_location=collection_location,
            collection_datetime=collection_datetime,
            original_filename=upload_file.filename or "unknown_file",
            storage_filename=storage_filename,
            mime_type=mime_type,
            file_size=file_size,
            original_sha256=sha256_hex,
            initial_custodian_id=custodian.id,
            current_custodian_id=custodian.id,
            registration_status=RegistrationStatus.PENDING,
            created_by=current_user.id,
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)

        # Step 3: Submit smart contract transaction on-chain
        try:
            receipt = blockchain_client.register_evidence(
                evidence_id=evidence_id,
                sha256_hex=sha256_hex,
                initial_custodian_address=custodian.blockchain_address,
            )

            # Step 4: Update record with on-chain confirmation details
            evidence.registration_status = RegistrationStatus.CONFIRMED
            evidence.blockchain_transaction_hash = receipt["transaction_hash"]
            evidence.blockchain_block_number = receipt["block_number"]

            # Record transaction reference
            tx_record = Transaction(
                evidence_id=evidence_id,
                transaction_hash=receipt["transaction_hash"],
                transaction_type=TransactionType.REGISTRATION,
                block_number=receipt["block_number"],
                to_address=blockchain_client.contract_address,
                status=TransactionStatus.CONFIRMED,
            )
            db.add(tx_record)

            # Record audit log
            AuditService.log(
                db=db,
                user_id=current_user.id,
                action="EVIDENCE_REGISTERED",
                resource_type="evidence",
                resource_id=evidence_id,
                description=f"Registered evidence '{evidence.title}' with hash {sha256_hex}",
                commit=False,
            )

            db.commit()
            db.refresh(evidence)
            return evidence

        except Exception as e:
            logger.error(f"Blockchain registration failed for {evidence_id}: {e}")
            evidence.registration_status = RegistrationStatus.FAILED
            db.commit()

            # Clean up stored file to avoid orphaned storage files
            storage_service.delete_file(storage_filename)

            AuditService.log(
                db=db,
                user_id=current_user.id,
                action="EVIDENCE_REGISTRATION_FAILED",
                resource_type="evidence",
                resource_id=evidence_id,
                description=f"Registration failed: {str(e)}",
            )

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Blockchain transaction failed or reverted: {str(e)}",
            )

    @staticmethod
    def get_by_evidence_id(db: Session, evidence_id: str) -> Optional[Evidence]:
        """Fetches evidence by unique evidence_id."""
        return db.query(Evidence).filter(Evidence.evidence_id == evidence_id).first()

    @staticmethod
    def list_evidence(
        db: Session,
        search: Optional[str] = None,
        category: Optional[EvidenceCategory] = None,
        case_number: Optional[str] = None,
        custodian_id: Optional[int] = None,
        status_filter: Optional[RegistrationStatus] = None,
        page: int = 1,
        page_size: int = 10,
    ) -> Tuple[List[Evidence], int]:
        """Returns paginated, filtered list of evidence records and total count."""
        query = db.query(Evidence)

        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Evidence.title.ilike(search_pattern),
                    Evidence.description.ilike(search_pattern),
                    Evidence.case_number.ilike(search_pattern),
                    Evidence.evidence_id.ilike(search_pattern),
                )
            )

        if category:
            query = query.filter(Evidence.category == category)

        if case_number:
            query = query.filter(Evidence.case_number == case_number)

        if custodian_id:
            query = query.filter(Evidence.current_custodian_id == custodian_id)

        if status_filter:
            query = query.filter(Evidence.registration_status == status_filter)

        total = query.count()
        offset = (page - 1) * page_size
        items = query.order_by(Evidence.created_at.desc()).offset(offset).limit(page_size).all()

        return items, total

    @staticmethod
    def get_evidence_transactions(db: Session, evidence_id: str) -> List[Transaction]:
        """Retrieves all transaction references recorded for this evidence."""
        return (
            db.query(Transaction)
            .filter(Transaction.evidence_id == evidence_id)
            .order_by(Transaction.created_at.desc())
            .all()
        )
