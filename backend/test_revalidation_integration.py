"""
Integration test for Historical Revalidation Engine.
Tests all trigger types and API endpoints.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.database import SessionLocal
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.users import User
from app.models.revalidation_records import RevalidationRecord, RevalidationStatus
from app.schemas import UserRoleEnum
from app.core.security import get_password_hash


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture
def test_user(db_session: Session):
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


@pytest.fixture
def test_payment(db_session: Session, test_user: User):
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Test Sender",
        receiver_company="Test Receiver",
        source_country="SG",
        destination_country="UAE",
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
        amount=5000,
        token="USDC",
        purpose="Test Payment",
        status=PaymentStatus.executed,
        created_by=test_user.id,
        created_at=datetime.now(timezone.utc) - timedelta(days=30),
    )
    db_session.add(payment)
    db_session.commit()
    return payment


class TestRevalidationTriggers:
    """Test revalidation trigger endpoints."""

    def test_list_revalidations(self, client: TestClient):
        """Test GET /revalidation/ endpoint."""
        response = client.get("/api/v1/revalidation/")
        assert response.status_code in [200, 401]  # 401 if auth required
        if response.status_code == 200:
            data = response.json()
            assert "total" in data or "records" in data

    def test_trigger_sanctions_revalidation(self, client: TestClient):
        """Test POST /revalidation/trigger/sanctions endpoint."""
        response = client.post("/api/v1/revalidation/trigger/sanctions")
        # May return 401 if auth required, 200 if not
        assert response.status_code in [200, 401]

    def test_trigger_policy_revalidation(self, client: TestClient):
        """Test POST /revalidation/trigger/policy endpoint."""
        response = client.post(
            "/api/v1/revalidation/trigger/policy",
            json={"corridors": ["SG-UAE", "USA-UK"]},
        )
        assert response.status_code in [200, 401]

    def test_trigger_wallet_revalidation(self, client: TestClient):
        """Test POST /revalidation/trigger/wallet endpoint."""
        response = client.post(
            "/api/v1/revalidation/trigger/wallet",
            json={"wallets": ["0x123...", "0x456..."]},
        )
        assert response.status_code in [200, 401]

    def test_trigger_issuer_revalidation(self, client: TestClient):
        """Test POST /revalidation/trigger/issuer endpoint."""
        response = client.post(
            "/api/v1/revalidation/trigger/issuer",
            json={"token": "USDT", "risk_level": "high"},
        )
        assert response.status_code in [200, 401]


class TestRevalidationEngine:
    """Test revalidation engine core logic."""

    @pytest.mark.asyncio
    async def test_trigger_sanctions_logic(self, db_session: Session):
        """Test sanctions trigger logic."""
        from app.services.revalidation_engine import RevalidationEngine

        flagged = await RevalidationEngine.trigger_sanctions_update_revalidation(
            db_session
        )
        assert isinstance(flagged, int)
        assert flagged >= 0

    @pytest.mark.asyncio
    async def test_trigger_policy_logic(self, db_session: Session):
        """Test policy trigger logic."""
        from app.services.revalidation_engine import RevalidationEngine

        flagged = await RevalidationEngine.trigger_policy_change_revalidation(
            db_session, ["SG-UAE"]
        )
        assert isinstance(flagged, int)
        assert flagged >= 0

    @pytest.mark.asyncio
    async def test_trigger_wallet_logic(self, db_session: Session):
        """Test wallet trigger logic."""
        from app.services.revalidation_engine import RevalidationEngine

        flagged = await RevalidationEngine.trigger_wallet_intelligence_revalidation(
            db_session, ["0x123"]
        )
        assert isinstance(flagged, int)
        assert flagged >= 0

    @pytest.mark.asyncio
    async def test_trigger_issuer_logic(self, db_session: Session):
        """Test issuer trigger logic."""
        from app.services.revalidation_engine import RevalidationEngine

        flagged = await RevalidationEngine.trigger_issuer_risk_revalidation(
            db_session, "USDT", "high"
        )
        assert isinstance(flagged, int)
        assert flagged >= 0

    def test_rescore_payment(self, db_session: Session, test_payment: PaymentIntent):
        """Test rescore_payment method."""
        from app.services.revalidation_engine import RevalidationEngine

        result = RevalidationEngine.rescore_payment(db_session, test_payment.id)

        assert result is not None
        assert "original_decision" in result
        assert "new_decision" in result
        assert "changed" in result
        assert "risk_delta" in result

    @pytest.mark.asyncio
    async def test_batch_processing(self, db_session: Session):
        """Test batch processing."""
        from app.services.revalidation_engine import RevalidationEngine

        # Create mock revalidation records
        reval_ids = [uuid4() for _ in range(3)]

        result = await RevalidationEngine.process_revalidation_batch(
            db_session, reval_ids
        )

        assert result is not None
        assert "total_processed" in result
        assert "flagged_for_review" in result
        assert "summary_message" in result

    def test_get_stats(self, db_session: Session):
        """Test stats retrieval."""
        from app.services.revalidation_engine import RevalidationEngine

        stats = RevalidationEngine.get_revalidation_stats(db_session)

        assert stats is not None
        assert "total" in stats
        assert "pending" in stats
        assert "completed" in stats
        assert "flagged_for_review" in stats


class TestRevalidationDatabase:
    """Test revalidation database persistence."""

    def test_create_revalidation_record(self, db_session: Session):
        """Test creating a revalidation record."""
        payment_id = uuid4()
        record = RevalidationRecord(
            id=uuid4(),
            payment_id=payment_id,
            trigger_reason="Test trigger",
            original_decision="APPROVE",
            new_decision="REJECT",
            new_risk_score=85.5,
            status=RevalidationStatus.completed,
        )

        db_session.add(record)
        db_session.commit()

        retrieved = db_session.query(RevalidationRecord).filter_by(
            payment_id=payment_id
        ).first()

        assert retrieved is not None
        assert retrieved.original_decision == "APPROVE"
        assert retrieved.new_decision == "REJECT"
        assert retrieved.new_risk_score == 85.5

    def test_query_by_status(self, db_session: Session):
        """Test querying revalidation records by status."""
        # Create records with different statuses
        for status in [RevalidationStatus.pending, RevalidationStatus.completed]:
            record = RevalidationRecord(
                id=uuid4(),
                payment_id=uuid4(),
                trigger_reason="Test",
                original_decision="APPROVE",
                new_decision="APPROVE",
                status=status,
            )
            db_session.add(record)

        db_session.commit()

        pending_count = db_session.query(RevalidationRecord).filter(
            RevalidationRecord.status == RevalidationStatus.pending
        ).count()

        assert pending_count >= 1

    def test_decision_change_tracking(self, db_session: Session):
        """Test tracking decision changes."""
        # Record with decision change
        changed_record = RevalidationRecord(
            id=uuid4(),
            payment_id=uuid4(),
            trigger_reason="Decision changed",
            original_decision="APPROVE",
            new_decision="REJECT",
            status=RevalidationStatus.completed,
        )

        # Record without decision change
        unchanged_record = RevalidationRecord(
            id=uuid4(),
            payment_id=uuid4(),
            trigger_reason="No change",
            original_decision="APPROVE",
            new_decision="APPROVE",
            status=RevalidationStatus.completed,
        )

        db_session.add(changed_record)
        db_session.add(unchanged_record)
        db_session.commit()

        all_records = db_session.query(RevalidationRecord).all()
        changed_count = sum(
            1
            for r in all_records
            if r.original_decision != r.new_decision
        )

        assert changed_count >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
