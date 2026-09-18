"""
Tron mixer/risk signal provider — real, keyless TronScan public API only.

Two signals, kept separate and never blended, same philosophy as
services/obfuscation/policy.py's illicit_attribution vs obfuscation_confidence
split:

  - hard_signal: TronScan's own address `risk` flag, taken verbatim from
    their `normalAddressInfo` map on the same response used for the
    transaction sample below. This is a real third-party classification,
    not something we compute.

  - soft_signal: a small set of deterministic, explainable heuristics we
    compute ourselves over the real transaction sample (fan-out dispersion,
    rapid-succession bursts, repeated identical amounts, fan-in
    aggregation). Each rule is independently checked and reported, whether
    or not it matched — nothing is hidden. This is pattern detection, not
    an accusation; it is explicitly labeled as inferred/heuristic.

No endpoint here requires an API key. Verified live against
apilist.tronscanapi.com on 2026-09-19.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TRON_API_BASE = "https://apilist.tronscanapi.com"
_UA = "Mozilla/5.0 (compatible; CertaPay-MixerSignals/1.0)"

# Weights are deliberately small in number and each independently
# explainable — mirrors the obfuscation classifier's "no black box" rule.
RULE_FAN_OUT_MIN_COUNTERPARTIES = 8
RULE_FAN_OUT_WEIGHT = 35

RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS = 60
RULE_RAPID_SUCCESSION_MIN_PAIRS = 3
RULE_RAPID_SUCCESSION_WEIGHT = 30

RULE_REPEATED_AMOUNT_MIN_COUNT = 3
RULE_REPEATED_AMOUNT_WEIGHT = 20

RULE_FAN_IN_MAX_DISTINCT_SENDERS = 3
RULE_FAN_IN_MIN_INCOMING = 8
RULE_FAN_IN_WEIGHT = 15


def _tier_for(score: int) -> str:
    if score >= 60:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    if score >= 15:
        return "LOW"
    return "NONE"


def _fetch_activity(address: str, limit: int = 30) -> Dict[str, Any]:
    url = f"{TRON_API_BASE}/api/transaction"
    params = {
        "address": address,
        "sort": "-timestamp",
        "count": "true",
        "limit": limit,
        "start": 0,
    }
    resp = httpx.get(
        url, params=params, timeout=settings.MIXER_SIGNALS_TIMEOUT_SECONDS,
        headers={"User-Agent": _UA},
    )
    resp.raise_for_status()
    return resp.json()


def _extract_amount(tx: Dict[str, Any]) -> Optional[int]:
    """Tron transactions vary by contract type (transfer, TRC10/20 transfer,
    resource delegation, etc.) so the real amount lives in different fields
    depending on type. Checks them in the order TronScan itself populates."""
    contract_data = tx.get("contractData") or {}
    for candidate in (tx.get("amount"), contract_data.get("amount"), contract_data.get("balance")):
        if candidate in (None, "", "0", 0):
            continue
        try:
            return int(candidate)
        except (TypeError, ValueError):
            continue
    return None


def _compute_heuristics(address: str, txs: List[Dict[str, Any]]) -> Dict[str, Any]:
    out_counterparties: set = set()
    in_counterparties: set = set()
    incoming_count = 0
    amounts: Dict[int, int] = {}
    timestamps: List[int] = []

    for tx in txs:
        owner = tx.get("ownerAddress")
        to = tx.get("toAddress")
        ts = tx.get("timestamp")
        if ts is not None:
            timestamps.append(ts)
        amount = _extract_amount(tx)
        if amount:
            amounts[amount] = amounts.get(amount, 0) + 1

        if owner == address and to:
            out_counterparties.add(to)
        elif to == address and owner:
            in_counterparties.add(owner)
            incoming_count += 1

    # sorted desc by TronScan already (sort=-timestamp); re-sort defensively.
    timestamps.sort(reverse=True)
    rapid_pairs = 0
    for i in range(1, len(timestamps)):
        delta = (timestamps[i - 1] - timestamps[i]) / 1000.0
        if 0 <= delta <= RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS:
            rapid_pairs += 1

    max_repeated_amount = max(amounts.values(), default=0)

    checks = []
    score = 0

    fan_out_hit = len(out_counterparties) >= RULE_FAN_OUT_MIN_COUNTERPARTIES
    checks.append({
        "name": "fan_out_dispersion",
        "label": "High fan-out to distinct counterparties",
        "matched": fan_out_hit,
        "weight": RULE_FAN_OUT_WEIGHT,
        "detail": f"{len(out_counterparties)} distinct outgoing counterparties in last {len(txs)} transactions (threshold: {RULE_FAN_OUT_MIN_COUNTERPARTIES})",
    })
    if fan_out_hit:
        score += RULE_FAN_OUT_WEIGHT

    rapid_hit = rapid_pairs >= RULE_RAPID_SUCCESSION_MIN_PAIRS
    checks.append({
        "name": "rapid_succession",
        "label": "Rapid-succession transaction bursts",
        "matched": rapid_hit,
        "weight": RULE_RAPID_SUCCESSION_WEIGHT,
        "detail": f"{rapid_pairs} consecutive transaction pairs under {RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS}s apart (threshold: {RULE_RAPID_SUCCESSION_MIN_PAIRS})",
    })
    if rapid_hit:
        score += RULE_RAPID_SUCCESSION_WEIGHT

    repeated_hit = max_repeated_amount >= RULE_REPEATED_AMOUNT_MIN_COUNT
    checks.append({
        "name": "repeated_amount",
        "label": "Repeated identical transfer amounts",
        "matched": repeated_hit,
        "weight": RULE_REPEATED_AMOUNT_WEIGHT,
        "detail": f"Largest identical-amount cluster: {max_repeated_amount} transactions (threshold: {RULE_REPEATED_AMOUNT_MIN_COUNT})",
    })
    if repeated_hit:
        score += RULE_REPEATED_AMOUNT_WEIGHT

    fan_in_hit = (
        incoming_count >= RULE_FAN_IN_MIN_INCOMING
        and 0 < len(in_counterparties) <= RULE_FAN_IN_MAX_DISTINCT_SENDERS
    )
    checks.append({
        "name": "fan_in_aggregation",
        "label": "Concentrated fan-in from few senders",
        "matched": fan_in_hit,
        "weight": RULE_FAN_IN_WEIGHT,
        "detail": f"{incoming_count} incoming transactions from only {len(in_counterparties)} distinct sender(s) (thresholds: >= {RULE_FAN_IN_MIN_INCOMING} incoming, <= {RULE_FAN_IN_MAX_DISTINCT_SENDERS} senders)",
    })
    if fan_in_hit:
        score += RULE_FAN_IN_WEIGHT

    score = min(score, 100)

    return {
        "score": score,
        "tier": _tier_for(score),
        "patterns_checked": checks,
        "distinct_out_counterparties": len(out_counterparties),
        "distinct_in_counterparties": len(in_counterparties),
        "incoming_count": incoming_count,
        "outgoing_count": len(txs) - incoming_count,
    }


def analyze(address: str, limit: int = 30) -> Dict[str, Any]:
    """
    Real, live analysis of a Tron address via TronScan's public (keyless)
    API. Never fabricates a result — on any fetch failure, returns
    available=False with the real error reason instead of guessing.
    """
    explorer_url = f"https://tronscan.org/#/address/{address}"
    try:
        payload = _fetch_activity(address, limit=limit)
    except Exception as exc:
        logger.warning(f"TronScan fetch failed for {address}: {exc}")
        return {
            "available": False,
            "chain": "Tron",
            "address": address,
            "explorer_url": explorer_url,
            "reason": f"TronScan API unreachable or errored: {exc}",
        }

    txs = payload.get("data", []) or []
    total_tx_count = payload.get("total", len(txs))
    normal_info = payload.get("normalAddressInfo", {}) or {}

    address_info = normal_info.get(address) or {}
    hard_flagged: Optional[bool] = address_info.get("risk") if address_info else None

    heuristics = _compute_heuristics(address, txs)

    recent: List[Dict[str, Any]] = []
    for tx in txs[:10]:
        owner = tx.get("ownerAddress")
        to = tx.get("toAddress")
        amount = _extract_amount(tx)
        recent.append({
            "timestamp": tx.get("timestamp"),
            "direction": "out" if owner == address else "in",
            "counterparty": to if owner == address else owner,
            "amount_sun": amount,
        })

    return {
        "available": True,
        "chain": "Tron",
        "address": address,
        "explorer_url": explorer_url,
        "source": "tronscan_public_api",
        "sample_size": len(txs),
        "total_tx_count": total_tx_count,
        "hard_signal": {
            "source": "TronScan address risk classification",
            "flagged": bool(hard_flagged) if hard_flagged is not None else None,
            "detail": (
                "TronScan has not classified this address as high-risk."
                if hard_flagged is False
                else "TronScan classifies this address as high-risk."
                if hard_flagged is True
                else "TronScan returned no risk classification for this address."
            ),
        },
        "soft_signal": heuristics,
        "recent_transactions": recent,
    }
