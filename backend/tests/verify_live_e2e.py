"""
End-to-end live verification of Blockchain Evidence Chain-of-Custody System.
Tests live integration between:
- FastAPI Application
- Web3.py Client
- Real Hardhat Local Blockchain Node
- Real Deployed EvidenceChainOfCustody Smart Contract
- Real SHA-256 File Hashing and Persistent Storage
"""
import io
import os
import sys
from datetime import datetime, timezone
from fastapi.testclient import TestClient

# Configure environment for live blockchain test
os.environ["HARDHAT_RPC_URL"] = "http://host.docker.internal:8545"
os.environ["DATABASE_URL"] = "sqlite:////tmp/e2e_live_test.db"

from app.main import app
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app.db.seed import seed_demo_users
from app.blockchain.client import blockchain_client
from app.models.evidence import Evidence


def run_e2e_live_verification():
    print("=" * 70)
    print("STARTING LIVE END-TO-END VERIFICATION: BLOCKCHAIN + BACKEND")
    print("=" * 70)

    # 1. Initialize DB and Seed
    print("\n[STEP 1] Initializing SQLite database and seeding demo users...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_demo_users(db)
    db.close()
    print("✓ Database initialized and demonstration role accounts seeded.")

    # 2. Verify Real Blockchain Status
    print("\n[STEP 2] Verifying Web3.py connectivity to Hardhat node...")
    blockchain_client.rpc_url = "http://host.docker.internal:8545"
    blockchain_client.refresh_connection()
    status = blockchain_client.get_status()
    print(f"  RPC URL: {status['rpc_url']}")
    print(f"  Connected: {status['connected']}")
    print(f"  Chain ID: {status['chain_id']}")
    print(f"  Contract Address: {status['contract_address']}")
    print(f"  Contract Accessible: {status['contract_accessible']}")
    print(f"  Latest Block Number: {status['latest_block_number']}")

    assert status["connected"] is True, "Failed to connect to Hardhat node"
    assert status["contract_accessible"] is True, "Smart contract is not accessible"
    assert status["chain_id"] == 31337, f"Unexpected Chain ID {status['chain_id']}"
    print("✓ Blockchain node and deployed smart contract verified live.")

    client = TestClient(app)

    # 3. Test Blockchain Status REST Endpoint
    print("\n[STEP 3] Testing GET /api/blockchain/status REST endpoint...")
    resp = client.get("/api/blockchain/status")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    status_data = resp.json()
    assert status_data["connected"] is True
    assert status_data["contract_accessible"] is True
    print(f"✓ GET /api/blockchain/status returned 200 OK: {status_data}")

    # 4. Authenticate as Evidence Collector
    print("\n[STEP 4] Authenticating as Evidence Officer (collector@evidence.org)...")
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "collector@evidence.org", "password": "Password123!"},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    collector_token = login_resp.json()["access_token"]
    collector_user = login_resp.json()["user"]
    collector_headers = {"Authorization": f"Bearer {collector_token}"}
    print(f"✓ Authenticated. User: {collector_user['full_name']} (Role: {collector_user['role']})")
    print(f"  Ethereum Address: {collector_user['blockchain_address']}")

    # 5. Register Real Digital Evidence on the Blockchain
    print("\n[STEP 5] Uploading and registering real digital evidence on-chain...")
    sample_file_content = b"CRIME SCENE SURVEILLANCE FOOTAGE FRAME 10492 - FORENSIC EVIDENCE"
    
    upload_data = {
        "title": "Convenience Store Robbery - Surveillance Frame",
        "description": "High resolution snapshot captured from camera #2 showing suspect entering doorway",
        "category": "IMAGE",
        "case_number": "CRIME-2026-NYC-8492",
        "collection_location": "Corner of 5th Ave & 42nd St, NY",
        "collection_datetime": datetime.now(timezone.utc).isoformat(),
        "initial_custodian_id": collector_user["id"],
    }
    upload_files = {
        "file": ("surveillance_frame_10492.jpg", io.BytesIO(sample_file_content), "image/jpeg"),
    }

    evidence_resp = client.post(
        "/api/evidence",
        data=upload_data,
        files=upload_files,
        headers=collector_headers,
    )
    assert evidence_resp.status_code == 201, f"Evidence upload failed: {evidence_resp.text}"
    evidence_data = evidence_resp.json()

    evidence_id = evidence_data["evidence_id"]
    sha256_hash = evidence_data["original_sha256"]
    tx_hash = evidence_data["blockchain_transaction_hash"]
    block_num = evidence_data["blockchain_block_number"]

    print(f"✓ Evidence registered successfully!")
    print(f"  Evidence ID: {evidence_id}")
    print(f"  Computed SHA-256: {sha256_hash}")
    print(f"  Blockchain Tx Hash: {tx_hash}")
    print(f"  Mined in Block #: {block_num}")
    print(f"  Registration Status: {evidence_data['registration_status']}")

    assert evidence_data["registration_status"] == "CONFIRMED"
    assert tx_hash.startswith("0x")
    assert block_num >= 1

    # 6. Verify Direct On-Chain Contract State
    print("\n[STEP 6] Reading authoritative on-chain state directly from smart contract...")
    on_chain_record = blockchain_client.get_evidence(evidence_id)
    print(f"  On-chain Evidence Exists: {on_chain_record['exists']}")
    print(f"  On-chain Stored Hash: {on_chain_record['original_sha256']}")
    print(f"  On-chain Initial Custodian: {on_chain_record['initial_custodian']}")
    print(f"  On-chain Current Custodian: {on_chain_record['current_custodian']}")

    assert on_chain_record["exists"] is True
    assert on_chain_record["original_sha256"].lower() == sha256_hash.lower()
    assert on_chain_record["current_custodian"].lower() == collector_user["blockchain_address"].lower()
    print("✓ Smart contract state exactly matches uploaded evidence metadata and SHA-256 hash!")

    # 7. Test Contract Hash Verification Function (verifyEvidenceRecord)
    print("\n[STEP 7] Calling smart contract verifyEvidenceRecord...")
    matches, orig = blockchain_client.verify_evidence(evidence_id, sha256_hash)
    assert matches is True
    print(f"  Hash match confirmation: {matches} (Original: {orig})")

    # Test tampering check directly on-chain
    fake_hash = "0x" + "a" * 64
    fake_matches, _ = blockchain_client.verify_evidence(evidence_id, fake_hash)
    assert fake_matches is False
    print(f"  Altered hash rejected on-chain: {fake_matches} (expected False)")
    print("✓ Smart contract cryptographic integrity verification confirmed.")

    # 8. Test Evidence Detail Endpoint
    print("\n[STEP 8] Calling GET /api/evidence/{evidence_id}...")
    detail_resp = client.get(f"/api/evidence/{evidence_id}", headers=collector_headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["on_chain_verified"] is True
    print(f"✓ Detail retrieved. On-Chain Verified: {detail['on_chain_verified']}")

    # 9. Test Evidence Download Endpoint & Byte Fidelity
    print("\n[STEP 9] Downloading stored evidence file from backend...")
    dl_resp = client.get(f"/api/evidence/{evidence_id}/download", headers=collector_headers)
    assert dl_resp.status_code == 200
    assert dl_resp.content == sample_file_content
    print(f"✓ Downloaded {len(dl_resp.content)} bytes. Exact byte match with original sample file.")

    # 10. Test Dashboard Stats
    print("\n[STEP 10] Checking operational dashboard metrics...")
    stats_resp = client.get("/api/dashboard/stats", headers=collector_headers)
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    print(f"  Dashboard Stats: {stats}")
    assert stats["total_evidence"] >= 1
    assert stats["my_custody"] >= 1

    # 11. Test Recent Activity Audit Logs
    print("\n[STEP 11] Checking application audit logs...")
    activity_resp = client.get("/api/dashboard/recent-activity", headers=collector_headers)
    assert activity_resp.status_code == 200
    activities = activity_resp.json()
    actions = [a["action"] for a in activities]
    print(f"  Recent Actions: {actions}")
    assert "EVIDENCE_REGISTERED" in actions
    assert "EVIDENCE_DOWNLOADED" in actions
    print("✓ Audit log successfully recorded registration and download events.")

    print("\n" + "=" * 70)
    print("ALL LIVE END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY (11/11 STEPS)!")
    print("=" * 70)


if __name__ == "__main__":
    run_e2e_live_verification()

