import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID

from app.db.database import Base


class TreasuryDepartmentBudget(Base):
    __tablename__ = "treasury_department_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purpose_key = Column(String(64), unique=True, nullable=False, index=True)
    budget_limit = Column(Float, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class ApprovedVendor(Base):
    __tablename__ = "approved_vendors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vendor_name = Column(String(255), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
