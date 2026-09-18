import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Numeric, DateTime, Enum, ForeignKey, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class PaymentStatus(str, PyEnum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    executed = "executed"
    failed = "failed"
    blocked = "blocked"
    revalidation = "revalidation"


class PaymentIntent(Base):
    __tablename__ = "payment_intents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sender_company = Column(String(255), nullable=False)
    receiver_company = Column(String(255), nullable=False)
    source_country = Column(String(100), nullable=False)
    destination_country = Column(String(100), nullable=False)
    source_chain = Column(String(100), nullable=False)
    destination_chain = Column(String(100), nullable=False)
    amount = Column(Numeric(precision=20, scale=6), nullable=False)
    token = Column(String(10), nullable=False)  # USDC / USDT
    purpose = Column(String(255), nullable=False)
    sender_wallet = Column(String(42), nullable=True)
    receiver_wallet = Column(String(42), nullable=True)
    urgency = Column(String(20), nullable=False, default="medium")
    intent_hash = Column(String(64), nullable=True, index=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    revert_reason = Column(Text, nullable=True)
    status = Column(
        Enum(PaymentStatus),
        nullable=False,
        default=PaymentStatus.pending,
    )
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    creator = relationship("User", back_populates="payment_intents")
    compliance_decisions = relationship(
        "ComplianceDecision", back_populates="payment"
    )
    approvals = relationship("Approval", back_populates="payment")
    audit_records = relationship("AuditRecord", back_populates="payment")
    alerts = relationship("Alert", back_populates="payment")
    revalidation_records = relationship(
        "RevalidationRecord", back_populates="payment"
    )
