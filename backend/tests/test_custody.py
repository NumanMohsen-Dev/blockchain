import io
import uuid
from datetime import datetime, timezone
import pytest
from app.blockchain.client import blockchain_client


@pytest.fixture
def mock_blockchain_custody(monkeypatch):
    """Mocks blockchain registration, transfer, and history methods."""
    def fake_register(evidence_id, sha256_hex, initial_custodian_address):
        return {
            "transaction_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}",
            "block_number": 10,
            "gas_used": 120000,
            "status": 1,
        }

    def fake_transfer(evidence_id, expected_custodian, new_custodian, reason):
        return {
            "transaction_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}",
            "block_number": 11,
            "gas_used": 95000,
            "status": 1,
        }

    def fake_get_evidence(evidence_id):
        return {
            "evidence_id": evidence_id,
            "original_sha256": "0x" + "a" * 64,
            "registration_timestamp": 1700000000,
            "initial_custodian": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "current_custodian": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "exists": True,
        }

    def fake_get_history(evidence_id):
        return [
            {
                "previous_custodian": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "new_custodian": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "timestamp": 1700000500,
                "reason": "Transferred for forensic analysis",
            }
        ]

    monkeypatch.setattr(blockchain_client, "register_evidence", fake_register)
    monkeypatch.setattr(blockchain_client, "transfer_custody", fake_transfer)
    monkeypatch.setattr(blockchain_client, "get_evidence", fake_get_evidence)
    monkeypatch.setattr(blockchain_client, "get_custody_history", fake_get_history)
    monkeypatch.setattr(blockchain_client, "contract_address", "0x5FbDB2315678afecb367f032d93F642f64180aa3")


@pytest.fixture
def created_evidence_id(client, collector_token, test_collector_user, mock_blockchain_custody):
    headers = {"Authorization": f"Bearer {collector_token}"}
    resp = client.post(
        "/api/evidence",
        data={
            "title": "Chain of Custody Test Item",
            "category": "DOCUMENT",
            "case_number": "CASE-CUSTODY-01",
            "collection_location": "Secured Storage A",
            "collection_datetime": datetime.now(timezone.utc).isoformat(),
            "initial_custodian_id": test_collector_user.id,
        },
        files={"file": ("evidence.pdf", io.BytesIO(b"evidence binary content"), "application/pdf")},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["evidence_id"]


def test_transfer_custody_by_current_custodian_success(
    client, collector_token, test_collector_user, test_investigator_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    payload = {
        "new_custodian_id": test_investigator_user.id,
        "reason": "Transferred to Lead Investigator for forensic disk imaging",
    }

    resp = client.post(f"/api/evidence/{created_evidence_id}/transfer", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["evidence_id"] == created_evidence_id
    assert data["previous_custodian_id"] == test_collector_user.id
    assert data["new_custodian_id"] == test_investigator_user.id
    assert "forensic disk imaging" in data["reason"]
    assert data["transaction_hash"].startswith("0x")
    assert data["block_number"] == 11

    # Verify cached custodian is updated in DB
    detail_resp = client.get(f"/api/evidence/{created_evidence_id}", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["current_custodian_id"] == test_investigator_user.id


def test_transfer_custody_by_admin_success(
    client, admin_token, test_investigator_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "new_custodian_id": test_investigator_user.id,
        "reason": "Administrative custody reassignment",
    }

    resp = client.post(f"/api/evidence/{created_evidence_id}/transfer", json=payload, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["new_custodian_id"] == test_investigator_user.id


def test_transfer_custody_unauthorized_user_rejected(
    client, court_token, test_investigator_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {court_token}"}
    payload = {
        "new_custodian_id": test_investigator_user.id,
        "reason": "Unauthorized transfer attempt",
    }

    resp = client.post(f"/api/evidence/{created_evidence_id}/transfer", json=payload, headers=headers)
    assert resp.status_code == 403
    assert "current custodian" in resp.json()["detail"].lower()


def test_transfer_custody_to_same_custodian_rejected(
    client, collector_token, test_collector_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    payload = {
        "new_custodian_id": test_collector_user.id,  # Same custodian
        "reason": "Self transfer",
    }

    resp = client.post(f"/api/evidence/{created_evidence_id}/transfer", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "already the current custodian" in resp.json()["detail"].lower()


def test_transfer_custody_to_inactive_user_rejected(
    client, collector_token, test_inactive_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    payload = {
        "new_custodian_id": test_inactive_user.id,
        "reason": "Transfer to deactivated account",
    }

    resp = client.post(f"/api/evidence/{created_evidence_id}/transfer", json=payload, headers=headers)
    assert resp.status_code == 400
    assert "deactivated" in resp.json()["detail"].lower()


def test_get_custody_history(
    client, collector_token, test_investigator_user, created_evidence_id, mock_blockchain_custody
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    resp = client.get(f"/api/evidence/{created_evidence_id}/history", headers=headers)
    assert resp.status_code == 200
    history = resp.json()

    assert isinstance(history, list)
    assert len(history) >= 1
    assert history[0]["new_custodian_user"]["email"] == test_investigator_user.email
    assert history[0]["new_custodian_user"]["role"] == "INVESTIGATOR"
    assert "datetime_utc" in history[0]

