import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class AuditRecord(Base):
    __tablename__ = "audit_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_intents.id"),
        nullable=False,
    )
    decision_id = Column(
        UUID(as_uuid=True),
        ForeignKey("compliance_decisions.id"),
        nullable=True,
    )
    tx_hash = Column(String(66), nullable=True)
    on_chain_proof_hash = Column(String(66), nullable=True)
    report_path = Column(Text, nullable=True)
    zk_proof_reference = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    payment = relationship("PaymentIntent", back_populates="audit_records")
    decision = relationship("ComplianceDecision", back_populates="audit_records")
