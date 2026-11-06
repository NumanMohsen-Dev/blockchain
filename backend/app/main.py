import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, blockchain, dashboard, evidence, users
from app.blockchain.client import blockchain_client
from app.core.config import settings
from app.db.base import Base
from app.db.seed import seed_demo_users
from app.db.session import SessionLocal, engine

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("evidence_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Initializing Blockchain Evidence API backend...")
    
    # Create DB tables if not existing
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")
    except Exception as e:
        logger.error(f"Database table verification error: {e}")

    # Seed demo users if enabled
    if settings.SEED_DEMO_USERS:
        db = SessionLocal()
        try:
            seed_demo_users(db)
        except Exception as e:
            logger.warning(f"Error seeding demo users: {e}")
        finally:
            db.close()

    # Blockchain connection check
    try:
        blockchain_client.refresh_connection()
        status = blockchain_client.get_status()
        if status["connected"]:
            logger.info(
                f"Connected to Blockchain network (Chain ID: {status['chain_id']}). "
                f"Contract: {status['contract_address']} (Accessible: {status['contract_accessible']})"
            )
        else:
            logger.warning("Blockchain node is currently unreachable. Will retry on demand.")
    except Exception as e:
        logger.warning(f"Initial blockchain probe encountered an error: {e}")

    yield

    # Shutdown actions
    logger.info("Shutting down Blockchain Evidence API backend.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Blockchain-Based Digital Evidence Chain-of-Custody System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(evidence.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(blockchain.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"])
def health_check():
    """Simple healthcheck endpoint for Docker container orchestration."""
    return {
        "status": "healthy",
        "service": "evidence-backend",
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
def root():
    return {
        "message": settings.PROJECT_NAME,
        "docs": "/docs",
        "api_prefix": settings.API_V1_PREFIX,
    }

