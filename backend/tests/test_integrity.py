import hashlib
import io
import uuid
from datetime import datetime, timezone
import pytest
from app.blockchain.client import blockchain_client
from app.services.storage_service import storage_service


@pytest.fixture
def mock_blockchain_integrity(monkeypatch):
    """Mocks blockchain get_evidence and verify_evidence methods."""
    stored_original_hashes = {}

    def fake_register(evidence_id, sha256_hex, initial_custodian_address):
        stored_original_hashes[evidence_id] = sha256_hex.lower()
        return {
            "transaction_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}",
            "block_number": 20,
            "gas_used": 110000,
            "status": 1,
        }

    def fake_get_evidence(evidence_id):
        orig_hash = stored_original_hashes.get(evidence_id, "0x" + "0" * 64)
        return {
            "evidence_id": evidence_id,
            "original_sha256": orig_hash,
            "registration_timestamp": 1700000000,
            "initial_custodian": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "current_custodian": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "exists": True,
        }

    def fake_verify_evidence(evidence_id, supplied_hash_hex):
        orig_hash = stored_original_hashes.get(evidence_id, "0x" + "0" * 64)
        matches = supplied_hash_hex.lower() == orig_hash.lower()
        return matches, orig_hash

    monkeypatch.setattr(blockchain_client, "register_evidence", fake_register)
    monkeypatch.setattr(blockchain_client, "get_evidence", fake_get_evidence)
    monkeypatch.setattr(blockchain_client, "verify_evidence", fake_verify_evidence)
    monkeypatch.setattr(blockchain_client, "contract_address", "0x5FbDB2315678afecb367f032d93F642f64180aa3")


@pytest.fixture
def registered_evidence(client, collector_token, test_collector_user, mock_blockchain_integrity):
    headers = {"Authorization": f"Bearer {collector_token}"}
    file_content = b"ORIGINAL UNTAMPERED EVIDENCE PAYLOAD DATA"

    resp = client.post(
        "/api/evidence",
        data={
            "title": "Integrity Test Evidence",
            "category": "DOCUMENT",
            "case_number": "CASE-INTEGRITY-01",
            "collection_location": "Lab Vault",
            "collection_datetime": datetime.now(timezone.utc).isoformat(),
            "initial_custodian_id": test_collector_user.id,
        },
        files={"file": ("vault_doc.pdf", io.BytesIO(file_content), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()


def test_verify_integrity_matching_file_success(
    client, collector_token, registered_evidence, mock_blockchain_integrity
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    evidence_id = registered_evidence["evidence_id"]

    resp = client.post(f"/api/evidence/{evidence_id}/verify", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["evidence_id"] == evidence_id
    assert data["status"] == "INTEGRITY_VERIFIED"
    assert data["is_valid"] is True
    assert data["match"] is True
    assert data["calculated_sha256"] == registered_evidence["original_sha256"]
    assert data["blockchain_sha256"] == registered_evidence["original_sha256"]
    assert "verified" in data["message"].lower()


def test_tamper_detection_mismatch_warning(
    client, collector_token, registered_evidence, mock_blockchain_integrity
):
    """
    CRITICAL TAMPER DETECTION TEST:
    Modifies physical file bytes on disk, triggers verification, and proves:
    1. System detects mismatch and generates INTEGRITY_WARNING.
    2. Result is logged in integrity_checks table as MISMATCH.
    3. The original on-chain hash remains completely immutable and unchanged.
    4. Operational dashboard reflects the integrity warning.
    """
    headers = {"Authorization": f"Bearer {collector_token}"}
    evidence_id = registered_evidence["evidence_id"]
    storage_filename = registered_evidence["storage_filename"]
    original_on_chain_hash = registered_evidence["original_sha256"]

    # 1. Tamper with the file on disk (corrupt/modify content)
    file_path = storage_service.get_file_path(storage_filename)
    assert file_path.exists()
    file_path.write_bytes(b"MALICIOUSLY TAMPERED AND MODIFIED EVIDENCE CONTENT!!!")

    # 2. Invoke verify endpoint
    resp = client.post(f"/api/evidence/{evidence_id}/verify", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    # 3. Verify mismatch detection
    assert data["status"] == "INTEGRITY_WARNING"
    assert data["is_valid"] is False
    assert data["match"] is False
    assert data["calculated_sha256"] != original_on_chain_hash
    assert data["blockchain_sha256"] == original_on_chain_hash  # On-chain hash preserved
    assert "mismatch" in data["message"].lower()

    # 4. Check historical integrity checks endpoint
    history_resp = client.get(f"/api/evidence/{evidence_id}/integrity-checks", headers=headers)
    assert history_resp.status_code == 200
    checks = history_resp.json()
    assert len(checks) >= 1
    assert checks[0]["result"] == "MISMATCH"

    # 5. Verify Dashboard reflects the warning
    stats_resp = client.get("/api/dashboard/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["integrity_warnings"] >= 1


def test_verify_integrity_missing_file(
    client, collector_token, registered_evidence, mock_blockchain_integrity
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    evidence_id = registered_evidence["evidence_id"]
    storage_filename = registered_evidence["storage_filename"]

    # Delete physical file from disk
    file_path = storage_service.get_file_path(storage_filename)
    if file_path.exists():
        file_path.unlink()

    resp = client.post(f"/api/evidence/{evidence_id}/verify", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "FILE_UNAVAILABLE"
    assert data["is_valid"] is False
    assert "missing" in data["message"].lower()

