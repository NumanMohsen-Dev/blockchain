from fastapi import APIRouter
from app.blockchain.client import blockchain_client
from app.schemas.blockchain import BlockchainStatusResponse

router = APIRouter(prefix="/blockchain", tags=["Blockchain"])


@router.get("/status", response_model=BlockchainStatusResponse)
def get_blockchain_status():
    """
    Returns blockchain connectivity diagnostic:
    RPC connection, chain ID, contract address, accessibility, and latest block.
    """
    status_info = blockchain_client.get_status()
    return BlockchainStatusResponse(**status_info)

