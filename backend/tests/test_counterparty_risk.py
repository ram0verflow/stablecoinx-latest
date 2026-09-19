from types import SimpleNamespace

from app.services.compliance.counterparty_risk_service import evaluate_counterparty


def _payment(**kwargs):
    defaults = dict(
        counterparty_type=None,
        counterparty_kyb_status=None,
        counterparty_attestation_id=None,
        route_type=None,
        route_trace_completeness=None,
        route_provenance_confidence=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_verified_full_route_low_wallet_is_approved():
    payment = _payment(
        counterparty_type="vendor",
        counterparty_kyb_status="verified",
        route_type="public_bridge",
        route_trace_completeness="full",
        route_provenance_confidence="high",
    )
    wallet_risk = {"risk_score": 0.1, "overall_risk": "low"}
    result = evaluate_counterparty(payment, wallet_risk, {"sanctions_hit": False})

    assert result["counterparty_risk_level"] == "low"
    assert result["policy_action"] == "approved"
    assert result["missing_evidence_warnings"] == []


def test_private_relay_partial_route_no_hard_hit_is_enhanced_review():
    payment = _payment(
        counterparty_type="liquidity_provider",
        counterparty_kyb_status="pending",
        route_type="private_relay",
        route_trace_completeness="partial",
        route_provenance_confidence="medium",
    )
    wallet_risk = {"risk_score": 0.4, "overall_risk": "medium"}
    result = evaluate_counterparty(payment, wallet_risk, {"sanctions_hit": False})

    assert result["counterparty_risk_level"] == "medium"
    assert result["policy_action"] == "enhanced_review"


def test_failed_kyb_opaque_route_is_blocked():
    payment = _payment(
        counterparty_type="unknown",
        counterparty_kyb_status="failed",
        route_type="private_relay",
        route_trace_completeness="opaque",
        route_provenance_confidence="low",
    )
    wallet_risk = {"risk_score": 0.92, "overall_risk": "critical"}
    result = evaluate_counterparty(payment, wallet_risk, {"sanctions_hit": False})

    assert result["counterparty_risk_level"] == "high"
    assert result["policy_action"] == "blocked"


def test_missing_kyb_and_opaque_route_is_blocked_even_without_hard_hit():
    payment = _payment(
        counterparty_type="unknown",
        counterparty_kyb_status="missing",
        route_type="private_relay",
        route_trace_completeness="opaque",
        route_provenance_confidence="low",
    )
    result = evaluate_counterparty(payment, None, None)

    assert result["policy_action"] == "blocked"
    assert any("history" in w.lower() for w in result["missing_evidence_warnings"])


def test_hard_sanctions_hit_blocks_regardless_of_route():
    payment = _payment(
        counterparty_type="vendor",
        counterparty_kyb_status="verified",
        route_type="direct",
        route_trace_completeness="full",
        route_provenance_confidence="high",
    )
    result = evaluate_counterparty(payment, {"risk_score": 0.1, "overall_risk": "low"}, {"sanctions_hit": True})

    assert result["policy_action"] == "blocked"
    assert result["hard_hit"] is True


def test_no_wallet_history_is_never_treated_as_low_risk():
    """A counterparty with no wallet history must not read as low risk just
    because there is no data — even with a decent route, absent verification
    it must land in enhanced review, never a clean pass."""
    payment = _payment(
        counterparty_type="liquidity_provider",
        counterparty_kyb_status="missing",
        route_type="public_bridge",
        route_trace_completeness="partial",
        route_provenance_confidence="medium",
    )
    result = evaluate_counterparty(payment, None, {"sanctions_hit": False})

    assert result["counterparty_risk_level"] != "low"
    assert result["policy_action"] != "approved"
    assert any("history" in w.lower() for w in result["missing_evidence_warnings"])


def test_no_history_but_verified_kyb_and_attestation_can_be_approved():
    payment = _payment(
        counterparty_type="liquidity_provider",
        counterparty_kyb_status="verified",
        counterparty_attestation_id="ATT-123",
        route_type="chain_swap",
        route_trace_completeness="full",
        route_provenance_confidence="high",
    )
    result = evaluate_counterparty(payment, None, {"sanctions_hit": False})

    assert result["policy_action"] == "approved"
    assert result["counterparty_risk_level"] == "low"
