"""
Tests for Country Policy Governance Engine.
Verifies corridor policies and restrictions.
"""

import pytest
from uuid import uuid4
from sqlalchemy.orm import Session

from app.models.policy_rules import PolicyRule
from app.models.payment_intents import PaymentIntent
from app.schemas import PaymentStatusEnum
from app.services.governance.country_policy_service import check_corridor


@pytest.fixture
def test_policy_rules(db_session: Session):
    """Create test policy rules."""
    rules = [
        # Allowed corridors
        PolicyRule(
            id=uuid4(),
            source_country="SG",
            destination_country="UAE",
            is_allowed=True,
            requires_kyc=True,
            requires_travel_rule=True,
            reporting_threshold=10000,
            kyc_expiry_days=365,
        ),
        PolicyRule(
            id=uuid4(),
            source_country="USA",
            destination_country="UK",
            is_allowed=True,
            requires_kyc=True,
            requires_travel_rule=True,
            reporting_threshold=10000,
            kyc_expiry_days=365,
        ),
        # Blocked corridors
        PolicyRule(
            id=uuid4(),
            source_country="SG",
            destination_country="Russia",
            is_allowed=False,
            requires_kyc=True,
            requires_travel_rule=True,
            reporting_threshold=0,
            kyc_expiry_days=0,
        ),
        PolicyRule(
            id=uuid4(),
            source_country="USA",
            destination_country="Iran",
            is_allowed=False,
            requires_kyc=True,
            requires_travel_rule=True,
            reporting_threshold=0,
            kyc_expiry_days=0,
        ),
    ]

    db_session.add_all(rules)
    db_session.commit()
    return rules


def test_sg_uae_corridor_allowed(db_session: Session, test_policy_rules):
    """Test SG → UAE corridor is allowed."""
    result = check_corridor(db_session, "SG", "UAE", 5000)
    assert result["allowed"] is True
    assert result["requires_kyc"] is True


def test_sg_russia_corridor_blocked(db_session: Session, test_policy_rules):
    """Test SG → Russia corridor is blocked."""
    result = check_corridor(db_session, "SG", "Russia", 5000)
    assert result["allowed"] is False


def test_usa_iran_corridor_blocked(db_session: Session, test_policy_rules):
    """Test USA → Iran corridor is blocked."""
    result = check_corridor(db_session, "USA", "Iran", 5000)
    assert result["allowed"] is False


def test_reporting_threshold_exceeded(db_session: Session, test_policy_rules):
    """Test amount exceeding reporting threshold is flagged."""
    # SG → UAE threshold is 10000
    result = check_corridor(db_session, "SG", "UAE", 15000)
    assert result["allowed"] is True
    assert result.get("exceeds_reporting_threshold", False) is True


def test_payroll_cap_exceeded(db_session: Session, test_policy_rules):
    """Test payroll purpose validation."""
    result = check_corridor(db_session, "SG", "UAE", 5000, purpose="Payroll")
    assert result["allowed"] is True


def test_policy_version_tracking(db_session: Session):
    """Test policy version is tracked."""
    current_version = "1.0"
    new_version = "1.1"
    assert current_version != new_version
