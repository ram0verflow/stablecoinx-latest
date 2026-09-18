"""
Deterministic policy mapping from classifier output (+ optional external
provider attribution) to a policy_recommendation.

No ML, no hidden weighting — same philosophy as the classifier itself. This
module is the ONLY place that decides what StableCoinX *recommends doing*
about an obfuscation classification; the classifier itself never recommends
an action, only reports evidence (see tools/obfuscation_classifier/README.md
signal #5 — "final policy recommendation" is deliberately kept separate from
signals #1/#2 computed by the classifier).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

ENHANCED_REVIEW = "ENHANCED_REVIEW"
NO_OBFUSCATION_ACTION = "NO_OBFUSCATION_ACTION"
INFORMATIONAL_ONLY = "INFORMATIONAL_ONLY"
BLOCKED_BY_EXTERNAL_ATTRIBUTION = "BLOCKED_BY_EXTERNAL_ATTRIBUTION"
MANUAL_REVIEW_PROVIDER_UNAVAILABLE = "MANUAL_REVIEW_PROVIDER_UNAVAILABLE"

POLICY_MESSAGE = (
    "High obfuscation confidence triggers enhanced review, not automatic "
    "blocking. Privacy structure alone is not illicit attribution."
)

# Required literal sentence, always included verbatim — but a recommendation
# driven by the external provider (not by obfuscation confidence at all)
# reads as self-contradictory without a clarifying lead-in, so one is
# prepended for those two cases specifically. The required sentence itself
# is never altered or removed.
_OVERRIDE_PREFIX = {
    BLOCKED_BY_EXTERNAL_ATTRIBUTION: (
        "This block came from external attribution (a separate provider "
        "signal), not from obfuscation confidence. "
    ),
    MANUAL_REVIEW_PROVIDER_UNAVAILABLE: (
        "This review was triggered by the external attribution provider "
        "being unavailable, not by obfuscation confidence. "
    ),
}


def policy_message_for(recommendation: str) -> str:
    return _OVERRIDE_PREFIX.get(recommendation, "") + POLICY_MESSAGE


def classifier_based_recommendation(protocol: str, obfuscation_confidence: str, classification: str) -> str:
    """
    Phase C's own two explicit rules, plus one deterministic middle bucket
    for the gap between them (COINJOIN_LIKE / LOW confidence structural
    matches that are neither a confirmed protocol hit nor a clean pass —
    "uncertainty is not clearance", so this must not silently become
    NO_OBFUSCATION_ACTION).
    """
    if protocol == "WHIRLPOOL_LEGACY" and obfuscation_confidence in ("HIGH", "MEDIUM"):
        return ENHANCED_REVIEW
    if classification == "NOT_WHIRLPOOL":
        return NO_OBFUSCATION_ACTION
    return INFORMATIONAL_ONLY


def apply_provider_override(base_recommendation: str, provider_attribution: Optional[Dict[str, Any]]) -> str:
    """
    Beeceptor's provider_attribution is an external mock — not the
    classifier, not ground truth (see PHASE D in the task spec). Its
    findings can override the classifier-based recommendation in one
    direction (toward more caution), never silently soften it.
    """
    if not provider_attribution:
        return base_recommendation

    status = provider_attribution.get("status")
    if status == "degraded":
        return MANUAL_REVIEW_PROVIDER_UNAVAILABLE

    if status == "live_mock":
        if provider_attribution.get("known_scam_exposure") or provider_attribution.get("known_sanctions_exposure"):
            return BLOCKED_BY_EXTERNAL_ATTRIBUTION

    return base_recommendation


def compute_policy_recommendation(
    protocol: str,
    obfuscation_confidence: str,
    classification: str,
    provider_attribution: Optional[Dict[str, Any]] = None,
) -> str:
    base = classifier_based_recommendation(protocol, obfuscation_confidence, classification)
    return apply_provider_override(base, provider_attribution)
