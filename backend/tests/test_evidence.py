import io
import uuid
from datetime import datetime, timezone
import pytest
from app.blockchain.client import blockchain_client


@pytest.fixture
def mock_blockchain_register(monkeypatch):
    """Mocks successful blockchain registration receipt."""
    def fake_register(evidence_id, sha256_hex, initial_custodian_address):
        tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
        return {
            "transaction_hash": tx_hash,
            "block_number": 42,
            "gas_used": 150000,
            "status": 1,
        }

    monkeypatch.setattr(blockchain_client, "register_evidence", fake_register)
    monkeypatch.setattr(blockchain_client, "contract_address", "0x5FbDB2315678afecb367f032d93F642f64180aa3")


def test_register_evidence_by_collector_success(
    client, collector_token, test_collector_user, mock_blockchain_register
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    file_bytes = b"Digital Forensic Photograph Evidence File 987654"

    data = {
        "title": "Crime Scene Fingerprint Photo",
        "description": "High resolution photograph of latent fingerprint on door handle",
        "category": "IMAGE",
        "case_number": "CASE-2026-001",
        "collection_location": "Building 4, Room 201",
        "collection_datetime": datetime.now(timezone.utc).isoformat(),
        "initial_custodian_id": test_collector_user.id,
    }

    files = {
        "file": ("fingerprint.jpg", io.BytesIO(file_bytes), "image/jpeg"),
    }

    resp = client.post("/api/evidence", data=data, files=files, headers=headers)
    assert resp.status_code == 201
    result = resp.json()

    assert result["title"] == "Crime Scene Fingerprint Photo"
    assert result["case_number"] == "CASE-2026-001"
    assert result["category"] == "IMAGE"
    assert result["registration_status"] == "CONFIRMED"
    assert result["blockchain_transaction_hash"].startswith("0x")
    assert len(result["blockchain_transaction_hash"]) == 66
    assert result["blockchain_block_number"] == 42
    assert result["file_size"] == len(file_bytes)
    assert result["original_sha256"].startswith("0x")
    assert result["evidence_id"].startswith("EVID-")


def test_register_evidence_unauthorized_role_rejected(client, court_token, test_collector_user):
    headers = {"Authorization": f"Bearer {court_token}"}
    data = {
        "title": "Unauthorized Attempt",
        "category": "DOCUMENT",
        "case_number": "CASE-999",
        "collection_location": "Court Room",
        "collection_datetime": datetime.now(timezone.utc).isoformat(),
        "initial_custodian_id": test_collector_user.id,
    }
    files = {
        "file": ("document.pdf", io.BytesIO(b"dummy pdf content"), "application/pdf"),
    }

    resp = client.post("/api/evidence", data=data, files=files, headers=headers)
    assert resp.status_code == 403


def test_register_evidence_nonexistent_custodian_rejected(
    client, collector_token, mock_blockchain_register
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    data = {
        "title": "Bad Custodian Test",
        "category": "OTHER",
        "case_number": "CASE-002",
        "collection_location": "Warehouse",
        "collection_datetime": datetime.now(timezone.utc).isoformat(),
        "initial_custodian_id": 999999,  # Nonexistent
    }
    files = {
        "file": ("log.txt", io.BytesIO(b"log content here"), "text/plain"),
    }

    resp = client.post("/api/evidence", data=data, files=files, headers=headers)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_list_evidence_pagination_and_search(
    client, collector_token, test_collector_user, mock_blockchain_register
):
    headers = {"Authorization": f"Bearer {collector_token}"}

    # Register 2 evidence items
    for i in range(2):
        client.post(
            "/api/evidence",
            data={
                "title": f"Evidence Sample {i}",
                "category": "DOCUMENT",
                "case_number": f"CASE-PAGINATE-{i}",
                "collection_location": "HQ",
                "collection_datetime": datetime.now(timezone.utc).isoformat(),
                "initial_custodian_id": test_collector_user.id,
            },
            files={"file": (f"doc_{i}.txt", io.BytesIO(f"doc content {i}".encode()), "text/plain")},
            headers=headers,
        )

    # Test list endpoint
    resp = client.get("/api/evidence?page=1&page_size=10", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] >= 2
    assert data["page"] == 1

    # Test search filter
    search_resp = client.get("/api/evidence?search=CASE-PAGINATE-0", headers=headers)
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert len(search_data["items"]) == 1
    assert search_data["items"][0]["case_number"] == "CASE-PAGINATE-0"


def test_download_evidence_and_verify_audit_log(
    client, collector_token, test_collector_user, mock_blockchain_register
):
    headers = {"Authorization": f"Bearer {collector_token}"}
    secret_payload = b"Top secret forensic analysis report payload binary"

    # Register
    create_resp = client.post(
        "/api/evidence",
        data={
            "title": "Secret Forensic Report",
            "category": "DOCUMENT",
            "case_number": "CASE-DOWNLOAD-1",
            "collection_location": "Lab 1",
            "collection_datetime": datetime.now(timezone.utc).isoformat(),
            "initial_custodian_id": test_collector_user.id,
        },
        files={"file": ("report.pdf", io.BytesIO(secret_payload), "application/pdf")},
        headers=headers,
    )
    assert create_resp.status_code == 201
    evidence_id = create_resp.json()["evidence_id"]

    # Download
    download_resp = client.get(f"/api/evidence/{evidence_id}/download", headers=headers)
    assert download_resp.status_code == 200
    assert download_resp.content == secret_payload

    # Transactions endpoint
    tx_resp = client.get(f"/api/evidence/{evidence_id}/transactions", headers=headers)
    assert tx_resp.status_code == 200
    tx_list = tx_resp.json()
    assert len(tx_list) >= 1
    assert tx_list[0]["transaction_type"] == "REGISTRATION"


def test_dashboard_stats_and_recent_activity(
    client, collector_token, test_collector_user, mock_blockchain_register
):
    headers = {"Authorization": f"Bearer {collector_token}"}

    # Register an item
    client.post(
        "/api/evidence",
        data={
            "title": "Dashboard Evidence Item",
            "category": "IMAGE",
            "case_number": "CASE-DASHBOARD",
            "collection_location": "Field",
            "collection_datetime": datetime.now(timezone.utc).isoformat(),
            "initial_custodian_id": test_collector_user.id,
        },
        files={"file": ("dash.jpg", io.BytesIO(b"dashboard image content"), "image/jpeg")},
        headers=headers,
    )

    stats_resp = client.get("/api/dashboard/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["total_evidence"] >= 1
    assert stats["my_custody"] >= 1

    activity_resp = client.get("/api/dashboard/recent-activity", headers=headers)
    assert activity_resp.status_code == 200
    activity = activity_resp.json()
    assert len(activity) >= 1
    assert any(a["action"] == "EVIDENCE_REGISTERED" for a in activity)
