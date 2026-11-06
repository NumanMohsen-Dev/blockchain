import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from eth_account import Account
from web3 import Web3
from web3.exceptions import ContractLogicError, TransactionNotFound
from app.core.config import settings

logger = logging.getLogger(__name__)


class BlockchainClient:
    def __init__(self):
        self.rpc_url = settings.HARDHAT_RPC_URL
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contract = None
        self.contract_address: Optional[str] = None
        self.contract_abi: Optional[List[Dict[str, Any]]] = None
        self._load_contract_info()

    def _load_contract_info(self):
        """Attempts to load contract address and ABI from disk or settings."""
        # Check settings first
        if settings.CONTRACT_ADDRESS and Web3.is_address(settings.CONTRACT_ADDRESS):
            self.contract_address = Web3.to_checksum_address(settings.CONTRACT_ADDRESS)

        # Look in known contract_info.json paths
        potential_paths = [
            Path(settings.CONTRACT_ABI_PATH),
            Path(__file__).parent / "contract_info.json",
            Path(__file__).parent.parent.parent.parent / "blockchain" / "deployments" / "contract_info.json",
        ]

        for path in potential_paths:
            if path.exists():
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if not self.contract_address and data.get("address"):
                            self.contract_address = Web3.to_checksum_address(data["address"])
                        if data.get("abi"):
                            self.contract_abi = data["abi"]
                        logger.info(f"Loaded contract configuration from {path}")
                        break
                except Exception as e:
                    logger.warning(f"Failed to read contract artifact at {path}: {e}")

        # Initialize contract if both address and abi are available
        if self.is_connected() and self.contract_address and self.contract_abi:
            try:
                self.contract = self.w3.eth.contract(
                    address=self.contract_address,
                    abi=self.contract_abi,
                )
            except Exception as e:
                logger.error(f"Failed to instantiate contract: {e}")

    def refresh_connection(self):
        """Re-initializes provider and reloads contract artifact."""
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self._load_contract_info()

    def is_connected(self) -> bool:
        """Returns True if Hardhat RPC endpoint is reachable."""
        try:
            return self.w3.is_connected()
        except Exception:
            return False

    def get_chain_id(self) -> Optional[int]:
        if not self.is_connected():
            return None
        try:
            return self.w3.eth.chain_id
        except Exception:
            return None

    def get_latest_block_number(self) -> Optional[int]:
        if not self.is_connected():
            return None
        try:
            return self.w3.eth.block_number
        except Exception:
            return None

    def get_status(self) -> Dict[str, Any]:
        """Provides status diagnostic for /api/blockchain/status."""
        connected = self.is_connected()
        if connected and (not self.contract or not self.contract_address):
            self._load_contract_info()

        chain_id = self.get_chain_id() if connected else None
        block_number = self.get_latest_block_number() if connected else None
        contract_accessible = False

        if connected and self.contract and self.contract_address:
            try:
                # Call view function owner() to test responsiveness
                owner = self.contract.functions.owner().call()
                contract_accessible = bool(owner)
            except Exception as e:
                logger.debug(f"Contract accessibility test failed: {e}")
                contract_accessible = False

        return {
            "connected": connected,
            "chain_id": chain_id,
            "latest_block_number": block_number,
            "rpc_url": self.rpc_url,
            "contract_address": self.contract_address,
            "contract_accessible": contract_accessible,
        }

    def _get_relayer_account(self):
        """Returns the local development relayer signer account."""
        return Account.from_key(settings.DEVELOPMENT_SIGNER_PRIVATE_KEY)

    def _send_transaction(self, build_tx_fn) -> str:
        """Helper to build, sign, and send a transaction using development relayer."""
        if not self.is_connected():
            raise ConnectionError("Blockchain RPC is not reachable")
        if not self.contract:
            raise ValueError("Contract is not initialized or accessible")

        relayer = self._get_relayer_account()
        nonce = self.w3.eth.get_transaction_count(relayer.address)
        chain_id = self.w3.eth.chain_id

        tx_params = {
            "from": relayer.address,
            "nonce": nonce,
            "chainId": chain_id,
            "gas": 1000000,
            "gasPrice": self.w3.eth.gas_price,
        }

        raw_tx = build_tx_fn(tx_params)
        signed_tx = self.w3.eth.account.sign_transaction(
            raw_tx, private_key=relayer.key
        )
        raw_bytes = getattr(signed_tx, "raw_transaction", None) or getattr(signed_tx, "rawTransaction", None)
        tx_hash = self.w3.eth.send_raw_transaction(raw_bytes)
        return self.w3.to_hex(tx_hash)

    def wait_for_receipt(self, tx_hash: str, timeout: int = 60) -> Dict[str, Any]:
        """Waits for transaction inclusion and returns receipt dict."""
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=timeout)
        return {
            "transaction_hash": self.w3.to_hex(receipt["transactionHash"]),
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
            "status": receipt["status"],  # 1 for success, 0 for revert
        }

    # High-level Contract Interaction Methods

    def register_evidence(
        self,
        evidence_id: str,
        sha256_hex: str,
        initial_custodian_address: str,
    ) -> Dict[str, Any]:
        """Submits registerEvidence transaction on-chain."""
        hash_clean = sha256_hex.lower().replace("0x", "")
        hash_bytes = bytes.fromhex(hash_clean)
        custodian_chk = Web3.to_checksum_address(initial_custodian_address)

        tx_hash = self._send_transaction(
            lambda params: self.contract.functions.registerEvidence(
                evidence_id,
                hash_bytes,
                custodian_chk,
            ).build_transaction(params)
        )
        receipt = self.wait_for_receipt(tx_hash)
        if receipt["status"] != 1:
            raise RuntimeError(f"Transaction reverted: {tx_hash}")
        return receipt

    def transfer_custody(
        self,
        evidence_id: str,
        expected_custodian_address: str,
        new_custodian_address: str,
        reason: str,
    ) -> Dict[str, Any]:
        """Submits transferCustodyByRelayer transaction on-chain."""
        expected_chk = Web3.to_checksum_address(expected_custodian_address)
        new_chk = Web3.to_checksum_address(new_custodian_address)

        tx_hash = self._send_transaction(
            lambda params: self.contract.functions.transferCustodyByRelayer(
                evidence_id,
                expected_chk,
                new_chk,
                reason,
            ).build_transaction(params)
        )
        receipt = self.wait_for_receipt(tx_hash)
        if receipt["status"] != 1:
            raise RuntimeError(f"Transfer transaction reverted: {tx_hash}")
        return receipt

    def get_evidence(self, evidence_id: str) -> Dict[str, Any]:
        """Reads evidence record from smart contract."""
        if not self.contract:
            raise ValueError("Contract is not loaded")
        (
            file_hash_bytes,
            reg_timestamp,
            init_custodian,
            curr_custodian,
            exists,
        ) = self.contract.functions.getEvidence(evidence_id).call()

        return {
            "evidence_id": evidence_id,
            "original_sha256": "0x" + file_hash_bytes.hex(),
            "registration_timestamp": reg_timestamp,
            "initial_custodian": init_custodian,
            "current_custodian": curr_custodian,
            "exists": exists,
        }

    def verify_evidence(self, evidence_id: str, sha256_hex: str) -> Tuple[bool, str]:
        """Calls verifyEvidenceRecord on smart contract."""
        if not self.contract:
            raise ValueError("Contract is not loaded")
        hash_clean = sha256_hex.lower().replace("0x", "")
        hash_bytes = bytes.fromhex(hash_clean)
        matches, original_bytes = self.contract.functions.verifyEvidenceRecord(
            evidence_id, hash_bytes
        ).call()
        return matches, "0x" + original_bytes.hex()

    def get_custody_history(self, evidence_id: str) -> List[Dict[str, Any]]:
        """Reads chronological custody transfer history directly from the contract."""
        if not self.contract:
            raise ValueError("Contract is not loaded")
        raw_history = self.contract.functions.getCustodyHistory(evidence_id).call()
        history = []
        for item in raw_history:
            history.append({
                "previous_custodian": item[0],
                "new_custodian": item[1],
                "timestamp": item[2],
                "reason": item[3],
            })
        return history


blockchain_client = BlockchainClient()

