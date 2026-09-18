"""
Deterministic, evidence-scored rules for multiple Bitcoin CoinJoin-style
privacy-protocol structures, plus simple structural fallback hints for the
non-matching case.

Everything here is explicit if/else scoring — no hidden weighting, no ML.
Three rules are evaluated independently, most-specific first; the caller
(classify_transaction) picks the strongest match and reports the others too,
so nothing is hidden even when a lower-priority rule also fired.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from schemas import ClassificationSignal

# ──────────────────────────────────────────────────────────────────────
# Protocol 1: legacy Samourai Whirlpool
#
# TODO: these denominations are the well-known legacy Whirlpool pool sizes
# (0.001 / 0.01 / 0.05 / 0.5 BTC) as commonly documented, but have NOT been
# re-verified against Samourai/Whirlpool's own final documentation. Verify
# before making any public/marketing claim that relies on this list being
# exact or complete.
#
# Round-size range widened from Phase 1/2's "exactly 5" to 5-8 after real
# curated-dataset validation (see VALIDATION_NOTES.md): a 160-transaction
# sample of real, dataset-confirmed Whirlpool rounds found 8-participant
# rounds are the most common shape (63.8%), with exactly-5 only 10.6% —
# the original exactly-5 rule structurally missed most real Whirlpool
# activity. This widening is a direct, disclosed fix for that finding.
# ──────────────────────────────────────────────────────────────────────
WHIRLPOOL_POOL_DENOMS_SATS: List[int] = [
    100_000,      # 0.001 BTC
    1_000_000,    # 0.01 BTC
    5_000_000,    # 0.05 BTC
    50_000_000,   # 0.5 BTC
]
WHIRLPOOL_ROUND_SIZES = {5, 6, 7, 8}

# ──────────────────────────────────────────────────────────────────────
# Protocol 2: Wasabi 2.0 / WabiSabi
#
# Unlike Whirlpool, WabiSabi does not use one fixed per-round denomination —
# real rounds (verified against 8 real txids sampled from the crocs-muni/
# coinjoin-analysis dataset's wasabi2 coordinator list, see
# VALIDATION_NOTES.md) instead produce MULTIPLE simultaneous equal-value
# output clusters (typically 9-23 distinct clusters observed, each 5-14
# outputs), across large output counts (35-137 observed), with cluster
# values that are suspiciously "round" in binary/ternary terms — powers of
# two (e.g. 2097152 = 2^21), powers of three (e.g. 4782969 = 3^14), and
# round decimal multiples (e.g. 20000000 = 0.2 BTC, 10000000 = 0.1 BTC).
#
# TODO: the power-of-2/power-of-3 denomination-ladder pattern is this
# project's own inference from observing real samples, not independently
# verified against WabiSabi's official specification/whitepaper. Verify
# before treating the "round denomination" bonus signal as authoritative.
# ──────────────────────────────────────────────────────────────────────
WABISABI_MIN_OUTPUT_COUNT = 20
WABISABI_MIN_GROUP_COUNT = 3
WABISABI_MIN_GROUP_SIZE = 5

# ──────────────────────────────────────────────────────────────────────
# Protocol 3 (generic fallback): any transaction with a meaningful cluster
# of equal-value outputs that doesn't match a specific protocol's known
# parameters. Deliberately protocol-agnostic and capped at COINJOIN_LIKE —
# this exists to surface real signal on JoinMarket-style and other/unknown
# equal-output CoinJoin activity without claiming a specific protocol.
# ──────────────────────────────────────────────────────────────────────
GENERIC_MIN_GROUP_SIZE = 3
GENERIC_MIN_GROUP_FRACTION = 0.3

PROTOCOL_WHIRLPOOL_LEGACY = "WHIRLPOOL_LEGACY"
PROTOCOL_WABISABI_LIKE = "WABISABI_LIKE"
PROTOCOL_GENERIC_EQUAL_OUTPUT = "GENERIC_EQUAL_OUTPUT_COINJOIN"
PROTOCOL_UNKNOWN = "UNKNOWN"

CLASS_CONFIRMED_WHIRLPOOL = "CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN"
CLASS_LIKELY_WHIRLPOOL = "LIKELY_WHIRLPOOL_LEGACY_COINJOIN"
CLASS_CONFIRMED_WABISABI = "CONFIRMED_WABISABI_COINJOIN"
CLASS_LIKELY_WABISABI = "LIKELY_WABISABI_COINJOIN"
CLASS_COINJOIN_LIKE = "COINJOIN_LIKE"
CLASS_NOT_COINJOIN = "NOT_COINJOIN"

# Tier ranking used to pick the strongest match across all three rules —
# higher index wins; ties broken by raw score, then by rule specificity
# (Whirlpool > WabiSabi > Generic, since those are evaluated in that order).
_TIER_RANK = {
    CLASS_NOT_COINJOIN: 0,
    CLASS_COINJOIN_LIKE: 1,
    CLASS_LIKELY_WHIRLPOOL: 2,
    CLASS_LIKELY_WABISABI: 2,
    CLASS_CONFIRMED_WHIRLPOOL: 3,
    CLASS_CONFIRMED_WABISABI: 3,
}


def _is_power_of(n: int, base: int) -> bool:
    if n <= 0:
        return False
    while n % base == 0:
        n //= base
    return n == 1


def _looks_like_round_denomination(value_sats: int) -> bool:
    """Powers of 2, powers of 3, or a clean decimal multiple (1/2/5 x 10^k)."""
    if _is_power_of(value_sats, 2) or _is_power_of(value_sats, 3):
        return True
    for lead in (1, 2, 5):
        n = value_sats
        while n % 10 == 0:
            n //= 10
        if n == lead:
            return True
    return False


def classify_whirlpool_legacy(features: Dict[str, Any]) -> Dict[str, Any]:
    """Score a transaction against the legacy Whirlpool structural signature."""
    evidence: List[ClassificationSignal] = []
    evidence_against: List[str] = []
    score = 0

    input_in_range = features["input_count"] in WHIRLPOOL_ROUND_SIZES
    if input_in_range:
        score += 25
        evidence.append(ClassificationSignal(
            name="input_count_in_whirlpool_round_range", passed=True, weight=25,
            detail=f"Transaction has {features['input_count']} inputs (legacy Whirlpool rounds run 5-8 participants)",
        ))
    else:
        evidence_against.append(f"Input count {features['input_count']} is outside the 5-8 Whirlpool round-size range")

    output_in_range = features["output_count"] in WHIRLPOOL_ROUND_SIZES
    if output_in_range:
        score += 25
        evidence.append(ClassificationSignal(
            name="output_count_in_whirlpool_round_range", passed=True, weight=25,
            detail=f"Transaction has {features['output_count']} outputs (legacy Whirlpool rounds run 5-8 participants)",
        ))
    else:
        evidence_against.append(f"Output count {features['output_count']} is outside the 5-8 Whirlpool round-size range")

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
            detail="Equal output value matches a configured Whirlpool pool denomination",
        ))
    else:
        evidence_against.append("No configured Whirlpool denomination matched")

    if features["input_count"] != features["output_count"]:
        evidence_against.append("Input and output counts differ — legacy Whirlpool rounds always have equal input/output counts")

    classification, obf = _score_to_labels(score, CLASS_CONFIRMED_WHIRLPOOL, CLASS_LIKELY_WHIRLPOOL)
    protocol = PROTOCOL_WHIRLPOOL_LEGACY if classification != CLASS_NOT_COINJOIN and classification != CLASS_COINJOIN_LIKE else PROTOCOL_UNKNOWN

    return {
        "score": score, "classification": classification, "protocol": protocol,
        "confidence": round(score / 100, 4), "obfuscation_confidence": obf,
        "evidence": evidence, "evidence_against": evidence_against,
    }


def classify_wabisabi_like(features: Dict[str, Any]) -> Dict[str, Any]:
    """Score a transaction against the Wasabi 2.0 / WabiSabi structural signature."""
    evidence: List[ClassificationSignal] = []
    evidence_against: List[str] = []
    score = 0

    output_count = features["output_count"]
    group_count = features.get("equal_output_group_count", 0)
    largest_group = features.get("largest_equal_output_group_size", 0)
    value_counts = _value_counts(features)

    large_output_count = output_count >= WABISABI_MIN_OUTPUT_COUNT
    if large_output_count:
        score += 25
        evidence.append(ClassificationSignal(
            name="large_output_count", passed=True, weight=25,
            detail=f"Transaction has {output_count} outputs (WabiSabi rounds typically run large anonymity sets)",
        ))
    else:
        evidence_against.append(f"Only {output_count} outputs — WabiSabi rounds typically have {WABISABI_MIN_OUTPUT_COUNT}+")

    multi_cluster = group_count >= WABISABI_MIN_GROUP_COUNT
    if multi_cluster:
        score += 25
        evidence.append(ClassificationSignal(
            name="multiple_equal_value_clusters", passed=True, weight=25,
            detail=f"{group_count} distinct equal-value output clusters found (WabiSabi uses several simultaneous denominations, unlike Whirlpool's single fixed pool)",
        ))
    else:
        evidence_against.append(f"Only {group_count} equal-value output cluster(s) — WabiSabi typically has {WABISABI_MIN_GROUP_COUNT}+")

    large_cluster = largest_group >= WABISABI_MIN_GROUP_SIZE
    if large_cluster:
        score += 25
        evidence.append(ClassificationSignal(
            name="large_cluster_size", passed=True, weight=25,
            detail=f"Largest equal-value cluster has {largest_group} outputs",
        ))
    else:
        evidence_against.append(f"Largest equal-value cluster is only {largest_group} outputs — expected {WABISABI_MIN_GROUP_SIZE}+")

    round_denom_clusters = sum(
        1 for value, count in value_counts.items()
        if count >= 3 and _looks_like_round_denomination(value)
    )
    denom_ladder_signal = round_denom_clusters >= 2
    if denom_ladder_signal:
        score += 25
        evidence.append(ClassificationSignal(
            name="denomination_ladder_pattern", passed=True, weight=25,
            detail=f"{round_denom_clusters} output clusters match a power-of-2/3 or round-decimal denomination ladder",
        ))
    else:
        evidence_against.append("No power-of-2/3 or round-decimal denomination ladder pattern found across output clusters")

    classification, obf = _score_to_labels(score, CLASS_CONFIRMED_WABISABI, CLASS_LIKELY_WABISABI)
    protocol = PROTOCOL_WABISABI_LIKE if classification not in (CLASS_NOT_COINJOIN, CLASS_COINJOIN_LIKE) else PROTOCOL_UNKNOWN

    return {
        "score": score, "classification": classification, "protocol": protocol,
        "confidence": round(score / 100, 4), "obfuscation_confidence": obf,
        "evidence": evidence, "evidence_against": evidence_against,
    }


def classify_generic_equal_output(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Protocol-agnostic fallback: a meaningful cluster of equal-value outputs
    that doesn't match a specific protocol's known parameters. Capped at
    COINJOIN_LIKE regardless of score — this rule never claims a specific
    protocol identity, by design.
    """
    evidence: List[ClassificationSignal] = []
    evidence_against: List[str] = []
    score = 0

    output_count = features["output_count"]
    input_count = features["input_count"]
    largest_group = features.get("largest_equal_output_group_size", 0)
    fraction = (largest_group / output_count) if output_count else 0.0

    meaningful_cluster = largest_group >= GENERIC_MIN_GROUP_SIZE
    if meaningful_cluster:
        score += 40
        evidence.append(ClassificationSignal(
            name="equal_value_output_cluster", passed=True, weight=40,
            detail=f"{largest_group} outputs share an identical value",
        ))
    else:
        evidence_against.append(f"Largest equal-value output cluster is only {largest_group}")

    high_fraction = fraction >= GENERIC_MIN_GROUP_FRACTION
    if high_fraction:
        score += 30
        evidence.append(ClassificationSignal(
            name="equal_output_fraction", passed=True, weight=30,
            detail=f"{round(fraction * 100)}% of outputs belong to the largest equal-value cluster",
        ))
    else:
        evidence_against.append(f"Largest cluster is only {round(fraction * 100)}% of outputs")

    multi_party_shape = input_count >= 2 and output_count >= 3
    if multi_party_shape:
        score += 30
        evidence.append(ClassificationSignal(
            name="multi_party_shape", passed=True, weight=30,
            detail=f"{input_count} inputs / {output_count} outputs — consistent with a multi-party transaction, not a simple payment",
        ))
    else:
        evidence_against.append("Input/output shape is consistent with a simple payment, not a multi-party transaction")

    if score >= 40:
        classification = CLASS_COINJOIN_LIKE
        obf = "LOW" if score < 70 else "MEDIUM"
        protocol = PROTOCOL_GENERIC_EQUAL_OUTPUT
    else:
        classification = CLASS_NOT_COINJOIN
        obf = "NONE"
        protocol = PROTOCOL_UNKNOWN

    return {
        "score": score, "classification": classification, "protocol": protocol,
        "confidence": round(score / 100, 4), "obfuscation_confidence": obf,
        "evidence": evidence, "evidence_against": evidence_against,
    }


