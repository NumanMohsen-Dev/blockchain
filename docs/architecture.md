# System Architecture: Blockchain-Based Digital Evidence Chain of Custody

## 1. Executive Architecture Summary

The **Blockchain-Based Digital Evidence Chain-of-Custody System** is an enterprise-grade digital forensics platform designed to guarantee legal admissibility, non-repudiation, and mathematical tamper-evidence for digital artifacts.

It resolves a fundamental challenge in cyber forensics: **how to maintain immutable audit trails of custody without storing massive binary files on the blockchain**.

```mermaid
flowchart TD
    subgraph Client["Presentation Tier (Next.js 14)"]
        UI["Forensic Dashboard UI"]
        AuthContext["Auth Context & RBAC Guard"]
        ApiClient["Typed REST Client"]
    end

    subgraph Backend["Application Tier (FastAPI + Web3.py)"]
        APIRouters["FastAPI Routers (/api)"]
        AuthService["JWT & Argon2/Bcrypt Security"]
        EvidenceService["Evidence & Custody Service"]
        StorageEngine["Secure Streaming SHA-256 Storage"]
        BlockchainClient["Web3.py Relayer & Contract Client"]
    end

    subgraph Data["Persistence & Ledger Tier"]
        DB[(PostgreSQL 16 Relational DB)]
        DiskVolume[("Encrypted Local Evidence Volume")]
        SmartContract["Ethereum Smart Contract (EVM / Hardhat)"]
    end

    UI --> AuthContext --> ApiClient
    ApiClient -->|HTTP / JSON & Multipart| APIRouters
    APIRouters --> AuthService
    APIRouters --> EvidenceService
    EvidenceService --> StorageEngine
    StorageEngine -->|Stream & SHA-256| DiskVolume
    EvidenceService --> DB
    EvidenceService --> BlockchainClient
    BlockchainClient -->|JSON-RPC 8545| SmartContract
```

---

## 2. The Hybrid Storage & Verification Model

### Why Raw Evidence Never Goes On-Chain
- **Scalability & Gas Cost:** Forensics files (disk images, 4K bodycam videos, memory dumps) range from megabytes to gigabytes. Storing such payloads on EVM storage is prohibitive and degrades network nodes.
- **Privacy & Judicial Privilege:** Storing raw evidence on a distributed ledger creates confidentiality liabilities and risks exposure of sensitive witness details.

### The Cryptographic Proof Separation
1. **Raw Artifact Storage (Off-Chain):**
   - The file is uploaded through an authenticated stream.
   - The server computes the authoritative SHA-256 checksum during ingestion.
   - The file is saved to an isolated directory using a cryptographically generated UUID filename (preventing path traversal and filename collision).
2. **Cryptographic Ledger Anchor (On-Chain):**
   - The 256-bit hash, initial custodian Ethereum address, evidence ID, and block timestamp are committed to the `EvidenceChainOfCustody` smart contract.
3. **Database Audit Layer (Off-Chain):**
   - PostgreSQL stores rich metadata (case number, officer notes, collection GPS location, MIME types) to enable instant search and faceted filtering.

---

## 3. Detailed Data Flows

