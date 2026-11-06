# Blockchain-Based Digital Evidence Chain-of-Custody System
## Master Development Specification for Gemini in Antigravity IDE

> Build the complete working application described here. Do not stop at a plan, scaffold, mockup, or code snippets. Work in the workspace, run the application, execute tests, fix errors, and document the result.

## 1. Role and objective

Act as a senior full-stack developer, blockchain developer, software architect, and DevOps engineer.

Build a complete, locally runnable semester project named **Blockchain-Based Digital Evidence Chain-of-Custody System**.

Deliver:
- Next.js frontend
- FastAPI backend
- Solidity smart contract
- Local Hardhat blockchain
- PostgreSQL database
- Authentication and role-based authorization
- Secure evidence upload and persistent storage
- Backend-generated SHA-256 hashes
- On-chain evidence registration and custody transfers
- Blockchain-backed custody history
- Integrity verification
- Dockerfiles and Docker Compose
- Automated tests
- Setup, architecture, API, and demonstration documentation

If the workspace already contains a repository, inspect it first. Preserve useful work. Do not overwrite or delete files without understanding their purpose.

## 2. Project background and scope

Digital evidence may include images, videos, PDFs, text documents, and other supported files. Evidence passes between authorized participants, for example:

**Evidence Collection → Investigator → Forensic Analyst → Investigator / Court**

The system records who registered evidence, who currently holds it, who transferred it, who received it, when each transfer occurred, and whether the stored file still matches its original registered hash.

At registration, the backend calculates a SHA-256 hash. Store the evidence ID, hash, timestamp, and custody information on the blockchain. **Do not store actual evidence files on-chain.** Store files in backend-managed persistent storage.

During verification, calculate the file's current SHA-256 hash and compare it with the original hash retrieved from the blockchain:
- Matching: current file matches the originally registered hash.
- Different: file may have been modified or corrupted since registration.
- Missing: integrity cannot currently be verified.

**Problem statement:** Creating trust in the verifiability of the chain of custody across multiple participants while detecting unauthorized alterations to digital evidence.

This is an educational semester-project pilot, not a certified forensic evidence platform or production court-evidence system.

## 3. Technology stack

Use this stack unless the existing workspace has a compelling compatibility reason to use an equivalent:

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI, Pydantic |
| ORM/database | SQLAlchemy, PostgreSQL |
| Migrations | Alembic |
| Smart contract | Solidity |
| Local blockchain | Hardhat Network |
| Deployment | Hardhat scripts and Ethers.js |
| Backend blockchain integration | Web3.py |
| File hashing | Python `hashlib`, SHA-256 |
| Authentication | JWT, Argon2 or bcrypt |
| Containers | Docker, Docker Compose |

Choose stable, mutually compatible package versions and pin dependencies.

## 4. System architecture

```text
                         USER
                          |
                          v
                  NEXT.JS FRONTEND
                          |
                          v
                     FASTAPI API
                          |
             +------------+------------+
             |            |            |
             v            v            v
         PostgreSQL   Evidence      Web3.py
         Database     Storage          |
                                       v
                              SOLIDITY CONTRACT
                                       |
                                       v
                               HARDHAT NETWORK
```

Frontend handles login, dashboards, evidence registration/list/details, transfers, history, integrity verification, user administration, and blockchain activity.

Backend handles authentication, authorization, validation, uploads, hashing, storage, database operations, smart-contract interaction, transaction confirmation, history retrieval, integrity verification, and audit logs.

PostgreSQL stores users, roles, user blockchain addresses, evidence metadata, storage references, transaction references, integrity checks, and application audit data. It is **not** the authoritative source for blockchain custody history or the original on-chain hash.

Evidence files remain in a persistent Docker volume. The smart contract is authoritative for evidence registration hashes and custody events.

## 5. Roles and permissions

Implement backend-enforced role-based access control. Hiding a button in the frontend is not sufficient.

### Administrator
- Create/manage users and assign roles.
- Activate/deactivate accounts.
- View all evidence, custody records, blockchain transactions, and statistics.
- Must not silently modify or rewrite blockchain history.

### Evidence Collector
- Register evidence and upload files.
- View authorized evidence and custody history.
- Transfer custody when currently authorized.

