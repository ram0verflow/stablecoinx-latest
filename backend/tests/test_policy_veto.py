from app.models.compliance_decisions import FinalDecision
from app.services.governance.policy_veto_service import apply_veto


def test_veto_overrides_ai_on_sanction():
    out = apply_veto(
        {
            "country_policy": {"is_allowed": True},
            "compliance": {"sanctions_hit": True},
            "wallet_graph": {"risk_score": 0.1},
        },
        "direct_transfer",
    )
    assert out == FinalDecision.blocked


def test_veto_overrides_ai_on_blocked_corridor():
    out = apply_veto(
        {"country_policy": {"is_allowed": False}, "compliance": {}, "wallet_graph": {}},
        "direct_transfer",
    )
    assert out == FinalDecision.blocked


def test_veto_forces_review_on_high_wallet_risk():
    out = apply_veto(
        {"country_policy": {"is_allowed": True}, "compliance": {}, "wallet_graph": {"risk_score": 0.9}},
        "direct_transfer",
    )
    assert out == FinalDecision.pending_review


def test_veto_respects_ai_on_clean_payment():
    out = apply_veto(
        {"country_policy": {"is_allowed": True}, "compliance": {"sanctions_hit": False}, "wallet_graph": {"risk_score": 0.1}},
        "direct_transfer",
    )
    assert out == FinalDecision.approved


def test_veto_forces_review_on_degraded_compliance_provider():
    """A compliance provider outage must never look like a clean pass —
    even when the AI advisory and every other signal is clean."""
    out = apply_veto(
        {
            "country_policy": {"is_allowed": True},
            "compliance": {"sanctions_hit": False, "provider_status": "degraded"},
            "wallet_graph": {"risk_score": 0.1},
        },
        "direct_transfer",
    )
    assert out == FinalDecision.pending_review
