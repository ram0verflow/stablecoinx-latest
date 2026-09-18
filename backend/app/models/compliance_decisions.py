import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Text, DateTime, Enum, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base


class AIDecisionType(str, PyEnum):
    direct_transfer = "direct_transfer"
    alternate_chain = "alternate_chain"
    alternate_token = "alternate_token"
    delay = "delay"
    split = "split"
    review = "review"
    block = "block"


class FinalDecision(str, PyEnum):
    approved = "approved"
    rejected = "rejected"
    blocked = "blocked"
    pending_review = "pending_review"


class ComplianceDecision(Base):
    __tablename__ = "compliance_decisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_intents.id"),
        nullable=False,
    )
    country_policy_result = Column(JSON, nullable=True)
    wallet_risk_result = Column(JSON, nullable=True)
    issuer_risk_result = Column(JSON, nullable=True)
    chain_governance_result = Column(JSON, nullable=True)
    liquidity_result = Column(JSON, nullable=True)
    ai_decision = Column(Enum(AIDecisionType), nullable=True)
    ai_reasoning = Column(Text, nullable=True)
    fhe_check_result = Column(JSON, nullable=True)
    zk_proof_reference = Column(Text, nullable=True)
    policy_version = Column(String(255), nullable=True)
    final_decision = Column(
        Enum(FinalDecision),
        nullable=False,
        default=FinalDecision.pending_review,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    payment = relationship("PaymentIntent", back_populates="compliance_decisions")
    audit_records = relationship("AuditRecord", back_populates="decision")
