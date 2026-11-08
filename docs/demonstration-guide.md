# Academic Demonstration Guide & Evaluation Script

This document provides a sequential, step-by-step walkthrough designed for presenting and evaluating the **Blockchain-Based Digital Evidence Chain-of-Custody System** before university faculty, external examiners, or technical reviewers.

---

## 1. Quick Reference: Demonstration Accounts

All accounts are pre-seeded in development mode with the uniform password: **`EvidencePass123!`**

| Role | Account Email | Assigned Ethereum Address | Key Responsibilities in Demo |
|---|---|---|---|
| **Administrator** | `admin@evidence.org` | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | User provisioning, role management, global override |
| **Evidence Collector** | `collector@evidence.org` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | Crime scene evidence seizure, file upload & initial on-chain anchoring |
| **Investigator** | `investigator@evidence.org` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | Case handling, inquiry, custody transfer to forensics lab |
| **Forensic Analyst** | `analyst@evidence.org` | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | Hash verification, write-block analysis, lab handoff |
| **Court Reviewer** | `court@evidence.org` | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | Judicial review, non-repudiation verification, trial admission |

> **Presentation Tip:** On the login screen (`http://localhost:3000/login`), you can click any of the **Demo Role Account** buttons at the bottom to automatically pre-fill credentials without typing!

---

## 2. Environment Startup

Start the complete multi-container stack:

```bash
docker compose up --build -d
```

Verify service status:
```bash
docker compose ps
```

All 4 containers will be reported healthy:
- `evidence_blockchain` (Port 8545)
- `evidence_postgres` (Port 5432)
- `evidence_backend` (Port 8000)
- `evidence_frontend` (Port 3000)

Access the dashboard at: **`http://localhost:3000`**

---

## 3. The 9-Step Evaluation Workflow

### Step 1: Administrator Oversight & System Status
1. Navigate to `http://localhost:3000/login` and click **`admin@evidence.org`**.
2. Click **Sign In**.
3. Point out the top header:
   - Green indicator showing **Hardhat Node Connected**, Chain ID **31337**, and current block number.
4. Navigate to **User Management** in the sidebar:
   - Show the 5 authorized officers, their assigned Ethereum wallet addresses, and active clearance statuses.

### Step 2: Ingest Digital Evidence as Evidence Collector
1. Sign out (bottom of sidebar) and log in as **`collector@evidence.org`**.
2. Notice the role badge changed to **Evidence Collector** and the **Register Evidence** button is accessible.
3. Click **Register New Digital Evidence** (`/evidence/register`):
   - **Case Reference:** `CR-2026-9042`
   - **Category:** `DOCUMENT` (or `IMAGE`)
   - **Title:** `Suspect Primary NVMe Disk Image`
   - **Description:** `Bit-stream clone acquired using Tableau Forensic Write Blocker. Tamper seal #8841 intact.`
   - **Location:** `Room 402, 10th Precinct HQ`
   - **Artifact File:** Upload any sample file (e.g. text file, image, or PDF).
4. Click **Register On-Chain**:
   - Point out the step status: *Streaming file & calculating SHA-256* &rarr; *Submitting smart contract transaction* &rarr; *Receipt confirmed*.
   - You are automatically redirected to the newly created evidence dossier.

### Step 3: Inspect the Cryptographic Anchor
1. Point out the evidence dossier elements:
   - Unique generated Evidence ID (e.g., `EV-20261108-XXXXXX`).
   - Registration status: **On-Chain Confirmed**.
   - Original Immutable SHA-256 hash displayed in monospace.
   - Smart contract transaction hash and block number.
2. Emphasize to the examiners:
   - *The raw file is NOT on the blockchain; only its mathematical fingerprint and custodian address are anchored.*

### Step 4: First Custody Handover (Collector &rarr; Investigator)
1. While still viewing the dossier, click **Transfer Custody**:
   - **Transfer To:** Select `Detective Miller (INVESTIGATOR)`.
   - **Reason:** `Handing over sealed clone drive for initial case inquiry and witness correlation.`
2. Click **Confirm & Sign Transfer**:
   - The modal executes the smart contract `transferCustodyByRelayer` transaction.
   - The transaction receipt displays the confirmed Ethereum transaction hash and block number.