### Investigator
- View assigned evidence.
- Receive evidence, verify integrity, transfer custody when authorized, and view history.

### Forensic Analyst
- View assigned evidence.
- Download authorized evidence.
- Verify integrity, receive/transfer evidence when authorized, and view history.

### Court / Reviewer
- View authorized evidence and custody history.
- Verify integrity and view blockchain transaction details.
- Download only when explicitly authorized.

Rules:
- Only authenticated users access protected endpoints.
- Only permitted roles register evidence.
- Only the current custodian can initiate a transfer.
- Receiving user must exist, be active, and be eligible.
- A user cannot transfer evidence they do not hold.
- Downloads require authorization.
- Important actions are auditable.
- Enforce rules in backend services and, where applicable, the smart contract.

## 6. Authentication and users

Implement login, logout/session cleanup, current-user endpoint, controlled account creation, secure password hashing, JWT expiry/validation, role checks, and inactive-account handling.

Each user has a unique ID, full name, unique email, password hash, role, blockchain address, active status, and timestamps.

Provide a development seed command for demo accounts. Do not commit real passwords or secrets. Document how development credentials are generated.

For the local demonstration, backend-managed development blockchain accounts may be used. Clearly document that this is a simplification, not production-grade multi-party signing. Never expose private keys through the API or frontend.

## 7. Smart contract

Create `blockchain/contracts/EvidenceChainOfCustody.sol`.

An evidence record includes:
- Evidence ID
- Original SHA-256 hash (`bytes32` or a clearly documented equivalent)
- Registration timestamp
- Initial custodian address
- Current custodian address
- Existence/registration status

Use a consistent documented representation for SHA-256. Validate hash format in the backend before submitting a transaction.

### Required functions

**`registerEvidence(evidenceId, fileHash, initialCustodian)`**
- Reject duplicate IDs, invalid/empty hashes, and invalid custodian addresses.
- Record block timestamp.
- Set initial and current custodian.
- Emit `EvidenceRegistered`.

**`transferCustody(evidenceId, newCustodian, reason)`**
- Require evidence to exist.
- Validate new custodian and require it differs from current custodian.
- Only current custodian or an explicitly authorized contract-level operator may transfer, according to the selected authorization design.
- Update current custodian and record transfer information.
- Emit `CustodyTransferred`.

Prefer requiring the current custodian's blockchain address to submit the transaction. If the educational backend signs on behalf of users, document that it is a trusted transaction relayer and enforce user identity/current-custodian checks in the backend. Do not falsely claim an EOA transaction was signed by the user if a shared backend account signed it.

**`getEvidence(evidenceId)`** returns original hash, registration timestamp, initial/current custodian, and existence status.

**`getCustodyHistory(evidenceId)`** returns transfer records chronologically, or provide an equivalent event-query implementation.

**`verifyEvidenceRecord(evidenceId, suppliedHash)`** compares a supplied hash with the original hash.

**`isCurrentCustodian(evidenceId, address)`** checks current custody.

### Events
- `EvidenceRegistered`
- `CustodyTransferred`

Include evidence ID, relevant addresses, and useful transfer information. Use event block timestamps or retrieve timestamps from block data.

Security:
- Validate inputs.
- Prevent duplicate registration and unauthorized transfers.
- Never provide a function to overwrite the original hash.
- Use clear custom errors/revert messages.
- Avoid unnecessary on-chain storage.
- Add contract tests.
- Do not claim blockchain is impossible to hack.

## 8. Evidence registration workflow

Form fields:
- Evidence title
- Description
- Category
- Case/reference number
- Collection location
- Collection date/time
- Initial custodian
- Evidence file

Categories: Image, Video, Document, Other.

Registration sequence:
1. Authenticated user opens registration.
2. User enters metadata and selects a file.
3. Backend validates file type, size, and content where practical.
4. Backend generates a unique evidence ID.
5. Backend calculates SHA-256 itself.
6. Backend stores the file under a generated, non-user-controlled storage name.
7. Backend prepares metadata.
8. Backend submits `registerEvidence` to the contract.
9. Backend waits for transaction receipt and checks success.
10. Backend persists metadata and transaction reference.
11. Frontend reports success only after blockchain confirmation and consistent persistence.

