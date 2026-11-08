#!/bin/sh
set -e

echo "Waiting for PostgreSQL database to be reachable..."
python - << 'EOF'
import os
import sys
import time
import psycopg2
from urllib.parse import urlparse

db_url = os.environ.get("DATABASE_URL", "")
if not db_url or "sqlite" in db_url:
    sys.exit(0)

parsed = urlparse(db_url)
username = parsed.username or "postgres"
password = parsed.password or "postgres"
hostname = parsed.hostname or "postgres"
port = parsed.port or 5432
database = parsed.path.lstrip("/") or "evidence_custody"

max_retries = 30
for attempt in range(max_retries):
    try:
        conn = psycopg2.connect(
            dbname=database,
            user=username,
            password=password,
            host=hostname,
            port=port,
            connect_timeout=3
        )
        conn.close()
        print("Successfully connected to PostgreSQL database!")
        sys.exit(0)
    except Exception as e:
        print(f"Waiting for PostgreSQL ({hostname}:{port}). Attempt {attempt + 1}/{max_retries}: {e}")
        time.sleep(2)

print("Warning: Timed out waiting for PostgreSQL. Continuing anyway...")
EOF

echo "Waiting for Hardhat blockchain node and contract deployment..."
python - << 'EOF'
import os
import sys
import time
from urllib.parse import urlparse
from web3 import Web3
from pathlib import Path

rpc_url = os.environ.get("HARDHAT_RPC_URL", "http://blockchain:8545")
w3 = Web3(Web3.HTTPProvider(rpc_url))

contract_paths = [
    Path(os.environ.get("CONTRACT_ABI_PATH", "app/blockchain/contract_info.json")),
    Path("/app/app/blockchain/contract_info.json"),
    Path("/app/deployments/contract_info.json"),
]

max_retries = 30
for attempt in range(max_retries):
    try:
        if w3.is_connected():
            for p in contract_paths:
                if p.exists() and p.stat().st_size > 0:
                    print(f"Connected to blockchain RPC and verified contract artifact at {p}!")
                    sys.exit(0)
            print(f"Connected to blockchain RPC ({rpc_url}). Waiting for contract deployment... (Attempt {attempt + 1}/{max_retries})")
    except Exception as e:
        print(f"Waiting for blockchain RPC at {rpc_url}... (Attempt {attempt + 1}/{max_retries})")
    time.sleep(2)

print("Warning: Timed out waiting for blockchain or artifact. Starting backend anyway...")
EOF

echo "Running Alembic migrations..."
alembic upgrade head || echo "Alembic migration command executed (or skipped if SQLite in-memory)."

echo "Seeding development demo accounts..."
python -m app.db.seed || echo "Seed script completed or skipped."

echo "Starting Uvicorn FastAPI server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8000} --workers 1

