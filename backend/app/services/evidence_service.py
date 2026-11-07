import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.blockchain.client import blockchain_client
from app.models.evidence import Evidence, EvidenceCategory, RegistrationStatus
from app.models.integrity_check import IntegrityCheck, IntegrityResult
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User, UserRole
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
    def transfer_custody(
        db: Session,
        evidence_id: str,
        new_custodian_id: int,
        reason: str,
        current_user: User,
    ) -> Dict[str, Any]:
        """
        Transfers custody of evidence:
        1. Verifies requester is current custodian or Administrator.
        2. Validates receiving user exists, is active, and is distinct from current custodian.
        3. Verifies current on-chain custody state.
        4. Submits transferCustodyByRelayer transaction on the smart contract.
        5. Updates cached database state and records transaction & audit log.
        """
        evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence '{evidence_id}' was not found",
            )

        if evidence.registration_status != RegistrationStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot transfer evidence with status '{evidence.registration_status}'",
            )

        # Authorization: current custodian or ADMIN
        if current_user.id != evidence.current_custodian_id and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the current custodian or a system administrator can transfer custody of this evidence",
            )

        # Validate target recipient
        new_custodian = db.query(User).filter(User.id == new_custodian_id).first()
        if not new_custodian:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Receiving user with ID {new_custodian_id} was not found",
            )

        if not new_custodian.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Receiving user '{new_custodian.full_name}' is deactivated",
            )

        if not new_custodian.blockchain_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Receiving user '{new_custodian.full_name}' does not have a registered blockchain address",
            )

        if new_custodian.id == evidence.current_custodian_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Receiving user is already the current custodian of this evidence",
            )

        if len(reason.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer reason must be at least 3 characters long",
            )

        # Query on-chain custody state to ensure authoritative synchronization
        try:
            on_chain = blockchain_client.get_evidence(evidence_id)
            expected_current_addr = on_chain["current_custodian"]
        except Exception as e:
            logger.error(f"Failed to query on-chain evidence state: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to read current on-chain custody state: {str(e)}",
            )

        previous_custodian = evidence.current_custodian
        previous_custodian_id = evidence.current_custodian_id

        # Submit transaction on-chain via Relayer
        try:
            receipt = blockchain_client.transfer_custody(
                evidence_id=evidence_id,
                expected_custodian_address=expected_current_addr,
                new_custodian_address=new_custodian.blockchain_address,
                reason=reason.strip(),
            )
        except Exception as e:
            logger.error(f"Custody transfer transaction failed on-chain: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Blockchain transfer transaction failed or reverted: {str(e)}",
            )

        # Update cached database custody
        evidence.current_custodian_id = new_custodian.id

        # Record transaction entry
        tx_record = Transaction(
            evidence_id=evidence_id,
            transaction_hash=receipt["transaction_hash"],
            transaction_type=TransactionType.TRANSFER,
            block_number=receipt["block_number"],
            from_address=expected_current_addr,
            to_address=new_custodian.blockchain_address,
            status=TransactionStatus.CONFIRMED,
        )
        db.add(tx_record)

        # Record audit log
        AuditService.log(
            db=db,
            user_id=current_user.id,
            action="CUSTODY_TRANSFERRED",
            resource_type="evidence",
            resource_id=evidence_id,
            description=(
                f"Custody of evidence '{evidence.title}' transferred from "
                f"'{previous_custodian.full_name}' to '{new_custodian.full_name}'. Reason: {reason.strip()}"
            ),
            commit=False,
        )

        db.commit()
        db.refresh(evidence)

        return {
            "evidence_id": evidence_id,
            "previous_custodian_id": previous_custodian_id,
            "previous_custodian": previous_custodian,
            "new_custodian_id": new_custodian.id,
            "new_custodian": new_custodian,
            "reason": reason.strip(),
            "transaction_hash": receipt["transaction_hash"],
            "block_number": receipt["block_number"],
            "transferred_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def get_custody_history(db: Session, evidence_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves the chronological custody transfer history directly from the smart contract,
        augmenting Ethereum addresses with application user profiles.
        """
        evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence '{evidence_id}' was not found",
            )

        raw_history = blockchain_client.get_custody_history(evidence_id)

        # Resolve user accounts by blockchain address
        users = db.query(User).all()
        addr_to_user = {u.blockchain_address.lower(): u for u in users if u.blockchain_address}

        timeline = []
        for item in raw_history:
            prev_addr = item["previous_custodian"]
            new_addr = item["new_custodian"]
            prev_user = addr_to_user.get(prev_addr.lower())
            new_user = addr_to_user.get(new_addr.lower())
            ts = item["timestamp"]

            timeline.append({
                "previous_custodian": prev_addr,
                "previous_custodian_user": prev_user,
                "new_custodian": new_addr,
                "new_custodian_user": new_user,
                "timestamp": ts,
                "datetime_utc": datetime.fromtimestamp(ts, tz=timezone.utc),
                "reason": item["reason"],
            })

        return timeline

    @staticmethod
    def verify_evidence_integrity(
        db: Session,
        evidence_id: str,
        current_user: User,
    ) -> Dict[str, Any]:
        """
        Performs cryptographic integrity verification:
        1. Reads physical stored file from persistent volume and calculates real-time SHA-256.
        2. Queries authoritative registered original hash from smart contract.
        3. Calls smart contract verifyEvidenceRecord for double cryptographic proof.
        4. Distinguishes MATCH (verified), MISMATCH (tampered/corrupted), or FILE_UNAVAILABLE.
        5. Persists the check record and audit log.
        """
        evidence = EvidenceService.get_by_evidence_id(db, evidence_id)
        if not evidence:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence '{evidence_id}' was not found",
            )

        # Check physical file availability
        try:
            calculated_sha256 = storage_service.calculate_file_sha256(evidence.storage_filename)
            file_available = True
        except HTTPException:
            file_available = False
            calculated_sha256 = "0x" + "0" * 64

        # Read authoritative hash directly from smart contract
        try:
            on_chain = blockchain_client.get_evidence(evidence_id)
            on_chain_hash = on_chain["original_sha256"]
        except Exception as e:
            logger.error(f"Failed to query on-chain hash for verification: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to read authoritative hash from smart contract: {str(e)}",
            )

        if not file_available:
            status_str = "FILE_UNAVAILABLE"
            result_enum = IntegrityResult.ERROR
            is_valid = False
            message = "Physical evidence file is missing from off-chain storage. Integrity cannot be verified."
        else:
            matches, _ = blockchain_client.verify_evidence(evidence_id, calculated_sha256)
            if matches:
                status_str = "INTEGRITY_VERIFIED"
                result_enum = IntegrityResult.MATCH
                is_valid = True
                message = "Cryptographic integrity verified. Stored file hash matches the immutable on-chain record."
            else:
                status_str = "INTEGRITY_WARNING"
                result_enum = IntegrityResult.MISMATCH
                is_valid = False
                message = (
                    "CRITICAL WARNING: Cryptographic hash mismatch! The stored file has been modified, corrupted, "
                    "or tampered with. It does not match the immutable blockchain registered hash."
                )

        # Persist check record
        check_record = IntegrityCheck(
            evidence_id=evidence_id,
            performed_by=current_user.id,
            calculated_hash=calculated_sha256,
            blockchain_hash=on_chain_hash,
            result=result_enum,
        )
        db.add(check_record)

        # Record audit log
        AuditService.log(
            db=db,
            user_id=current_user.id,
            action=status_str,
            resource_type="evidence",
            resource_id=evidence_id,
            description=message,
            commit=False,
        )

        db.commit()
        db.refresh(check_record)

        return {
            "evidence_id": evidence_id,
            "status": status_str,
            "is_valid": is_valid,
            "calculated_sha256": calculated_sha256,
            "blockchain_sha256": on_chain_hash,
            "match": is_valid,
            "performed_by": current_user,
            "checked_at": check_record.checked_at,
            "message": message,
        }

    @staticmethod
    def get_integrity_checks(db: Session, evidence_id: str) -> List[IntegrityCheck]:
        """Retrieves all historical integrity checks for the given evidence."""
        return (
            db.query(IntegrityCheck)
            .filter(IntegrityCheck.evidence_id == evidence_id)
            .order_by(IntegrityCheck.checked_at.desc())
            .all()
        )

    @staticmethod
    def get_evidence_transactions(db: Session, evidence_id: str) -> List[Transaction]:
        """Retrieves all transaction references recorded for this evidence."""
        return (
            db.query(Transaction)
            .filter(Transaction.evidence_id == evidence_id)
            .order_by(Transaction.created_at.desc())
            .all()
        )