Handle partial failures with a state machine such as `PENDING`, `CONFIRMED`, and `FAILED`, plus reconciliation/cleanup. Never show an unconfirmed registration as successful. Prevent database and on-chain records from silently disagreeing.

Display evidence ID, title/category, original hash, registration timestamp, custodian, transaction hash, block number, and status.

## 9. File storage and upload security

Use a persistent directory such as `/app/storage/evidence/`.

- Generate storage filenames server-side.
- Preserve original filename only as metadata.
- Validate file size and allowed types.
- Validate MIME/content where practical; do not trust extension alone.
- Prevent path traversal.
- Never execute uploaded files.
- Do not expose storage as a public static directory.
- Require authorization for downloads.
- Calculate original hash on backend.
- Never trust a client-submitted original hash.
- Configure upload limits using environment variables.

Files must never be stored on-chain.

## 10. Custody transfer workflow

Current custodian:
1. Opens evidence.
2. Selects an eligible receiving user.
3. Enters transfer reason.
4. Reviews details.
5. Confirms transfer.

Backend:
1. Authenticates requester.
2. Verifies requester is current custodian.
3. Verifies receiving user exists, is active, and is eligible.
4. Reads current custody from contract.
5. Submits transaction using documented signing model.
6. Waits for successful receipt.
7. Persists transaction reference and updates cached database state.
8. Returns confirmed information.

On failure, retain previous custody state. Prevent duplicate requests/double-clicks; use idempotency protection where appropriate.

Each transfer displays evidence ID, previous/new custodian, reason, timestamp, transaction hash, block number, and initiating application user.

Blockchain state/events are authoritative. Database values are cached application data.

## 11. Integrity verification

This is a core feature.

1. User opens authorized evidence.
2. User selects **Verify Integrity**.
3. Backend retrieves original registered hash from contract.
4. Backend reads stored file.
5. Backend calculates current SHA-256.
6. Backend compares hashes.
7. Backend returns and records the result.

Outcomes:
- `INTEGRITY VERIFIED`: current file matches original on-chain hash.
- `INTEGRITY WARNING`: hashes differ; file may have been modified/corrupted.
- `FILE UNAVAILABLE`: file is missing, so integrity cannot be verified.

Never overwrite the original blockchain hash. A mismatch must not replace the original hash. Calculate results on the backend, not with hardcoded frontend logic.

## 12. Custody history and audit trail

Create a chronological timeline:

```text
Evidence Registered
        |
        v
Evidence Collection
        |
        v
Transferred to Investigator
        |
        v
Transferred to Forensic Analyst
        |
        v
Transferred to Court
```

For each event show event type, previous/new custodian, timestamp, reason, transaction hash, and block number.

Retrieve history from contract events/verified blockchain records. Database audit rows may supplement the chain but must be clearly distinguished from blockchain proof.

## 13. Frontend pages and design

Build a professional, responsive digital-forensics dashboard:
- Dark navy/slate sidebar
- Light main workspace
- Clear typography and spacing
- Subtle borders
- Accessible forms
- Clear status indicators
- Minimal purposeful animation
- Avoid excessive gradients/decorative UI

Required pages:

1. **Login:** app name/logo, email, password, login, validation/errors.
2. **Dashboard:** total evidence, current custody, transfer count, integrity warnings, users, recent activity, quick actions. Statistics from backend.
3. **Evidence registration:** all metadata fields, secure upload, progress and errors.
4. **Evidence list:** searchable, filterable, paginated table with ID, title, category, case number, custodian, date, integrity status, actions. Filters by ID/title, category, custodian, status.
5. **Evidence details:** metadata, file info, original hash, custodian, registration details, transaction info, latest verification. Permission-dependent verify/download/transfer/history actions.
6. **Custody transfer:** evidence, current custodian, receiver, reason, confirmation, transaction result.
7. **Custody history:** chronological timeline and transaction references.
8. **User management:** administrator-only create users, assign roles, activate/deactivate, view users.
9. **Blockchain activity:** app-specific transactions with hash, block, type, status, timestamp, evidence ID. Do not call it a full blockchain explorer.
10. **Profile:** name, email, role, blockchain address, account status.

