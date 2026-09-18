"""
Pytest configuration and fixtures for SettleGuard tests.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from uuid import uuid4

from app.db.database import Base
from app.models.users import User
from app.schemas import UserRoleEnum
from app.core.security import get_password_hash


# Use in-memory SQLite for testing
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
        role=UserRoleEnum.admin,
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
        role=UserRoleEnum.treasury_officer,
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
        role=UserRoleEnum.compliance_officer,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user
