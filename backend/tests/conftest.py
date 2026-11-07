import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set test environment variables before importing app modules
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test_super_secret_jwt_key_for_testing_purposes_only!"
os.environ["SEED_DEMO_USERS"] = "False"
os.environ["DEBUG"] = "True"

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User, UserRole

# SQLite in-memory engine with static pool for isolated tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_admin_user(db):
    admin = User(
        full_name="Test Admin",
        email="test_admin@evidence.org",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        blockchain_address="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
        is_active=True,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def test_collector_user(db):
    collector = User(
        full_name="Test Collector",
        email="test_collector@evidence.org",
        password_hash=get_password_hash("CollectorPass123!"),
        role=UserRole.EVIDENCE_COLLECTOR,
        blockchain_address="0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
        is_active=True,
    )
    db.add(collector)
    db.commit()
    db.refresh(collector)
    return collector


@pytest.fixture
def test_inactive_user(db):
    inactive = User(
        full_name="Inactive User",
        email="inactive@evidence.org",
        password_hash=get_password_hash("InactivePass123!"),
        role=UserRole.INVESTIGATOR,
        blockchain_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        is_active=False,
    )
    db.add(inactive)
    db.commit()
    db.refresh(inactive)
    return inactive


@pytest.fixture
def admin_token(client, test_admin_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_admin_user.email, "password": "AdminPass123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture
def collector_token(client, test_collector_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_collector_user.email, "password": "CollectorPass123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture
def test_investigator_user(db):
    investigator = User(
        full_name="Detective Miller (Investigator)",
        email="test_investigator@evidence.org",
        password_hash=get_password_hash("InvestigatorPass123!"),
        role=UserRole.INVESTIGATOR,
        blockchain_address="0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        is_active=True,
    )
    db.add(investigator)
    db.commit()
    db.refresh(investigator)
    return investigator


@pytest.fixture
def investigator_token(client, test_investigator_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_investigator_user.email, "password": "InvestigatorPass123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture
def test_court_user(db):
    court = User(
        full_name="Judge Court Reviewer",
        email="test_court@evidence.org",
        password_hash=get_password_hash("CourtPass123!"),
        role=UserRole.COURT_REVIEWER,
        blockchain_address="0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
        is_active=True,
    )
    db.add(court)
    db.commit()
    db.refresh(court)
    return court


@pytest.fixture
def court_token(client, test_court_user):
    resp = client.post(
        "/api/auth/login",
        json={"email": test_court_user.email, "password": "CourtPass123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture(autouse=True)
def configure_test_storage(tmp_path, monkeypatch):
    from app.services.storage_service import storage_service
    monkeypatch.setattr(storage_service, "base_path", tmp_path)

