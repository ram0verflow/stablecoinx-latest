import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base


class TeamPolicy(Base):
    """The current YAML policy ruleset for one team. One row per team —
    saving a new version overwrites this row and increments `version`
    rather than keeping full history, which is enough for a demo-scale
    policy engine without a separate history table."""

    __tablename__ = "team_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False, unique=True)
    yaml_text = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_deployed = Column(Boolean, nullable=False, default=False)
    deployed_at = Column(DateTime(timezone=True), nullable=True)
    n8n_deploy_status = Column(String(50), nullable=True)  # sent | not_configured | failed
    n8n_deploy_detail = Column(Text, nullable=True)
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

    team = relationship("Team", back_populates="policy")
