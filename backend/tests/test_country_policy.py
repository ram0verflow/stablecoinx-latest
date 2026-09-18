from uuid import uuid4

from app.models.policy_rules import PolicyRule
from app.services.governance.country_policy_service import (
    check_corridor,
    check_payroll_constraints,
    get_current_policy_version,
)


def _seed_rules(db_session):
    db_session.add_all(
        [
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
    )
    db_session.commit()


def test_sg_uae_corridor_allowed(db_session):
    _seed_rules(db_session)
    result = check_corridor(db_session, "SG", "UAE", 5000)
    assert result["is_allowed"] is True


def test_sg_russia_corridor_blocked(db_session):
    _seed_rules(db_session)
    result = check_corridor(db_session, "SG", "Russia", 5000)
    assert result["is_allowed"] is False


def test_usa_iran_corridor_blocked(db_session):
    _seed_rules(db_session)
    result = check_corridor(db_session, "USA", "Iran", 5000)
    assert result["is_allowed"] is False


def test_reporting_threshold_exceeded(db_session):
    _seed_rules(db_session)
    result = check_corridor(db_session, "SG", "UAE", 15000)
    assert result["exceeds_reporting_threshold"] is True


def test_payroll_cap_exceeded(db_session):
    out = check_payroll_constraints(30000, "UAE")
    assert out["is_within_limit"] is False


def test_policy_version_changes(db_session):
    v1 = get_current_policy_version(db_session)
    db_session.add(
        PolicyRule(
            id=uuid4(),
            source_country="UK",
            destination_country="UAE",
            is_allowed=True,
            requires_kyc=True,
            requires_travel_rule=True,
            reporting_threshold=10000,
            kyc_expiry_days=365,
        )
    )
    db_session.commit()
    v2 = get_current_policy_version(db_session)
    assert v1 != v2