### A. Evidence Registration & Ingestion Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Evidence Collector / Admin
    participant Frontend as Next.js Dashboard
    participant Backend as FastAPI Server
    participant Storage as File Storage
    participant DB as PostgreSQL
    participant Chain as Smart Contract (Hardhat)

    Officer->>Frontend: Select file & input case metadata
    Frontend->>Backend: POST /api/evidence (Multipart Form)
    Backend->>Backend: Validate file size & MIME type
    Backend->>Storage: Stream file & calculate SHA-256 hash
    Backend->>DB: Create evidence record (Status: PENDING)
    Backend->>Chain: registerEvidence(evidenceId, fileHash, custodianAddress)
    Chain-->>Backend: Confirmed Receipt (Tx Hash, Block Number)
    Backend->>DB: Update record (Status: CONFIRMED, Block #, Tx Hash)
    Backend->>DB: Log transaction & audit record
    Backend-->>Frontend: Return Evidence Detail with On-Chain Anchor
    Frontend-->>Officer: Display confirmed green status & hash
```

### B. Custody Handover Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Custodian as Current Custodian / Admin
    participant Frontend as Next.js Dashboard
    participant Backend as FastAPI Server
    participant DB as PostgreSQL
    participant Chain as Smart Contract

    Custodian->>Frontend: Select recipient & enter handover reason
    Frontend->>Backend: POST /api/evidence/{id}/transfer
    Backend->>DB: Verify caller is current custodian or admin
    Backend->>DB: Verify recipient is active officer
    Backend->>Chain: transferCustodyByRelayer(evidenceId, newCustodian, reason)
    Chain->>Chain: Assert evidence exists & caller authorized
    Chain->>Chain: Assert new custodian != current custodian
    Chain->>Chain: Record transfer struct & emit CustodyTransferred
    Chain-->>Backend: Return confirmed receipt
    Backend->>DB: Update current_custodian_id
    Backend->>DB: Record transaction & audit log
    Backend-->>Frontend: Return confirmed transfer response
    Frontend-->>Custodian: Update timeline with new custodian & block #
```

### C. Live Cryptographic Integrity Verification

```mermaid
sequenceDiagram
    autonumber
    actor Analyst as Forensic Analyst / Court
    participant Frontend as Next.js Dashboard
    participant Backend as FastAPI Server
    participant Storage as File Storage
    participant DB as PostgreSQL
    participant Chain as Smart Contract

    Analyst->>Frontend: Click "Verify Integrity Now"
    Frontend->>Backend: POST /api/evidence/{id}/verify
    Backend->>Chain: getEvidence(evidenceId)
    Chain-->>Backend: Authoritative registered SHA-256 hash
    Backend->>Storage: Read file from disk & compute live SHA-256
    alt Hashes Match
        Backend->>DB: Record integrity check (Result: VERIFIED)
        Backend-->>Frontend: { verified: true, result: "VERIFIED" }
        Frontend-->>Analyst: Display green verification badge
    else Hashes Differ (Tampered)
        Backend->>DB: Record integrity check (Result: MISMATCH)
        Backend-->>Frontend: { verified: false, result: "MISMATCH" }
        Frontend-->>Analyst: Display prominent RED TAMPER WARNING
    end
```

---

## 4. Database Entity-Relationship Model

```mermaid
erDiagram
    users ||--o{ evidence : "initial custodian"
    users ||--o{ evidence : "current custodian"
    users ||--o{ integrity_checks : "performs"
    users ||--o{ audit_logs : "triggers"
    evidence ||--o{ transactions : "generates"
    evidence ||--o{ integrity_checks : "subject of"

    users {
        int id PK
        string full_name
        string email UK
        string password_hash
        string role
        string blockchain_address
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    evidence {
        int id PK
        string evidence_id UK
        string title
        text description
        string category
        string case_number
        string collection_location
        datetime collection_datetime
        string original_filename
        string storage_filename
        string mime_type
        bigint file_size
        string original_sha256
        int initial_custodian_id FK
        int current_custodian_id FK
        string registration_status
        string blockchain_transaction_hash
        bigint blockchain_block_number
        datetime created_at
    }

    transactions {
        int id PK
        int evidence_id FK
        string transaction_hash UK
        string transaction_type
        bigint block_number
        string transaction_status
        datetime created_at
    }

    integrity_checks {
        int id PK
        int evidence_id FK
        int performed_by_id FK
        string calculated_hash
        string blockchain_hash
        string result
        datetime checked_at
    }

    audit_logs {
        int id PK
        int user_id FK
        string action
        string resource_type
        string resource_id
        text description
        datetime created_at
    }
```

---

## 5. Smart Contract Design & Authoritative Logic

The smart contract [`blockchain/contracts/EvidenceChainOfCustody.sol`](file:///c:/Users/USER/Documents/University/Sem%207/BlockChain/Blockchain-Evidence-Chain-of-Custod/blockchain/contracts/EvidenceChainOfCustody.sol) acts as the immutable single source of truth.

### Key Guarantees
1. **Hash Immutability:** There is no function in the smart contract that permits updating or overwriting `originalHash`. Once set, it cannot be altered by anyone, including the contract owner.
2. **Duplicate Prevention:** Re-registering an existing `evidenceId` reverts immediately with `EvidenceAlreadyRegistered`.
3. **Authorized Custody Transitions:** Only the current custodian or authorized relayer operator can initiate a custody transfer.
4. **Non-Trivial Custody Handoff:** Self-transfers (`newCustodian == currentCustodian`) are rejected with `SameCustodianTransferNotAllowed`.
5. **Auditable Event Stream:** `EvidenceRegistered` and `CustodyTransferred` events contain block numbers and timestamps that form an unforgeable timeline.

---

## 6. Threat Modeling & Security Controls

| Threat | Attack Vector | System Defense |
|---|---|---|
| **Evidence Tampering** | Attacker modifies file bytes on local disk | Live verification computes real-time SHA-256, flags immediate `MISMATCH`, and preserves on-chain hash. |
| **Unauthorized Transfer** | Non-custodian attempts to reassign evidence | Backend RBAC verifies caller identity against current custodian record; smart contract verifies caller address. |
| **Path Traversal** | Malicious filename such as `../../etc/passwd` | Filenames on disk are generated as random UUIDs; original filenames are stored solely as descriptive metadata. |
| **Privilege Escalation** | Regular officer creates admin account | User creation and role reassignment endpoints are restricted strictly to the `ADMIN` role. |
| **Denial of Service** | Oversized file upload exhausting disk | Streaming upload validates content size against `MAX_UPLOAD_SIZE_BYTES` (100 MB default) and aborts if exceeded. |