## 14. Backend REST API

Use FastAPI routers, services, models, schemas, configuration, and dependency injection.

Suggested endpoints:

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Users
- `GET /api/users`
- `GET /api/users/{user_id}`
- `POST /api/users`
- `PATCH /api/users/{user_id}`
- `PATCH /api/users/{user_id}/status`

### Evidence
- `POST /api/evidence`
- `GET /api/evidence`
- `GET /api/evidence/{evidence_id}`
- `GET /api/evidence/{evidence_id}/download`
- `GET /api/evidence/{evidence_id}/history`
- `POST /api/evidence/{evidence_id}/verify`
- `POST /api/evidence/{evidence_id}/transfer`
- `GET /api/evidence/{evidence_id}/transactions`

### Dashboard
- `GET /api/dashboard/stats`
- `GET /api/dashboard/recent-activity`

### Blockchain
- `GET /api/blockchain/status`
- `GET /api/blockchain/transactions`
- `GET /api/blockchain/transactions/{transaction_hash}`
- `GET /api/blockchain/evidence/{evidence_id}`

Requirements:
- Pydantic schemas
- Correct HTTP status codes
- Consistent JSON errors
- Input validation
- Pagination and filters
- Auth and role dependencies
- Graceful blockchain error handling
- No secrets/private keys in responses
- Swagger documentation at `/docs`

## 15. Database design

Use PostgreSQL, SQLAlchemy, and Alembic.

Suggested tables:

**`users`**
- id, full_name, email (unique), password_hash, role, blockchain_address, is_active, created_at, updated_at

**`evidence`**
- id, evidence_id (unique), title, description, category, case_number, collection_location, collection_datetime, original_filename, storage_filename, mime_type, file_size, original_sha256 (cached copy), initial_custodian_id, current_custodian_id (cached copy), registration_status, blockchain_transaction_hash, blockchain_block_number, created_by, created_at

**`transactions`**
- id, evidence_id, transaction_hash, transaction_type, block_number, transaction_status, created_at

**`integrity_checks`**
- id, evidence_id, performed_by, calculated_hash, blockchain_hash, result, checked_at

**`audit_logs`**
- id, user_id, action, resource_type, resource_id, description, created_at

Use primary/foreign keys, indexes, constraints, and database transactions. Clearly distinguish cached database values from authoritative on-chain values.

## 16. Docker and Docker Compose

Docker is mandatory. The complete environment must start through Docker Compose.

Suggested services:
- `frontend`
- `backend`
- `postgres`
- `blockchain`

Hardhat runs a local network. Backend connects using the internal Docker hostname and port, not `localhost` from inside the backend container. Configure Next.js browser-side and container-side API URLs correctly.

Requirements:
- Dockerfile for frontend
- Dockerfile for backend
- Dockerfile or suitable image/command for Hardhat
- PostgreSQL service
- Persistent database and evidence volumes
- Shared Docker network
- Health checks where practical
- Startup readiness/retry logic
- Environment configuration
- No unnecessary exposed ports

`depends_on` alone does not guarantee readiness. Implement health checks and connection retries.

Startup sequence:
1. PostgreSQL becomes healthy.
2. Hardhat RPC becomes available.
3. Contract compiles and deploys.
4. Deployment writes contract address and ABI/configuration where backend can access them.
5. Backend waits for database and blockchain.
6. Migrations run.
7. Development seed accounts are created when enabled.
8. Backend starts.
9. Frontend starts.

Handle blockchain restarts. A fresh local chain has a fresh state; redeploy and update backend configuration. Do not assume an old contract address remains valid.

Required commands:

```bash
# Build and start
docker compose up --build

# Start in background
docker compose up --build -d

# Stop containers; keep persistent volumes
docker compose down

# View all logs
docker compose logs -f

# Backend logs
docker compose logs -f backend

# Restart services
docker compose restart

# Destructive: removes database and evidence volumes
docker compose down -v
```

Warn that `down -v` deletes database and evidence-storage volumes. Never recommend it for ordinary restarts.

## 17. Environment configuration

