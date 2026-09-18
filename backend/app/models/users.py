import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, validates

from app.db.database import Base


class UserRole(str, PyEnum):
    admin = "admin"
    treasury_officer = "treasury_officer"
    compliance_officer = "compliance_officer"
    auditor = "auditor"
    reviewer = "reviewer"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.viewer)  # FIXED: C2
    is_active = Column(Boolean, default=True)
    wallet_address = Column(String(42), nullable=True)
    ai_preference = Column(String(50), default="ollama")
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

    @validates("role")
    def validate_role(self, key: str, value):
        allowed = {e.value for e in UserRole}
        raw = value.value if isinstance(value, UserRole) else str(value)
        if raw not in allowed:
            raise ValueError(f"Invalid role: {raw}. Must be one of {allowed}")
        return value

    # Relationships
    payment_intents = relationship("PaymentIntent", back_populates="creator")
    approvals = relationship("Approval", back_populates="reviewer")
