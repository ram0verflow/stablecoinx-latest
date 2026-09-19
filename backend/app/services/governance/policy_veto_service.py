from app.models.compliance_decisions import FinalDecision

def apply_veto(pipeline_results: dict, ai_decision: str) -> FinalDecision:
    # Extract results
    country_policy = pipeline_results.get("country_policy", {})
    treasury_controls = pipeline_results.get("treasury_controls", {})
    compliance = pipeline_results.get("compliance", {})
    wallet_graph = pipeline_results.get("wallet_graph", {})
    counterparty_risk = pipeline_results.get("counterparty_risk", {})
    issuer_risk = pipeline_results.get("issuer_risk", {})

    # Rules:
    # If country_policy is_allowed=False → BLOCK regardless of AI
    if not country_policy.get("is_allowed", False):
        return FinalDecision.blocked
        
    # If sanctions_hit=True → BLOCK regardless of AI
    if compliance.get("sanctions_hit", False):
        return FinalDecision.blocked

    # If internal_blacklist_hit=True → BLOCK regardless of AI
    if compliance.get("internal_blacklist_hit", False):
        return FinalDecision.blocked

    # Compliance provider unreachable/degraded → force REVIEW. Missing
    # sanctions/KYC evidence must never be treated as a clean pass.
    if compliance.get("provider_status") == "degraded":
        return FinalDecision.pending_review

    # Counterparty Intelligence: failed/missing KYB combined with an opaque
    # route, or a hard hit surfaced there, blocks settlement authorization
    # regardless of AI advisory. This does not claim to deanonymize a
    # private relay — it gates on the evidence we actually have.
    if counterparty_risk.get("policy_action") == "blocked":
        return FinalDecision.blocked

    # Explicit fail/bypass from treasury controls
    if treasury_controls.get("daily_limit_ok") is False:
        return FinalDecision.blocked
    if treasury_controls.get("department_budget_ok") is False:
        return FinalDecision.blocked

    # High/critical issuer risk can block
    issuer_level = str(issuer_risk.get("risk_level", "")).lower()
    issuer_reco = str(issuer_risk.get("recommendation", "")).lower()
    if issuer_level in ("high", "critical") or issuer_reco in ("avoid", "blocked"):
        return FinalDecision.blocked
        
    # If wallet risk_score > 0.8 → force REVIEW regardless of AI
    if wallet_graph.get("risk_score", 0.0) > 0.8:
        return FinalDecision.pending_review

    # Counterparty Intelligence: opaque/private-relay route or unresolved
    # KYB routes to enhanced review. Privacy-like route behavior is not
    # treated as guilt — it lowers confidence, it does not prove illicit
    # activity, so this is a review gate, not a block.
    if counterparty_risk.get("policy_action") == "enhanced_review":
        return FinalDecision.pending_review
        
    # If dual_approval_required=True → force REVIEW
    if treasury_controls.get("dual_approval_required", False):
        return FinalDecision.pending_review
        
    # Otherwise → use AI decision (map it to FinalDecision)
    ai_decision = str(ai_decision or "").lower()
    if ai_decision == "block":
        return FinalDecision.blocked
    elif ai_decision == "review":
        return FinalDecision.pending_review
    elif ai_decision in ["direct_transfer", "alternate_chain", "alternate_token", "approved", "pass", "approve"]:
        return FinalDecision.approved
    
    # Default fallback
    return FinalDecision.pending_review
