"""
Deterministic, evidence-scored rule for legacy Whirlpool-style CoinJoin
detection, plus simple structural fallback hints for the negative case.

Everything here is explicit if/else scoring — no hidden weighting, no ML.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from schemas import ClassificationSignal

# TODO: these denominations are the well-known legacy Whirlpool pool sizes
# (0.001 / 0.01 / 0.05 / 0.5 BTC) as commonly documented, but have NOT been
# re-verified against Samourai/Whirlpool's own final documentation or a set
# of confirmed real Whirlpool txids for this project. Verify before making
# any public/marketing claim that relies on this list being exact or complete.
WHIRLPOOL_POOL_DENOMS_SATS: List[int] = [
    100_000,      # 0.001 BTC
    1_000_000,    # 0.01 BTC
    5_000_000,    # 0.05 BTC
    50_000_000,   # 0.5 BTC
]

PROTOCOL_WHIRLPOOL_LEGACY = "WHIRLPOOL_LEGACY"
PROTOCOL_UNKNOWN = "UNKNOWN"

CLASS_CONFIRMED = "CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN"
CLASS_LIKELY = "LIKELY_WHIRLPOOL_LEGACY_COINJOIN"
CLASS_COINJOIN_LIKE = "COINJOIN_LIKE"
CLASS_NOT_WHIRLPOOL = "NOT_WHIRLPOOL"

# Score buckets shared by both the classification label and the
# obfuscation_confidence label — one deterministic score, two readable views.
_SCORE_THRESHOLDS: List[Tuple[int, str, str]] = [
    # (min_score, classification, obfuscation_confidence)
    (90, CLASS_CONFIRMED, "HIGH"),
    (70, CLASS_LIKELY, "MEDIUM"),
    (40, CLASS_COINJOIN_LIKE, "LOW"),
    (0, CLASS_NOT_WHIRLPOOL, "NONE"),
]


def _score_to_labels(score: int) -> Tuple[str, str]:
    for min_score, classification, obf_confidence in _SCORE_THRESHOLDS:
        if score >= min_score:
            return classification, obf_confidence
    return CLASS_NOT_WHIRLPOOL, "NONE"  # unreachable given the 0-floor bucket, kept as a safe default


def classify_whirlpool_legacy(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Score a transaction's features against the legacy Whirlpool structural
    signature. Returns a dict with classification, protocol, confidence,
    obfuscation_confidence, evidence (list[ClassificationSignal]) and
    evidence_against (list[str]) — never raises.
    """
    evidence: List[ClassificationSignal] = []
    evidence_against: List[str] = []
    score = 0

    exactly_5_inputs = features["input_count"] == 5
    if exactly_5_inputs:
        score += 25
        evidence.append(ClassificationSignal(
            name="exactly_5_inputs", passed=True, weight=25,
            detail="Transaction has exactly 5 inputs",
        ))
    else:
        evidence_against.append("Transaction does not have exactly 5 inputs")

    exactly_5_outputs = features["output_count"] == 5
    if exactly_5_outputs:
        score += 25
        evidence.append(ClassificationSignal(
            name="exactly_5_outputs", passed=True, weight=25,
            detail="Transaction has exactly 5 outputs",
        ))
    else:
        evidence_against.append("Transaction does not have exactly 5 outputs")

    all_outputs_equal = bool(features.get("all_outputs_equal"))
    if all_outputs_equal:
        score += 30
        equal_value = features.get("equal_output_value_sats")
        evidence.append(ClassificationSignal(
            name="all_outputs_equal", passed=True, weight=30,
            detail=f"All outputs have value {equal_value} sats",
        ))
    else:
        evidence_against.append("Outputs are not all equal")

    denom_match = all_outputs_equal and features.get("equal_output_value_sats") in WHIRLPOOL_POOL_DENOMS_SATS
    if denom_match:
        score += 20
        evidence.append(ClassificationSignal(
            name="known_whirlpool_pool_denomination", passed=True, weight=20,
            detail="Equal output value matches configured Whirlpool pool denomination",
        ))
    else:
        evidence_against.append("No configured Whirlpool denomination matched")

    classification, obfuscation_confidence = _score_to_labels(score)
    confidence = round(score / 100, 4)
    protocol = (
        PROTOCOL_WHIRLPOOL_LEGACY
        if classification in (CLASS_CONFIRMED, CLASS_LIKELY)
        else PROTOCOL_UNKNOWN
    )

    result: Dict[str, Any] = {
        "score": score,
        "classification": classification,
        "protocol": protocol,
        "confidence": confidence,
        "obfuscation_confidence": obfuscation_confidence,
        "evidence": evidence,
        "evidence_against": evidence_against,
    }

    if classification in (CLASS_COINJOIN_LIKE, CLASS_NOT_WHIRLPOOL):
        hint = compute_negative_hint(features)
        if hint is not None:
            result["classification_hint"] = hint

    return result


def compute_negative_hint(features: Dict[str, Any]) -> Any:
    """
    Cheap structural hints for transactions that aren't a Whirlpool match.
    These are descriptive shape labels only — never an illicit/mixer claim.
    """
    input_count = features["input_count"]
    output_count = features["output_count"]
    all_outputs_equal = bool(features.get("all_outputs_equal"))

    if input_count == 1 and output_count <= 2:
        return "ORDINARY_PAYMENT_LIKE"

    if output_count >= 20 and not all_outputs_equal:
        return "BATCHING_LIKE"

    if input_count >= 10 and output_count <= 3:
        return "CONSOLIDATION_LIKE"

    if input_count > 1 and output_count > 1:
        return "GENERIC_MULTI_PARTY_OR_BATCH_TRANSACTION"

    return None
