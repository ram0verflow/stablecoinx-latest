"""Treasury policy rows — department budgets and vendor allowlists from DB."""  # FIXED: M5
import uuid  # FIXED: M5
from datetime import datetime, timezone  # FIXED: M5

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, JSON  # FIXED: M5
from sqlalchemy.dialects.postgresql import UUID  # FIXED: M5

from app.db.database import Base  # FIXED: M5


class TreasuryPolicy(Base):  # FIXED: M5
    __tablename__ = "treasury_policies"  # FIXED: M5

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)  # FIXED: M5
    department = Column(String(255), nullable=False, index=True)  # FIXED: M5
    budget_limit = Column(Numeric(precision=24, scale=6), nullable=False)  # FIXED: M5
    currency = Column(String(16), nullable=False, default="USD")  # FIXED: M5
    vendor_allowlist = Column(JSON, nullable=True)  # FIXED: M5
    is_active = Column(Boolean, nullable=False, default=True)  # FIXED: M5
    created_at = Column(  # FIXED: M5
        DateTime(timezone=True),  # FIXED: M5
        default=lambda: datetime.now(timezone.utc),  # FIXED: M5
        nullable=False,  # FIXED: M5
    )  # FIXED: M5
