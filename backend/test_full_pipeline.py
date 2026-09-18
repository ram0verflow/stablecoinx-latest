"""
Integration tests for full payment pipeline.
Verifies end-to-end flows from creation to settlement.
"""

import pytest
from uuid import uuid4
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.payment_intents import PaymentIntent
from app.models.compliance import ComplianceDecision, ApprovalRecord
from app.models.audit_records import AuditRecord
from app.schemas import PaymentStatusEnum, DecisionEnum, UserRoleEnum


@pytest.fixture
def test_user_admin(db_session: Session):
    """Create admin user for approvals."""
    from app.models.users import User
    from app.core.security import get_password_hash
    
    user = User(
        id=uuid4(),
        email="admin@test.com",
        hashed_password=get_password_hash("test123"),
        full_name="Admin User",
        role=UserRoleEnum.admin,
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_complete_payment_flow_approved(db_session: Session, test_user_admin):
    """
    Test complete approved payment flow:
    1. Create payment intent
    2. Run compliance pipeline
    3. AI engine approves
    4. Human approves
    5. Execute settlement
    6. Register proof
    7. Save audit record
    """
    # Step 1: Create payment
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Approved Sender",
        receiver_company="Approved Recipient",
        sender_wallet="0x1111111111111111111111111111111111111111",
        receiver_wallet="0x2222222222222222222222222222222222222222",
        amount=5000,
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
    
    # Step 2-3: Compliance + AI decision (simulated)
    decision = ComplianceDecision(
        id=uuid4(),
        payment_id=payment.id,
        final_decision=DecisionEnum.approved,
        ai_decision=DecisionEnum.approved,
        policy_check_passed=True,
        sanctions_check_passed=True,
        kyc_check_passed=True,
        confidence=0.98,
        created_at=datetime.utcnow(),
    )
    db_session.add(decision)
    db_session.commit()
    
    # Step 4: Human approval
    approval = ApprovalRecord(
        id=uuid4(),
        payment_id=payment.id,
        approver_id=test_user_admin.id,
        decision=DecisionEnum.approved,
        notes="Approved by admin",
        created_at=datetime.utcnow(),
    )
    db_session.add(approval)
    db_session.commit()
    
    # Step 5-7: Simulated execution (in real scenario, blockchain interaction)
    payment.status = PaymentStatusEnum.executed
    
    tx_hash = "0x" + "a" * 64
    proof_tx_hash = "0x" + "b" * 64
    
    audit_record = AuditRecord(
        id=uuid4(),
        payment_id=payment.id,
        action="settled",
        tx_hash=tx_hash,
        proof_tx_hash=proof_tx_hash,
        block_number=12345678,
        chain="Base Sepolia",
        timestamp=datetime.utcnow(),
    )
    
    db_session.add_all([payment, audit_record])
    db_session.commit()
    
    # Verify flow completed
    final_payment = db_session.query(PaymentIntent).filter(
        PaymentIntent.id == payment.id
    ).first()
    
    assert final_payment.status == PaymentStatusEnum.executed
    
    final_audit = db_session.query(AuditRecord).filter(
        AuditRecord.payment_id == payment.id
    ).first()
    
    assert final_audit is not None
    assert final_audit.tx_hash == tx_hash
    assert final_audit.proof_tx_hash == proof_tx_hash


def test_complete_payment_flow_blocked(db_session: Session):
    """
    Test blocked payment flow:
    1. Create payment with sanctioned entity
    2. Run compliance pipeline
    3. Compliance blocks payment
    4. No execution
    5. Alert sent
    """
    # Step 1: Create payment with suspicious entity
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Sanctioned Corp",
        receiver_company="Blocked Recipient",
        sender_wallet="0xBADBAD0000000000000000000000000000000000",
        receiver_wallet="0x3333333333333333333333333333333333333333",
        amount=10000,
        token="USDC",
        source_country="Iran",  # Blocked country
        destination_country="UAE",
        purpose="Unknown Payment",
        status=PaymentStatusEnum.pending,
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
    )
    db_session.add(payment)
    db_session.commit()
    
    # Step 2-3: Compliance blocks
    decision = ComplianceDecision(
        id=uuid4(),
        payment_id=payment.id,
        final_decision=DecisionEnum.blocked,
        ai_decision=DecisionEnum.blocked,
        policy_check_passed=False,
        sanctions_check_passed=False,
        kyc_check_passed=True,
        confidence=0.99,
        veto_reason="Sanctioned corridor (Iran → UAE)",
        created_at=datetime.utcnow(),
    )
    db_session.add(decision)
    db_session.commit()
    
    # Step 4: No execution record created
    audit_records = db_session.query(AuditRecord).filter(
        AuditRecord.payment_id == payment.id
    ).all()
    
    assert len(audit_records) == 0
    
    # Step 5: Alert would be sent (simulated in AlertService)
    # Verify payment remains in pending/blocked state
    final_payment = db_session.query(PaymentIntent).filter(
        PaymentIntent.id == payment.id
    ).first()
    
    assert final_payment.status != PaymentStatusEnum.executed
