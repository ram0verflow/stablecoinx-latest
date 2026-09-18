import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class IssuerProfile(Base):
    __tablename__ = "issuer_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    issuer_id = Column(String(64), unique=True, nullable=True, index=True)  # FIXED: M5
    token = Column(String(16), unique=True, nullable=False, index=True)
    issuer = Column(String(255), nullable=False)
    issuer_freeze_risk = Column(String(32), nullable=False, default="medium")
    depeg_risk_score = Column(Float, nullable=False, default=0.0)
    redemption_trust = Column(String(32), nullable=False, default="medium")
    liquidity_depth = Column(String(32), nullable=False, default="medium")
    regulatory_comfort = Column(String(32), nullable=False, default="medium")
    recommendation = Column(String(32), nullable=False, default="acceptable")
    score = Column(Float, nullable=False, default=0.5)
    risk_level = Column(String(32), nullable=False, default="medium")
    jurisdiction = Column(String(128), nullable=False, default="")  # FIXED: M5
    is_sanctioned = Column(Boolean, nullable=False, default=False)  # FIXED: M5
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
