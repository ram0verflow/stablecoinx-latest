import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Text, Numeric, DateTime, Enum, ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class RevalidationStatus(str, PyEnum):
    pending = "pending"
    completed = "completed"


class RevalidationRecord(Base):
    __tablename__ = "revalidation_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("payment_intents.id"),
        nullable=False,
    )
    trigger_reason = Column(Text, nullable=False)
    original_decision = Column(String(50), nullable=False)
    new_risk_score = Column(Numeric(precision=10, scale=2), nullable=True)
    new_decision = Column(String(50), nullable=True)
    status = Column(
        Enum(RevalidationStatus),
        nullable=False,
        default=RevalidationStatus.pending,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    payment = relationship("PaymentIntent", back_populates="revalidation_records")
