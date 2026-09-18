"""
Pytest configuration and fixtures for SettleGuard tests.
Environment is set before any `app.*` import so Settings() can construct.
"""

import os

_TEST_ENV = {
    "APP_ENV": "development",
    "DATABASE_URL": "sqlite:///:memory:",
    "JWT_SECRET_KEY": "pytest-local-secret-key-32chars-min",
    "SUPABASE_URL": "https://placeholder.supabase.co",
    "SUPABASE_ANON_KEY": "pytest-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "pytest-service-role-key",
    "BASE_SEPOLIA_RPC_URL": "https://sepolia.base.org",
    "BACKEND_WALLET_PRIVATE_KEY": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "OLLAMA_BASE_URL": "http://127.0.0.1:11434",
    "OLLAMA_MODEL": "gemma:2b",
    "GROQ_API_KEY": "not-configured",
    "GROQ_MODEL": "llama3-8b-8192",
    "BASE_SEPOLIA_CHAIN_ID": "84532",
    "CONTRACT_ABI_PATH": "contracts/out",
    "REDIS_URL": "redis://localhost:6379",
    "NEO4J_URI": "bolt://localhost:7687",
    "NEO4J_USERNAME": "neo4j",
    "NEO4J_PASSWORD": "pytest",
    "TELEGRAM_BOT_TOKEN": "disabled",
    "TELEGRAM_CHAT_ID": "0",
    "CONTRACT_ADDRESS_SETTLEMENT": "0x0000000000000000000000000000000000000001",
    "CONTRACT_ADDRESS_COMPLIANCE": "0x0000000000000000000000000000000000000002",
    "CONTRACT_ADDRESS_TREASURY": "0x0000000000000000000000000000000000000003",
    "CONTRACT_ADDRESS_REGISTRY": "0x0000000000000000000000000000000000000004",
    "CORS_ORIGINS": "http://localhost:5173",
}
for _k, _v in _TEST_ENV.items():
    os.environ.setdefault(_k, _v)

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from uuid import uuid4

from app.db.database import Base
from app.models.users import User, UserRole
from app.core.security import get_password_hash


TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL, connect_args={"check_same_thread": False}, echo=False
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session() -> Session:
    """Create a test database session."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_user(db_session: Session) -> User:
    """Create a test admin user."""
    user = User(
        id=uuid4(),
        email="test@example.com",
        hashed_password=get_password_hash("testpass123"),
        full_name="Test User",
        role=UserRole.admin,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def test_treasury_officer(db_session: Session) -> User:
    """Create a test treasury officer user."""
    user = User(
        id=uuid4(),
        email="treasury@example.com",
        hashed_password=get_password_hash("testpass123"),
        full_name="Treasury Officer",
        role=UserRole.treasury_officer,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture(scope="function")
def test_compliance_officer(db_session: Session) -> User:
    """Create a test compliance officer user."""
    user = User(
        id=uuid4(),
        email="compliance@example.com",
        hashed_password=get_password_hash("testpass123"),
        full_name="Compliance Officer",
        role=UserRole.compliance_officer,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user
