"""
Counterparty Intelligence — deterministic risk calculation.

StableCoinX does not control third-party relays or bridges, and this
module does not claim to deanonymize a private relay or benchmark an ML
model. It combines evidence we actually have — wallet behavior signals,
route transparency classification, and KYB/KYC/attestation status — into
one explainable counterparty risk level and policy action. Every branch
below is a plain rule a compliance reviewer can read and audit; there is
no scoring model to retrain or black box to justify.

The compliance model this encodes:
    our enterprise payment -> external counterparty -> route/provenance
    evidence -> policy decision.

Missing evidence is never treated as clean. A counterparty with no wallet
history, or a route with no visible provenance, defaults toward review —
never toward "low risk just because there is no data."
"""

from __future__ import annotations

from typing import Any, Optional

TRACE_SCORE = {"full": 90, "partial": 55, "opaque": 20}
CONFIDENCE_SCORE = {"high": 90, "medium": 55, "low": 20}

INSUFFICIENT_WALLET_HISTORY_WARNING = (
    "Insufficient wallet history — requiring KYB/attestation or enhanced review."
)


def _route_transparency_score(trace_completeness: str, provenance_confidence: str) -> int:
    trace = TRACE_SCORE.get(trace_completeness, TRACE_SCORE["opaque"])
    confidence = CONFIDENCE_SCORE.get(provenance_confidence, CONFIDENCE_SCORE["low"])
    return round(trace * 0.6 + confidence * 0.4)


def _has_wallet_history(wallet_risk_result: Optional[dict]) -> bool:
    if not wallet_risk_result:
        return False
    if wallet_risk_result.get("note"):
        return False
    if wallet_risk_result.get("provider_status") == "degraded":
        return False
    return wallet_risk_result.get("risk_score") is not None


_ROUTE_TYPE_BY_TERMINAL = {
    "attributed": "public_bridge",
    "custodial_opaque": "relay",
    "infra_opaque": "chain_swap",
    "privacy_opaque": "private_relay",
    "sanctioned": "private_relay",
    "unresolved": "unknown",
}


def _provenance_decision(provenance: dict) -> dict:
    """
    Policy mapping for provenance evidence — kept separate from
    provenance_service.py (which returns evidence only, no opinion).

        SANCTIONED anywhere on path       -> blocked   (unconditional, not a risk dial)
        path_integrity == COMPROMISED     -> blocked
        PRIVACY_OPAQUE share > 0          -> enhanced_review (defensive; COMPROMISED
                                              already catches this today, kept in case
                                              a future terminal class needs it)
        path_integrity == DEGRADED        -> enhanced_review
        clean_path_attribution < 0.30     -> enhanced_review
        otherwise                         -> approved (custodial/infra opacity is not
                                              itself a risk signal)
    """
    breakdown = provenance.get("terminal_breakdown", {})
    clean_attr = provenance.get("clean_path_attribution", 0.0)
    raw_attr = provenance.get("raw_terminal_attribution", 0.0)
    integrity = provenance.get("path_integrity", "DEGRADED")
    sanctioned_exposure = breakdown.get("sanctioned", 0.0)
    privacy_exposure = breakdown.get("privacy_opaque", 0.0)
    custodial_exposure = breakdown.get("custodial_opaque", 0.0)
    infra_exposure = breakdown.get("infra_opaque", 0.0)

    if sanctioned_exposure > 0:
        level, action = "high", "blocked"
        reason = "A sanctioned address sits on the counterparty's funding path — settlement authorization blocked regardless of route or KYB status."
    elif integrity == "COMPROMISED":
        level, action = "high", "blocked"
        reason = "A privacy/darknet-labeled mechanism sits on the counterparty's funding path — settlement authorization blocked."
    elif privacy_exposure > 0:
        level, action = "medium", "enhanced_review"
        reason = "Privacy-mechanism exposure on the funding path — not treated as guilt, but routed to enhanced review."
    elif integrity == "DEGRADED":
        level, action = "medium", "enhanced_review"
        reason = (
            "Structural layering indicators (disposable-wallet lifecycle, near-total value "
            "conservation, or rapid transit) on the funding path with no hard label present. "
            "Origin not evidenced — not proof of wrongdoing — routed to enhanced review."
        )
    elif clean_attr < 0.30:
        level, action = "medium", "enhanced_review"
        reason = f"Clean-path attribution is {clean_attr:.0%}, below the 30% threshold for automatic approval."
    else:
        level, action = "low", "approved"
        if custodial_exposure > 0 or infra_exposure > 0:
            reason = (
                "Clean-path attribution is sufficient for approval. Custodial/exchange or "
                "infrastructure (solver/bridge/pool) opacity on part of the path is not a risk "
                "signal on its own; the custodial portion remains reachable via Travel Rule if needed."
            )
        else:
            reason = "Funding path traces cleanly to attributed origin (issuer mint, licensed VASP, or market maker). Payment approved."

    dominant_terminal = max(breakdown, key=breakdown.get) if breakdown else "unresolved"
    route_trace = (
        "full" if clean_attr >= 0.7
        else "partial" if (clean_attr > 0 or raw_attr >= 0.3)
        else "opaque"
    )
    route_confidence = "high" if integrity == "CLEAN" else "medium" if integrity == "DEGRADED" else "low"

    return {
        "counterparty_risk_level": level,
        "policy_action": action,
        "reason": reason,
        "route_type": _ROUTE_TYPE_BY_TERMINAL.get(dominant_terminal, "unknown"),
        "route_trace_completeness": route_trace,
        "route_provenance_confidence": route_confidence,
    }


