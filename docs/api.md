# REST API Specification: Blockchain Evidence Chain of Custody

The backend exposes an OpenAPI 3.0-compliant RESTful interface at `/api`. Interactive documentation is accessible via Swagger UI at `http://localhost:8000/docs` and ReDoc at `http://localhost:8000/redoc`.

---

## Authentication & Authorization

All protected routes require an HTTP Bearer JWT token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Tokens are obtained via `/api/auth/login` and expire after 24 hours.

---

## 1. Authentication Endpoints

### 1.1 Officer Login
Authenticates an officer using email and password, returning an OAuth2-compliant Bearer token.

- **Method / Endpoint:** `POST /api/auth/login`
- **Content-Type:** `application/x-www-form-urlencoded`
- **Request Body:**
  - `username` (string, required): Officer's email address
  - `password` (string, required): Officer's password
- **Responses:**
  - `200 OK`:
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
      "token_type": "bearer",
      "user": {
        "id": 1,
        "full_name": "System Administrator",
        "email": "admin@evidence.org",
        "role": "ADMIN",
        "blockchain_address": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "is_active": true
      }
    }
    ```
  - `401 Unauthorized`: Invalid credentials or inactive account.

### 1.2 Current Officer Profile
Returns details of the currently authenticated officer.

- **Method / Endpoint:** `GET /api/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response `200 OK`:** User object.

### 1.3 Sign Out
Invalidates current session.

- **Method / Endpoint:** `POST /api/auth/logout`
- **Response `200 OK`:** `{"message": "Successfully logged out"}`

---

## 2. Evidence Management Endpoints

### 2.1 Register New Digital Evidence
Uploads a physical evidence file, computes its SHA-256 fingerprint server-side, anchors the record on the blockchain smart contract, and persists metadata in the database.

- **Method / Endpoint:** `POST /api/evidence`
- **Role Clearance:** `ADMIN`, `EVIDENCE_COLLECTOR`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file` (binary, required): The evidence file artifact
  - `title` (string, required): Descriptive title
  - `description` (string, required): Detailed context / notes
  - `category` (string, required): `IMAGE` | `VIDEO` | `DOCUMENT` | `OTHER`
  - `case_number` (string, required): Law enforcement case reference
  - `collection_location` (string, required): Physical location of seizure
  - `collection_datetime` (string, ISO 8601, required): Timestamp of seizure
- **Responses:**
  - `201 Created`:
    ```json
    {
      "id": 1,
      "evidence_id": "EV-20261108-A1B2C3D4",
      "title": "Suspect Hard Drive Image",
      "category": "DOCUMENT",
      "case_number": "CR-2026-0042",
      "original_filename": "disk_image.dd",
      "file_size": 10485760,
      "mime_type": "application/octet-stream",
      "original_sha256": "0x5a1f8e...",
      "registration_status": "CONFIRMED",
      "blockchain_transaction_hash": "0x9c3d4e...",
      "blockchain_block_number": 12,
      "created_at": "2026-11-08T10:00:00Z"
    }
    ```

### 2.2 List Evidence Items
Retrieves a paginated list of evidence records with optional filtering.

- **Method / Endpoint:** `GET /api/evidence`
- **Query Parameters:**
  - `search` (string, optional): Search by title, case number, or evidence ID
  - `category` (string, optional): Filter by category
  - `status` (string, optional): Filter by registration status
  - `skip` (integer, default: 0): Pagination offset
  - `limit` (integer, default: 20): Page size
- **Response `200 OK`:**
  ```json
  {
    "items": [...],
    "total": 45,
    "skip": 0,
    "limit": 20
  }
  ```

### 2.3 Get Evidence Details
Retrieves complete forensic dossier for a specific evidence item.

- **Method / Endpoint:** `GET /api/evidence/{evidence_id}`
- **Response `200 OK`:** Full evidence detail object including transaction references and latest verification result.

### 2.4 Download Original Evidence File
Securely streams the raw evidence file to authorized personnel.

- **Method / Endpoint:** `GET /api/evidence/{evidence_id}/download`
- **Headers:** `Authorization: Bearer <token>`
- **Response `200 OK`:** Binary file stream with `Content-Disposition: attachment; filename="..."`.

---

## 3. Custody & Integrity Endpoints

### 3.1 Transfer Evidence Custody
Reassigns physical and legal custody to another authorized officer, generating an on-chain `CustodyTransferred` event.

- **Method / Endpoint:** `POST /api/evidence/{evidence_id}/transfer`
- **Authorization:** Must be the current custodian or `ADMIN`.
- **Request Body:**
  ```json
  {
    "new_custodian_id": 3,
    "reason": "Handover to Forensics Lab for write-block image extraction"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "evidence_id": "EV-20261108-A1B2C3D4",
    "transaction_hash": "0x8f2a1b...",
    "block_number": 14,
    "previous_custodian": "Officer Alice",
    "new_custodian": "Analyst Bob",
    "timestamp": "2026-11-08T10:30:00Z"
  }
  ```

### 3.2 Get Custody History
Retrieves the chronological custody timeline verified from on-chain event logs.

- **Method / Endpoint:** `GET /api/evidence/{evidence_id}/history`
- **Response `200 OK`:**
  ```json
  {
    "evidence_id": "EV-20261108-A1B2C3D4",
    "total_transfers": 2,
    "history": [
      {
        "transfer_number": 1,
        "from_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "from_name": "Collector Officer",
        "to_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "to_name": "Detective Miller",
        "reason": "Handover for field inquiry",
        "block_timestamp": "2026-11-08T10:15:00Z",
        "block_number": 13,
        "transaction_hash": "0x12ab34..."
      }
    ]
  }
  ```

### 3.3 Verify Cryptographic Integrity
Computes the live SHA-256 hash of the stored file on disk and verifies it against the authoritative hash on the smart contract.

- **Method / Endpoint:** `POST /api/evidence/{evidence_id}/verify`
- **Response `200 OK` (Intact Match):**
  ```json
  {
    "evidence_id": "EV-20261108-A1B2C3D4",
    "verified": true,
    "result": "VERIFIED",
    "calculated_hash": "0x5a1f8e...",
    "blockchain_hash": "0x5a1f8e...",
    "checked_at": "2026-11-08T11:00:00Z",
    "message": "Cryptographic integrity verified. Disk artifact exactly matches blockchain anchor."
  }
  ```
- **Response `200 OK` (Tamper Detected Mismatch):**
  ```json
  {
    "evidence_id": "EV-20261108-A1B2C3D4",
    "verified": false,
    "result": "MISMATCH",
    "calculated_hash": "0x999999...",
    "blockchain_hash": "0x5a1f8e...",
    "checked_at": "2026-11-08T11:05:00Z",
    "message": "CRITICAL ALERT: File hash mismatch detected! Evidence has been tampered with or corrupted."
  }
  ```

---

## 4. Blockchain & Dashboard Endpoints

### 4.1 Node Status
Returns the operational connectivity of the Hardhat node and smart contract accessibility.

- **Method / Endpoint:** `GET /api/blockchain/status`
- **Response `200 OK`:**
  ```json
  {
    "connected": true,
    "chain_id": 31337,
    "contract_address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "contract_accessible": true,
    "latest_block_number": 16,
    "rpc_url": "http://blockchain:8545"
  }
  ```

### 4.2 Dashboard Statistics
- **Method / Endpoint:** `GET /api/dashboard/stats`
- **Response `200 OK`:**
  ```json
  {
    "total_evidence": 12,
    "my_custody_count": 3,
    "total_transfers": 7,
    "integrity_warnings": 0,
    "active_users": 5
  }
  ```