Create `.env.example` with documented settings for:
- PostgreSQL database name/user/password
- Database URL
- JWT secret and expiry
- Backend port
- Frontend API URL
- Evidence storage directory
- Maximum upload size
- Hardhat RPC URL
- Contract address/configuration
- Development blockchain signer/private key
- Development seed toggle

Never commit a real `.env` or secrets. Add `.env` to `.gitignore`. Use development-only keys and label them unsafe for production.

## 18. Blockchain deployment

Create a repeatable workflow:
1. Start Hardhat.
2. Compile contract.
3. Deploy contract.
4. Save contract address and ABI to a shared/configured location.
5. Make deployment details available to backend.
6. Confirm contract accessibility.
7. Expose connection status through API.

Do not require manual copying of contract addresses after each clean startup.

## 19. Error handling

Handle invalid login, expired JWT, inactive user, unauthorized evidence access, unsupported/oversized/empty file, duplicate evidence ID, missing file, integrity mismatch, blockchain unavailable, deployment failure, pending/failed/reverted transaction, invalid receiver, repeated transfer, database unavailable, and partial registration failure.

Return understandable errors. Never expose stack traces, passwords, private keys, or server secrets.

## 20. Testing

### Smart contract tests
- Valid registration
- Duplicate ID rejected
- Invalid hash rejected
- Unauthorized transfer rejected
- Valid transfer succeeds
- Current custodian updates
- Chronological history
- Original hash cannot be overwritten

### Backend tests
- Login/JWT
- Role permissions
- Upload and registration
- Backend SHA-256
- Evidence list/details
- Download authorization
- Transfer authorization
- Integrity match/mismatch
- Missing file
- Blockchain failure handling

### Frontend checks
- Login
- Dashboard
- Registration
- Evidence list/details
- Integrity result
- Transfer
- History chronology
- Unauthorized actions unavailable

### End-to-end demonstration
1. Log in as Administrator.
2. Create/confirm development users.
3. Log in as Evidence Collector.
4. Register a real test evidence file.
5. Confirm backend SHA-256.
6. Confirm blockchain registration and receipt.
7. Log in as Investigator and perform an authorized transfer.
8. Verify integrity.
9. Transfer to Forensic Analyst.
10. Verify again.
11. Transfer to Court/Reviewer.
12. Inspect chronological history.
13. Modify a test copy of the file and demonstrate mismatch.

Do not claim a file was modified unless its bytes were actually changed. Do not overwrite the original hash.

## 21. Development seed data

Provide a seed command creating:
- Administrator
- Evidence Collector
- Investigator
- Forensic Analyst
- Court Reviewer

Use environment variables or generated development credentials. Document how to obtain them. Never use production passwords.

A sample evidence file is optional and must be clearly labeled. Do not register fake on-chain evidence unless an explicit demo seed option is enabled.

## 22. Suggested project structure