def evaluate_counterparty(
    payment: Any,
    wallet_risk_result: Optional[dict],
    compliance_result: Optional[dict],
    provenance: Optional[dict] = None,
) -> dict:
    """
    Deterministic counterparty risk calculation combining:
      1. Wallet behavior intelligence (wallet_risk_result — Neo4j/Beeceptor backed)
      2. Route transparency (route_trace_completeness / route_provenance_confidence)
      3. KYB/KYC status (counterparty_kyb_status)
      4. Hard compliance/provider signal (sanctions_hit / internal_blacklist_hit / wallet hard flag)
      5. Enterprise policy/risk appetite (encoded as the rule ordering below)
      6. Provenance & path-integrity evidence (provenance_service.analyze_provenance()),
         when available — takes precedence over the route/KYB rules below, since it's
         a direct, richer read of the same "how transparent is this route" question.
         When provenance is unavailable (soft-failed / not yet wired for this payment),
         falls back to the route/KYB rules exactly as before.

    `payment` only needs the counterparty_*/route_* attributes present —
    any object exposing them (ORM row or seed-time stand-in) works.
    """
    wallet_risk_result = wallet_risk_result or {}
    compliance_result = compliance_result or {}
    has_provenance = bool(provenance) and provenance.get("available")

    counterparty_type = (getattr(payment, "counterparty_type", None) or "unknown").lower()
    kyb_status = (getattr(payment, "counterparty_kyb_status", None) or "missing").lower()
    attestation_id = getattr(payment, "counterparty_attestation_id", None)
    route_type = (getattr(payment, "route_type", None) or "unknown").lower()
    route_trace = (getattr(payment, "route_trace_completeness", None) or "opaque").lower()
    route_confidence = (getattr(payment, "route_provenance_confidence", None) or "low").lower()

    provenance_decision: Optional[dict] = None
    if has_provenance:
        # Provenance is a direct, richer read of route transparency — it
        # supersedes the manually-set route_* fields rather than sitting
        # alongside them.
        provenance_decision = _provenance_decision(provenance)
        route_type = provenance_decision["route_type"]
        route_trace = provenance_decision["route_trace_completeness"]
        route_confidence = provenance_decision["route_provenance_confidence"]

    sanctions_hit = bool(compliance_result.get("sanctions_hit"))
    internal_blacklist_hit = bool(compliance_result.get("internal_blacklist_hit"))
    wallet_hard_flagged = bool((wallet_risk_result.get("hard_signal") or {}).get("flagged"))
    hard_hit = sanctions_hit or internal_blacklist_hit or wallet_hard_flagged

    overall_wallet_risk = str(wallet_risk_result.get("overall_risk") or "").lower()
    has_wallet_history = _has_wallet_history(wallet_risk_result)
    raw_score = wallet_risk_result.get("risk_score")
    wallet_intelligence_score = round(float(raw_score) * 100) if has_wallet_history and raw_score is not None else None

    missing_evidence: list[str] = []
    if not has_wallet_history:
        missing_evidence.append(INSUFFICIENT_WALLET_HISTORY_WARNING)
    if kyb_status in ("missing", "pending"):
        missing_evidence.append(f"KYB/KYC status is {kyb_status} for this counterparty.")
    if kyb_status == "failed":
        missing_evidence.append("Counterparty KYB verification failed.")
    if route_trace in ("partial", "opaque"):
        missing_evidence.append(
            "Route trace is opaque — origin wallet or relay is not visible."
            if route_trace == "opaque"
            else "Route trace is partial — provenance evidence is incomplete."
        )
    if counterparty_type == "liquidity_provider" and not attestation_id and kyb_status != "verified":
        missing_evidence.append("No provider attestation on file for this liquidity provider.")
    if has_provenance:
        clean_attr = provenance.get("clean_path_attribution", 0.0)
        raw_attr = provenance.get("raw_terminal_attribution", 0.0)
        if raw_attr - clean_attr >= 0.3:
            missing_evidence.append(
                f"Raw terminal attribution ({raw_attr:.0%}) diverges sharply from clean-path "
                f"attribution ({clean_attr:.0%}) — the funding trail reaches an attributed origin, "
                "but travels through a structurally opaque path to get there."
            )
        if provenance.get("hops_to_severance") is not None:
            missing_evidence.append(f"Evidence runs out {provenance['hops_to_severance']} hop(s) back on the funding trail.")

    # --- Decision tree — hard signals take precedence, then provenance
    # (when available), then KYB, then route ---
    if hard_hit:
        level, action = "high", "blocked"
        reason = (
            "Hard sanctions/provider risk hit on the counterparty or wallet — "
            "settlement authorization blocked regardless of route or KYB status."
        )
    elif has_provenance:
        level = provenance_decision["counterparty_risk_level"]
        action = provenance_decision["policy_action"]
        reason = provenance_decision["reason"]
    elif kyb_status == "failed":
        level, action = "high", "blocked"
        reason = "Counterparty KYB verification failed — settlement authorization blocked."
    elif kyb_status in ("missing", "pending") and route_trace == "opaque":
        level, action = "high", "blocked"
        reason = (
            "Opaque route provenance plus failed/missing counterparty verification — "
            "settlement authorization blocked."
        )
    elif kyb_status == "verified" and route_trace == "full" and has_wallet_history and overall_wallet_risk == "low":
        level, action = "low", "approved"
        reason = "Verified counterparty, complete route evidence, low wallet-risk signals. Payment approved."
    elif route_type in ("private_relay", "relay") or route_trace in ("partial", "opaque"):
        level, action = "medium", "enhanced_review"
        reason = (
            "Operationally valid route, but incomplete source provenance through a private relay. "
            "Not treated as criminal; routed to enhanced review."
        )
    elif not has_wallet_history:
        if kyb_status == "verified" and attestation_id:
            level = "low" if route_trace == "full" else "medium"
            action = "approved" if route_trace == "full" else "enhanced_review"
            reason = (
                "No prior wallet history, but verified KYB and provider attestation substitute for it "
                "when policy allows; route transparency sets the final level."
            )
        else:
            level, action = "medium", "enhanced_review"
            reason = "Missing wallet history is not the same as low risk — routed to enhanced review absent strong verification."
    elif kyb_status == "verified":
        level, action = "medium", "enhanced_review"
        reason = (
            "Counterparty verification can substitute for weak wallet history only when policy allows it; "
            "wallet behavior or route signal still warrants review."
        )
    else:
        level, action = "medium", "enhanced_review"
        reason = "Insufficient combined evidence for automatic approval — routed to enhanced review."

    evidence_summary = (
        f"Counterparty type: {counterparty_type.replace('_', ' ')} | "
        f"KYB/KYC: {kyb_status} | "
        f"Route: {route_type.replace('_', ' ')} ({route_trace} trace, {route_confidence} confidence) | "
        f"Wallet behavior: {overall_wallet_risk or 'unknown'}"
    )
    if has_provenance:
        evidence_summary += (
            f" | Provenance: {provenance.get('clean_path_attribution', 0):.0%} clean-path attribution, "
            f"{provenance.get('path_integrity')} integrity"
        )

    return {
        "counterparty_risk_level": level,
        "policy_action": action,
        "reason": reason,
        "evidence_summary": evidence_summary,
        "missing_evidence_warnings": missing_evidence,
        "provenance": provenance if has_provenance else None,
        "route_type": route_type,
        "route_trace_completeness": route_trace,
        "route_provenance_confidence": route_confidence,
        "route_transparency_score": _route_transparency_score(route_trace, route_confidence),
        "wallet_behavior_signal": overall_wallet_risk or "unknown",
        "wallet_intelligence_score": wallet_intelligence_score,
        "has_wallet_history": has_wallet_history,
        "hard_hit": hard_hit,
    }
