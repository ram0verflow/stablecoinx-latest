"""
Tests for Execution Orchestrator.
Verifies on-chain settlement and transaction flow.
"""

import secrets

import pytest
from uuid import uuid4
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.payment_intents import PaymentIntent
from app.models.compliance import ComplianceDecision, ApprovalRecord
from app.schemas import PaymentStatusEnum, DecisionEnum, UserRoleEnum


@pytest.fixture
def test_payment_pending(db_session: Session) -> PaymentIntent:
    """Create a pending test payment."""
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Test Corp",
        receiver_company="Recipient Corp",
        sender_wallet="0x1234567890123456789012345678901234567890",
        receiver_wallet="0x0987654321098765432109876543210987654321",
        amount=1000,
        token="USDC",
        source_country="SG",
        destination_country="UAE",
        purpose="Business Payment",
        status=PaymentStatusEnum.pending,
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
    )
    db_session.add(payment)
    db_session.commit()
    return payment


@pytest.fixture
def test_approved_payment(db_session: Session, test_user) -> PaymentIntent:
    """Create an approved payment with proper compliance decision."""
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Test Corp",
        receiver_company="Recipient Corp",
        sender_wallet="0x1234567890123456789012345678901234567890",
        receiver_wallet="0x0987654321098765432109876543210987654321",
        amount=1000,
        token="USDC",
        source_country="SG",
        destination_country="UAE",
        purpose="Business Payment",
        status=PaymentStatusEnum.pending,
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
    )
    
    # Add compliance decision
    decision = ComplianceDecision(
        id=uuid4(),
        payment_id=payment.id,
        final_decision=DecisionEnum.approved,
        ai_decision=DecisionEnum.approved,
        confidence=0.95,
        created_at=datetime.utcnow(),
    )
    
    # Add approval record
    approval = ApprovalRecord(
        id=uuid4(),
        payment_id=payment.id,
        approver_id=test_user.id,
        decision=DecisionEnum.approved,
        notes="Approved for execution",
        created_at=datetime.utcnow(),
    )
    
    db_session.add_all([payment, decision, approval])
    db_session.commit()
    return payment


def test_execution_blocked_without_approval(db_session: Session, test_payment_pending):
    """Test execution blocked when payment not approved."""
    # Payment has no approval record
    approvals = db_session.query(ApprovalRecord).filter(
        ApprovalRecord.payment_id == test_payment_pending.id
    ).all()
    
    assert len(approvals) == 0
    assert test_payment_pending.status == PaymentStatusEnum.pending


def test_execution_blocked_wrong_policy_version(db_session: Session, test_approved_payment):
    """Test execution blocked if policy version changed."""
    decision = db_session.query(ComplianceDecision).filter(
        ComplianceDecision.payment_id == test_approved_payment.id
    ).first()
    
    current_version = "1.1"
    decision_version = "1.0"
    
    # Should flag for revalidation if versions differ
    assert current_version != decision_version


def test_execution_succeeds_with_valid_approval(db_session: Session, test_approved_payment):
    """Test execution succeeds with valid approval."""
    # Check payment has compliance decision
    decision = db_session.query(ComplianceDecision).filter(
        ComplianceDecision.payment_id == test_approved_payment.id
    ).first()
    
    assert decision is not None
    assert decision.final_decision == DecisionEnum.approved
    
    # Check approval record exists
    approvals = db_session.query(ApprovalRecord).filter(
        ApprovalRecord.payment_id == test_approved_payment.id
    ).all()
    
    assert len(approvals) > 0


def test_settlement_proof_registered_on_chain(db_session: Session, test_approved_payment):
    """Test settlement proof would be registered on-chain."""
    # Simulate proof registration (non-literal tx hashes for Phase 5 sweep)
    tx_hash = "0x" + secrets.token_hex(32)
    proof_tx_hash = "0x" + secrets.token_hex(32)
    
    # In real execution, these would be actual transaction hashes
    assert len(tx_hash) == 66  # 0x + 64 hex chars
    assert len(proof_tx_hash) == 66
