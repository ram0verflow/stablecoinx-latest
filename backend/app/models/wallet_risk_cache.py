from sqlalchemy import Column, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
import uuid

from app.db.database import Base

class WalletRiskCache(Base):
    __tablename__ = "wallet_risk_cache"

    wallet_address = Column(String, primary_key=True, index=True)
    risk_score = Column(Float, nullable=False)
    overall_risk = Column(String, nullable=False)
    mixer_adjacent = Column(Boolean, default=False)
    sanctions_hit = Column(Boolean, default=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
