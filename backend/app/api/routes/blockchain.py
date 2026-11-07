from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.blockchain.client import blockchain_client
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.blockchain import BlockchainStatusResponse
from app.schemas.evidence import TransactionResponse

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


@router.get("/status", response_model=BlockchainStatusResponse)
def get_blockchain_status():
    """
    Returns blockchain connectivity diagnostic:
    RPC connection, chain ID, contract address, accessibility, and latest block.
    """
    status_info = blockchain_client.get_status()
    return BlockchainStatusResponse(**status_info)


@router.get("/transactions", response_model=List[TransactionResponse])
def get_all_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lists application-specific blockchain transactions recorded in the system."""
    offset = (page - 1) * page_size
    transactions = (
        db.query(Transaction)
        .order_by(Transaction.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return [TransactionResponse.model_validate(tx) for tx in transactions]


@router.get("/transactions/{transaction_hash}")
def get_transaction_detail(
    transaction_hash: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieves transaction confirmation receipt from the blockchain and local database."""
    tx_record = (
        db.query(Transaction)
        .filter(Transaction.transaction_hash.ilike(transaction_hash))
        .first()
    )

    on_chain_receipt = None
    if blockchain_client.is_connected():
        try:
            on_chain_receipt = blockchain_client.wait_for_receipt(transaction_hash, timeout=5)
        except Exception:
            pass

    return {
        "transaction_hash": transaction_hash,
        "recorded": tx_record is not None,
        "evidence_id": tx_record.evidence_id if tx_record else None,
        "transaction_type": tx_record.transaction_type if tx_record else None,
        "database_status": tx_record.status if tx_record else None,
        "on_chain_receipt": on_chain_receipt,
    }


@router.get("/evidence/{evidence_id}")
def get_blockchain_evidence_state(
    evidence_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Directly queries the smart contract on the blockchain for the authoritative evidence record."""
    if not blockchain_client.is_connected():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Blockchain RPC endpoint is currently unreachable",
        )
    try:
        on_chain = blockchain_client.get_evidence(evidence_id)
        if not on_chain.get("exists"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Evidence '{evidence_id}' does not exist on the smart contract",
            )
        return on_chain
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Smart contract read failed: {str(e)}",
        )