```text
project-root/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   ├── public/
│   └── Dockerfile
├── backend/
│   ├── app/
│   │   ├── api/routes/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── blockchain/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── blockchain/
│   ├── contracts/EvidenceChainOfCustody.sol
│   ├── scripts/
│   ├── test/
│   ├── hardhat.config.js
│   └── Dockerfile
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── demonstration-guide.md
├── storage/evidence/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

Adjust when technically justified, but keep frontend, backend, and blockchain responsibilities separate. Do not put all business logic in one file.

## 23. Documentation deliverables

Create `README.md` covering overview, problem, objectives, features, stack, architecture, structure, prerequisites, Docker setup, environment configuration, startup, database initialization, contract deployment, development accounts, registration, transfers, integrity checks, blockchain history, tests, troubleshooting, and limitations.

Also create:
- `docs/architecture.md`
- `docs/api.md`
- `docs/demonstration-guide.md`

The demonstration guide must give a lecturer-friendly sequence for showing the complete workflow.

## 24. Security and limitations

1. Never store actual evidence files on-chain.
2. Calculate original hash on backend.
3. Never trust client-provided hash.
4. Keep keys and secrets out of source code.
5. Enforce authorization in backend and contract logic.
6. Never allow unauthorized transfers.
7. Never overwrite original registered hash.
8. Never represent a database row as proof of a blockchain transaction.
9. Confirm transaction receipts before reporting success.
10. Keep files private and access-controlled.

Document:
- Blockchain cannot prove a file was genuine before initial registration.
- The system demonstrates integrity from registration onward.
- Local Hardhat is educational and does not provide public-chain decentralization.
- Backend-managed signing creates a trust dependency on the backend.
- This is not a certified forensic platform and does not replace formal evidence-handling procedures.

## 25. Implementation phases

At the end of each phase, report changed files, commands run, test results, and unresolved issues.

### Phase 1 — Inspect and plan
Inspect workspace and existing files, identify dependencies, propose structure, identify risks/integration points, and create a checklist. Do not delete useful work.

### Phase 2 — Blockchain
Configure Hardhat, implement contract and deployment script, write tests, run tests, and fix failures.

### Phase 3 — Backend foundation
Initialize FastAPI, configure PostgreSQL/SQLAlchemy/Alembic, create models/migrations, implement authentication/roles, configure Web3.py.

### Phase 4 — Evidence management
Implement secure upload/storage, SHA-256, registration, contract integration, listing, and detail APIs.

### Phase 5 — Custody and integrity
Implement authorization, transfers, transaction confirmations, history, integrity checks, and error handling.

### Phase 6 — Frontend
Implement layout/navigation, login, dashboard, registration, list/details, transfer, history, integrity verification, user management, and blockchain activity.

### Phase 7 — Docker
Create Dockerfiles/Compose, volumes, networks, readiness checks, deployment workflow, and verify clean startup.

### Phase 8 — Testing
Run contract/backend tests, frontend checks, full end-to-end workflow, modified-file detection, fix failures, and retest.

### Phase 9 — Documentation and handoff
Complete documentation and provide exact startup/test commands, URLs, development credentials, limitations, and blockers.

## 26. Acceptance criteria

The project is complete only when verified:

- [ ] Docker Compose starts the application.
- [ ] Frontend is accessible.
- [ ] Backend API is accessible.
- [ ] PostgreSQL connects and persists data.
- [ ] Hardhat network runs.
- [ ] Contract deploys and is accessible.
- [ ] Login works.
- [ ] Role-based permissions work.
- [ ] Evidence uploads securely.
- [ ] Backend generates SHA-256.
- [ ] Registration is confirmed on-chain.
- [ ] Actual files remain off-chain.
- [ ] Unauthorized transfers are rejected.
- [ ] Authorized transfers are confirmed on-chain.
- [ ] History is chronological and blockchain-derived.
- [ ] Integrity verification works.
- [ ] Modified test file produces mismatch.
- [ ] Original on-chain hash remains unchanged.
- [ ] Evidence and database data survive container restarts.
- [ ] Contract tests pass.
- [ ] Backend tests pass.
- [ ] End-to-end demonstration succeeds.
- [ ] Documentation is complete.

Do not mark a feature complete merely because code exists. Verify it by running the system and tests.

## 27. Agent operating instructions

1. Build the actual application, not only a prototype.
2. Do not skip backend functionality.
3. Do not replace blockchain transactions with fake database entries.
4. Do not hardcode integrity results.
5. Do not use fake transaction hashes.
6. Do not store files on-chain.
7. Do not expose development private keys.
8. Do not leave core buttons non-functional.
9. Do not silently ignore errors.
10. Do not over-engineer this semester project.
11. Keep code modular and understandable.
12. Verify each phase before proceeding.
13. Run commands and tests; do not assume code works.
14. Investigate and fix failures.
15. Continue beyond scaffolding until acceptance criteria pass or a genuine external blocker is documented.
16. If a decision is ambiguous, choose the simplest secure and explainable option, document it, and continue. Ask the user only when a decision genuinely blocks progress or materially changes the project.

## 28. Required final report

At completion, provide:
- Implemented features
- Final folder structure
- Technologies and versions
- Docker startup/shutdown commands
- Frontend/backend URLs
- Development credentials or generation instructions
- Contract address and deployment information
- Test commands and actual results
- End-to-end demonstration results
- Known limitations
- Incomplete work and exact reason

## Final objective

Deliver a complete, Docker-based, locally runnable **Blockchain-Based Digital Evidence Chain-of-Custody System** demonstrating evidence registration, backend-generated SHA-256 integrity checking, authorized custody transfers, and verifiable blockchain-based custody history.
