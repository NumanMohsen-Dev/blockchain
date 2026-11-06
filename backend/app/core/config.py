import json
from pathlib import Path
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Blockchain-Based Digital Evidence Chain-of-Custody System"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"
    BACKEND_PORT: int = 8000

    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            return json.loads(v)
        return v

    # PostgreSQL Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/evidence_custody"

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_url(cls, v: str) -> str:
        if v and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    # Security & JWT
    JWT_SECRET_KEY: str = "development_jwt_secret_key_change_in_production_min_32_chars!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Evidence Storage
    EVIDENCE_STORAGE_PATH: str = "./storage/evidence"
    MAX_UPLOAD_SIZE_BYTES: int = 104857600  # 100 MB

    # Blockchain
    HARDHAT_RPC_URL: str = "http://127.0.0.1:8545"
    BLOCKCHAIN_CHAIN_ID: int = 31337
    CONTRACT_ADDRESS: str = ""
    CONTRACT_ABI_PATH: str = "app/blockchain/contract_info.json"

    # Development Signer (Hardhat Account #0 default)
    DEVELOPMENT_SIGNER_ADDRESS: str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    DEVELOPMENT_SIGNER_PRIVATE_KEY: str = (
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    )

    SEED_DEMO_USERS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