def classify_transaction(features: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run all three rules (most specific first), pick the strongest match, and
    report the others too — nothing is hidden even when a lower-priority
    rule also fired. This is the general-purpose entry point; the three
    classify_*() functions above remain independently callable/testable.
    """
    candidates = [
        classify_whirlpool_legacy(features),
        classify_wabisabi_like(features),
        classify_generic_equal_output(features),
    ]

    def rank(c: Dict[str, Any]) -> Tuple[int, int]:
        return (_TIER_RANK.get(c["classification"], 0), c["score"])

    best = max(candidates, key=rank)

    if best["classification"] in (CLASS_COINJOIN_LIKE, CLASS_NOT_COINJOIN):
        hint = compute_negative_hint(features)
        if hint is not None:
            best["classification_hint"] = hint

    best["checked_protocols"] = [
        {"protocol": c["protocol"], "classification": c["classification"], "score": c["score"]}
        for c in candidates
    ]
    return best


def _value_counts(features: Dict[str, Any]) -> Dict[int, int]:
    from collections import Counter
    return dict(Counter(features.get("output_values_sats", [])))


def _score_to_labels(score: int, confirmed_label: str, likely_label: str) -> Tuple[str, str]:
    if score >= 90:
        return confirmed_label, "HIGH"
    if score >= 70:
        return likely_label, "MEDIUM"
    if score >= 40:
        return CLASS_COINJOIN_LIKE, "LOW"
    return CLASS_NOT_COINJOIN, "NONE"


def compute_negative_hint(features: Dict[str, Any]) -> Any:
    """
    Cheap structural hints for transactions that aren't a CoinJoin match.
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
