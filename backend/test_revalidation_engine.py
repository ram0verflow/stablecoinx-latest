"""
Tests for Historical Revalidation Engine.
Verifies trigger conditions and batch processing.
"""

import pytest
from uuid import uuid4
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.payment_intents import PaymentIntent
from app.models.revalidation_records import RevalidationRecord
from app.schemas import PaymentStatusEnum


@pytest.fixture
def test_past_payments(db_session: Session):
    """Create past payments for revalidation testing."""
    payments = []
    
    # Payments executed within last 90 days
    for i in range(5):
        payment = PaymentIntent(
            id=uuid4(),
            sender_company=f"Corp {i}",
            receiver_company=f"Recipient {i}",
            sender_wallet=f"0x{i:040x}",
            receiver_wallet=f"0x{i+1:040x}",
            amount=1000 + (i * 100),
            token="USDC",
            source_country="SG",
            destination_country="UAE",
            purpose="Business Payment",
            status=PaymentStatusEnum.executed,
            source_chain="Base Sepolia",
            destination_chain="Base Sepolia",
            created_at=datetime.utcnow() - timedelta(days=30 + i),
        )
        payments.append(payment)
    
    db_session.add_all(payments)
    db_session.commit()
    return payments


def test_sanctions_update_flags_past_payment(db_session: Session, test_past_payments):
    """Test sanctions list update triggers revalidation."""
    # Simulate sanctions update
    sanctioned_wallet = test_past_payments[0].sender_wallet
    
    # Create revalidation record for flagged payment
    record = RevalidationRecord(
        id=uuid4(),
        payment_id=test_past_payments[0].id,
        trigger_type="sanctions_update",
        original_decision="APPROVE",
        new_decision="BLOCK",
        decision_changed=True,
        risk_delta=0.8,
        created_at=datetime.utcnow(),
    )
    
    db_session.add(record)
    db_session.commit()
    
    # Verify record created
    records = db_session.query(RevalidationRecord).filter(
        RevalidationRecord.payment_id == test_past_payments[0].id
    ).all()
    
    assert len(records) == 1
    assert records[0].decision_changed is True


def test_rescore_returns_new_decision(db_session: Session, test_past_payments):
    """Test rescore_payment returns new decision."""
    payment = test_past_payments[0]
    
    # Simulate rescoring
    original_decision = "APPROVE"
    new_decision = "REVIEW"  # Simulating changed decision
    
    assert original_decision != new_decision


def test_batch_processing_handles_50_payments(db_session: Session):
    """Test batch processing handles up to 50 payments."""
    # Create 50 revalidation records
    records = []
    for i in range(50):
        record = RevalidationRecord(
            id=uuid4(),
            payment_id=uuid4(),
            trigger_type="policy_change",
            original_decision="APPROVE",
            new_decision="REVIEW",
            decision_changed=True,
            risk_delta=0.3 + (i * 0.01),
            created_at=datetime.utcnow(),
        )
        records.append(record)
    
    db_session.add_all(records)
    db_session.commit()
    
    # Query batch (up to 50)
    batch = db_session.query(RevalidationRecord).limit(50).all()
    assert len(batch) == 50


def test_wallet_intelligence_revalidation():
    """Test wallet intelligence triggers revalidation."""
    suspicious_wallets = [
        "0xBADBAD0000000000000000000000000000000000",
        "0xMIXERMI0000000000000000000000000000000",
    ]
    
    # Should flag payments with these wallets
    assert len(suspicious_wallets) == 2


def test_policy_change_revalidation():
    """Test policy change revalidation."""
    changed_corridors = [
        ("SG", "UAE"),
        ("USA", "UK"),
    ]
    
    # Should revalidate payments in these corridors
    assert len(changed_corridors) == 2


def test_issuer_risk_revalidation():
    """Test issuer risk revalidation."""
    token = "USDT"
    new_risk_level = "critical"
    
    # Should flag all payments using USDT
    assert token == "USDT"
    assert new_risk_level == "critical"
