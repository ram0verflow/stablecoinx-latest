from types import SimpleNamespace

from app.services.compliance.counterparty_risk_service import evaluate_counterparty
from app.services.compliance.provenance_service import analyze_provenance


def _payment(**kwargs):
    defaults = dict(
        counterparty_type="liquidity_provider",
        counterparty_kyb_status=None,
        counterparty_attestation_id=None,
        route_type=None,
        route_trace_completeness=None,
        route_provenance_confidence=None,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _evaluate(fixture_name):
    provenance = analyze_provenance(payment=None, wallet_graph_result=None, compliance_result=None, fixture_name=fixture_name)
    return evaluate_counterparty(_payment(), wallet_risk_result=None, compliance_result={"sanctions_hit": False}, provenance=provenance)


def test_good_fixture_is_approved():
    result = _evaluate("good")
    assert result["policy_action"] == "approved"
    assert result["counterparty_risk_level"] == "low"


def test_medium_fixture_is_approved_despite_opacity():
    """Custodial/infra opacity dominates this fixture but must not itself
    read as risky — proves opacity != wrongdoing end to end."""
    result = _evaluate("medium")
    assert result["policy_action"] == "approved"


def test_bad_fixture_is_blocked():
    result = _evaluate("bad")
    assert result["policy_action"] == "blocked"
    assert result["counterparty_risk_level"] == "high"


def test_deceptive_fixture_is_enhanced_review_not_approved():
    """The acceptance test: a clean-looking depth-8 mint terminal must not
    be approved when the path itself is a disposable-wallet layering chain."""
    result = _evaluate("deceptive")
    assert result["policy_action"] == "enhanced_review"
    assert result["policy_action"] != "approved"


def test_hard_hit_still_overrides_provenance():
    """An existing sanctions/blacklist hit from the compliance engine must
    still block, even if provenance evidence alone would have approved."""
    provenance = analyze_provenance(payment=None, wallet_graph_result=None, compliance_result=None, fixture_name="good")
    result = evaluate_counterparty(_payment(), wallet_risk_result=None, compliance_result={"sanctions_hit": True}, provenance=provenance)
    assert result["policy_action"] == "blocked"


def test_no_provenance_falls_back_to_existing_route_kyb_logic():
    """Payments without provenance wired (fixture_name=None) must behave
    exactly as before this feature existed."""
    payment = _payment(
        counterparty_kyb_status="verified",
        route_type="direct",
        route_trace_completeness="full",
        route_provenance_confidence="high",
    )
    result = evaluate_counterparty(payment, wallet_risk_result={"risk_score": 0.1, "overall_risk": "low"}, compliance_result={"sanctions_hit": False}, provenance=None)
    assert result["policy_action"] == "approved"
    assert result["provenance"] is None
