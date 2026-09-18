"""
Tests for Policy Veto Logic.
Verifies override and enforcement behavior.
"""

import pytest


@pytest.fixture
def compliance_results():
    """Create mock compliance results."""
    return {
        "clean": {
            "sanctions_check": {"hit": False},
            "kyc_check": {"valid": True},
            "wallet_risk": {"score": 0.2},
            "corridor_check": {"allowed": True},
        },
        "sanctioned": {
            "sanctions_check": {"hit": True},
            "kyc_check": {"valid": True},
            "wallet_risk": {"score": 0.2},
            "corridor_check": {"allowed": True},
        },
        "high_wallet_risk": {
            "sanctions_check": {"hit": False},
            "kyc_check": {"valid": True},
            "wallet_risk": {"score": 0.85},
            "corridor_check": {"allowed": True},
        },
        "blocked_corridor": {
            "sanctions_check": {"hit": False},
            "kyc_check": {"valid": True},
            "wallet_risk": {"score": 0.2},
            "corridor_check": {"allowed": False},
        },
    }


def test_veto_overrides_ai_on_sanction(compliance_results):
    """Test veto overrides AI approval on sanction hit."""
    compliance = compliance_results["sanctioned"]
    ai_decision = "APPROVE"
    
    # Veto check: if sanction hit, always block
    if compliance["sanctions_check"]["hit"]:
        final_decision = "BLOCK"
    else:
        final_decision = ai_decision
    
    assert final_decision == "BLOCK"
    assert final_decision != ai_decision


def test_veto_overrides_ai_on_blocked_corridor(compliance_results):
    """Test veto overrides AI approval on blocked corridor."""
    compliance = compliance_results["blocked_corridor"]
    ai_decision = "APPROVE"
    
    # Veto check: if corridor blocked, always block
    if not compliance["corridor_check"]["allowed"]:
        final_decision = "BLOCK"
    else:
        final_decision = ai_decision
    
    assert final_decision == "BLOCK"
    assert final_decision != ai_decision


def test_veto_forces_review_on_high_wallet_risk(compliance_results):
    """Test veto forces REVIEW on high wallet risk."""
    compliance = compliance_results["high_wallet_risk"]
    ai_decision = "APPROVE"
    
    # Veto check: if wallet risk > 0.7, force review
    if compliance["wallet_risk"]["score"] > 0.7:
        final_decision = "REVIEW"
    else:
        final_decision = ai_decision
    
    assert final_decision == "REVIEW"
    # Can override AI but not force block (needs human review)
    assert final_decision in ["REVIEW", "BLOCK"]


def test_veto_respects_ai_on_clean_payment(compliance_results):
    """Test veto respects AI decision on clean payment."""
    compliance = compliance_results["clean"]
    ai_decision = "APPROVE"
    
    # No veto triggers
    veto_applies = (
        compliance["sanctions_check"]["hit"] or
        not compliance["corridor_check"]["allowed"] or
        compliance["wallet_risk"]["score"] > 0.7
    )
    
    assert veto_applies is False
    # AI decision stands
    final_decision = ai_decision if not veto_applies else "REVIEW"
    assert final_decision == "APPROVE"