3. Click **Done**:
   - Notice the current custodian is now `Detective Miller (INVESTIGATOR)`.
   - Look at the **Authoritative Chain-of-Custody Timeline** at the bottom: Event #1 (Origin) followed by Handover #1 with previous/new custodian and transfer reason.

### Step 5: Second Custody Handover (Investigator &rarr; Forensic Analyst)
1. Switch user: Sign out and log in as **`investigator@evidence.org`**.
2. Navigate to **Evidence Vault** and open the case dossier.
3. Click **Transfer Custody**:
   - **Transfer To:** Select `Analyst Bob (FORENSIC_ANALYST)`.
   - **Reason:** `Submitting to Digital Forensics Unit for malware reverse engineering and hash verification.`
4. Confirm the transfer.

### Step 6: Third Custody Handover (Analyst &rarr; Court Reviewer)
1. Switch user: Sign out and log in as **`analyst@evidence.org`**.
2. Open the evidence dossier.
3. Click **Transfer Custody**:
   - **Transfer To:** Select `Judge Davis (COURT_REVIEWER)`.
   - **Reason:** `Formal submission to High Court Registry as Exhibit A for Grand Jury trial.`
4. Confirm the transfer.

### Step 7: Cryptographic Integrity Verification (MATCH)
1. In the dossier, scroll to the **Cryptographic Integrity Verification** card.
2. Click **Verify Integrity Now**:
   - The backend reads the physical file from the isolated storage volume.
   - Computes live SHA-256 in memory.
   - Queries the smart contract's `getEvidence()` function.
   - Displays: **Integrity Verified (Green Badge)**.
   - Highlights that disk hash and blockchain hash are 100% identical.

### Step 8: THE TAMPER DETECTION EXPERIMENT (Critical Defense Moment)
This demonstrates why the blockchain architecture is essential. Show what happens when an adversary tampers with the raw file on the server.

1. Keep the browser open on the Evidence Dossier.
2. Open a terminal window and find the evidence storage directory inside the backend container:
   ```bash
   # Enter the backend container
   docker exec -it evidence_backend /bin/sh

   # List the stored evidence files
   ls -la /app/storage/evidence/
   ```
3. Deliberately modify the file bytes (simulate bit-flip or evidence tampering):
   ```bash
   # Append malicious data to the file
   echo "CORRUPTED_TAMPERED_BYTES" >> /app/storage/evidence/<evidence_storage_filename>
   exit
   ```
4. Return to the browser and click **Verify Integrity Now**:
   - **RESULT:** The system immediately triggers a prominent **RED FORENSIC ALERT: CRYPTOGRAPHIC HASH MISMATCH**!
   - Shows the calculated hash on disk differs from the immutable blockchain hash.
   - Highlights that **the smart contract's hash was NOT overwritten**; the tamper event is permanently recorded in the audit logs.
5. Navigate to **Dashboard**:
   - Show that **Tamper Warnings** incremented and highlighted in red.

### Step 9: Review the Immutable Audit Trail
1. Return to the dossier and examine the **Authoritative Chain-of-Custody Timeline**:
   - Point out the complete custody lifecycle:
     ```
     Collector -> Investigator -> Forensic Analyst -> Court Reviewer
     ```
   - Each transition has an immutable Ethereum block number, timestamp, and verifiable transaction hash.
2. Navigate to **Blockchain Activity** in the sidebar:
   - Show every confirmed ledger transaction (`REGISTER_EVIDENCE`, `TRANSFER_CUSTODY`).

---

## 4. Key Questions Faculty / Examiners May Ask

**Q: Where is the actual file stored?**  
*A: In secure, isolated server storage (`/app/storage/evidence`). The blockchain stores only the 256-bit SHA-256 hash. This guarantees high throughput, zero blockchain bloat, and complete confidentiality of the evidence file.*

**Q: What prevents someone from replacing the hash on the smart contract?**  
*A: The Solidity contract contains no function to update or delete the original hash. Once stored in the contract's mapping, it is mathematically immutable.*

**Q: Why use a relayer for transactions?**  
*A: Forensic officers in the field should not need to manage individual cryptocurrency balances for gas fees. The backend acts as a trusted relayer that signs transactions, while the smart contract explicitly records and enforces the officer's designated Ethereum address as the custodian.*
