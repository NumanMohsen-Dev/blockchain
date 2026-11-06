from typing import Optional
from pydantic import BaseModel


class BlockchainStatusResponse(BaseModel):
    connected: bool
    chain_id: Optional[int] = None
    latest_block_number: Optional[int] = None
    rpc_url: str
    contract_address: Optional[str] = None
    contract_accessible: bool

