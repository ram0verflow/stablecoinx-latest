import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Boolean, Integer, Numeric, Text, DateTime,
)
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_country = Column(String(100), nullable=False)
    destination_country = Column(String(100), nullable=False)
    is_allowed = Column(Boolean, default=True)
    requires_kyc = Column(Boolean, default=True)
    requires_travel_rule = Column(Boolean, default=False)
    reporting_threshold = Column(Numeric(precision=20, scale=2), default=10000)
    kyc_expiry_days = Column(Integer, default=365)
    notes = Column(Text, nullable=True)
    version_hash = Column(String(255), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
