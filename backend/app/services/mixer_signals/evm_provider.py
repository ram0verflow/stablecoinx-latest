"""
EVM mixer/risk signal provider — Etherscan API V2 (unified multi-chain).

Honesty constraint: as of the V1->V2 migration, every Etherscan-family
explorer (Etherscan, BscScan, PolygonScan, Basescan) requires a registered
API key even on the free tier — confirmed live by direct request, which
returned: "You are using a deprecated V1 endpoint, switch to Etherscan API
V2". There is no genuinely free/keyless path for EVM chains. Rather than
fake a result, this module returns available=False with the real reason
when ETHERSCAN_API_KEY is unset, and does real V2 calls when it is set.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.core.config import settings
from app.services.mixer_signals.tron_provider import (
    RULE_FAN_IN_MAX_DISTINCT_SENDERS,
    RULE_FAN_IN_MIN_INCOMING,
    RULE_FAN_IN_WEIGHT,
    RULE_FAN_OUT_MIN_COUNTERPARTIES,
    RULE_FAN_OUT_WEIGHT,
    RULE_PEELING_CHAIN_MIN_STEPS,
    RULE_PEELING_CHAIN_WEIGHT,
    RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS,
    RULE_RAPID_SUCCESSION_MIN_PAIRS,
    RULE_RAPID_SUCCESSION_WEIGHT,
    RULE_REPEATED_AMOUNT_MIN_COUNT,
    RULE_REPEATED_AMOUNT_WEIGHT,
    _longest_decreasing_run,
    _tier_for,
)

# EVM native-currency amounts are wei (18 decimals) rather than Tron's sun
# (6 decimals) — "round" here means an exact multiple of 0.01 of the native
# token, the EVM-appropriate equivalent of the Tron rule's 100 TRX unit.
RULE_ROUND_AMOUNT_UNIT_WEI = 10 ** 16
RULE_ROUND_AMOUNT_MIN_COUNT = 3
RULE_ROUND_AMOUNT_WEIGHT = 15

logger = logging.getLogger(__name__)

ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"

# chainid + explorer subdomain per Etherscan API V2's unified chain routing.
# Coverage confirmed live against the configured key on 2026-09-19: chains
# marked free_tier=True return real data; the others return Etherscan's own
# "Free API access is not supported for this chain — upgrade your plan"
# message, which is surfaced verbatim as the unavailable reason rather than
# being hidden or faked.
_CHAIN_CONFIG = {
    "base sepolia": {"chainid": 84532, "explorer": "sepolia.basescan.org", "display": "Base Sepolia"},
    "base": {"chainid": 8453, "explorer": "basescan.org", "display": "Base"},
    "polygon amoy": {"chainid": 80002, "explorer": "amoy.polygonscan.com", "display": "Polygon Amoy"},
    "polygon": {"chainid": 137, "explorer": "polygonscan.com", "display": "Polygon"},
    "bsc": {"chainid": 56, "explorer": "bscscan.com", "display": "BSC"},
    "binance smart chain": {"chainid": 56, "explorer": "bscscan.com", "display": "BSC"},
    "ethereum": {"chainid": 1, "explorer": "etherscan.io", "display": "Ethereum"},
    "ethereum sepolia": {"chainid": 11155111, "explorer": "sepolia.etherscan.io", "display": "Ethereum Sepolia"},
    "arbitrum": {"chainid": 42161, "explorer": "arbiscan.io", "display": "Arbitrum"},
    "arbitrum sepolia": {"chainid": 421614, "explorer": "sepolia.arbiscan.io", "display": "Arbitrum Sepolia"},
    "optimism": {"chainid": 10, "explorer": "optimistic.etherscan.io", "display": "Optimism"},
    "optimism sepolia": {"chainid": 11155420, "explorer": "sepolia-optimism.etherscan.io", "display": "Optimism Sepolia"},
    "avalanche": {"chainid": 43114, "explorer": "snowtrace.io", "display": "Avalanche"},
}


def _resolve_chain(chain: str) -> Dict[str, Any]:
    key = (chain or "").strip().lower()
    return _CHAIN_CONFIG.get(key, {"chainid": None, "explorer": "etherscan.io", "display": chain or "EVM"})


def _compute_heuristics(address: str, txs: list) -> Dict[str, Any]:
    out_counterparties: set = set()
    in_counterparties: set = set()
    incoming_count = 0
    amounts: Dict[str, int] = {}
    timestamps: list = []
    outgoing_by_time: list = []  # (timestamp, amount_int) for peeling-chain check
    round_amount_count = 0

    for tx in txs:
        frm = (tx.get("from") or "").lower()
        to = (tx.get("to") or "").lower()
        ts = tx.get("timeStamp")
        if ts is not None:
            timestamps.append(int(ts))
        value = tx.get("value")
        value_int = int(value) if value else 0
        if value:
            amounts[value] = amounts.get(value, 0) + 1
            if value_int % RULE_ROUND_AMOUNT_UNIT_WEI == 0:
                round_amount_count += 1
        if frm == address.lower() and to:
            out_counterparties.add(to)
            if value_int and ts is not None:
                outgoing_by_time.append((int(ts), value_int))
        elif to == address.lower() and frm:
            in_counterparties.add(frm)
            incoming_count += 1

    timestamps.sort(reverse=True)
    rapid_pairs = sum(
        1 for i in range(1, len(timestamps))
        if 0 <= timestamps[i - 1] - timestamps[i] <= RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS
    )
    max_repeated_amount = max(amounts.values(), default=0)

    outgoing_by_time.sort(key=lambda pair: pair[0])
    longest_peel_run = _longest_decreasing_run([amt for _, amt in outgoing_by_time])

    checks = []
    score = 0

    fan_out_hit = len(out_counterparties) >= RULE_FAN_OUT_MIN_COUNTERPARTIES
    checks.append({"name": "fan_out_dispersion", "label": "High fan-out to distinct counterparties", "matched": fan_out_hit, "weight": RULE_FAN_OUT_WEIGHT, "detail": f"{len(out_counterparties)} distinct outgoing counterparties in last {len(txs)} transactions (threshold: {RULE_FAN_OUT_MIN_COUNTERPARTIES})"})
    if fan_out_hit:
        score += RULE_FAN_OUT_WEIGHT

    rapid_hit = rapid_pairs >= RULE_RAPID_SUCCESSION_MIN_PAIRS
    checks.append({"name": "rapid_succession", "label": "Rapid-succession transaction bursts", "matched": rapid_hit, "weight": RULE_RAPID_SUCCESSION_WEIGHT, "detail": f"{rapid_pairs} consecutive transaction pairs under {RULE_RAPID_SUCCESSION_MAX_DELTA_SECONDS}s apart (threshold: {RULE_RAPID_SUCCESSION_MIN_PAIRS})"})
    if rapid_hit:
        score += RULE_RAPID_SUCCESSION_WEIGHT

    repeated_hit = max_repeated_amount >= RULE_REPEATED_AMOUNT_MIN_COUNT
    checks.append({"name": "repeated_amount", "label": "Repeated identical transfer amounts", "matched": repeated_hit, "weight": RULE_REPEATED_AMOUNT_WEIGHT, "detail": f"Largest identical-amount cluster: {max_repeated_amount} transactions (threshold: {RULE_REPEATED_AMOUNT_MIN_COUNT})"})
    if repeated_hit:
        score += RULE_REPEATED_AMOUNT_WEIGHT

    fan_in_hit = incoming_count >= RULE_FAN_IN_MIN_INCOMING and 0 < len(in_counterparties) <= RULE_FAN_IN_MAX_DISTINCT_SENDERS
    checks.append({"name": "fan_in_aggregation", "label": "Concentrated fan-in from few senders", "matched": fan_in_hit, "weight": RULE_FAN_IN_WEIGHT, "detail": f"{incoming_count} incoming transactions from only {len(in_counterparties)} distinct sender(s) (thresholds: >= {RULE_FAN_IN_MIN_INCOMING} incoming, <= {RULE_FAN_IN_MAX_DISTINCT_SENDERS} senders)"})
    if fan_in_hit:
        score += RULE_FAN_IN_WEIGHT

    round_hit = round_amount_count >= RULE_ROUND_AMOUNT_MIN_COUNT
    checks.append({"name": "round_amount_bias", "label": "Suspiciously round transfer amounts", "matched": round_hit, "weight": RULE_ROUND_AMOUNT_WEIGHT, "detail": f"{round_amount_count} transaction(s) in exact multiples of 0.01 native token (threshold: {RULE_ROUND_AMOUNT_MIN_COUNT}) — organic transfers rarely land on a clean denomination"})
    if round_hit:
        score += RULE_ROUND_AMOUNT_WEIGHT

    peeling_hit = longest_peel_run >= RULE_PEELING_CHAIN_MIN_STEPS
    checks.append({"name": "peeling_chain", "label": "Peeling-chain amount sequence", "matched": peeling_hit, "weight": RULE_PEELING_CHAIN_WEIGHT, "detail": f"Longest run of strictly-decreasing outgoing amounts over time: {longest_peel_run} (threshold: {RULE_PEELING_CHAIN_MIN_STEPS}) — single-hop proxy for the multi-hop peeling-chain pattern"})
    if peeling_hit:
        score += RULE_PEELING_CHAIN_WEIGHT

    score = min(score, 100)
    return {
        "score": score, "tier": _tier_for(score), "patterns_checked": checks,
        "distinct_out_counterparties": len(out_counterparties),
        "distinct_in_counterparties": len(in_counterparties),
        "incoming_count": incoming_count,
        "outgoing_count": len(txs) - incoming_count,
    }


def analyze(address: str, chain: str, limit: int = 30) -> Dict[str, Any]:
    cfg = _resolve_chain(chain)
    explorer_url = f"https://{cfg['explorer']}/address/{address}"

    api_key = (settings.ETHERSCAN_API_KEY or "").strip()
    if not api_key:
        return {
            "available": False,
            "chain": cfg["display"],
            "address": address,
            "explorer_url": explorer_url,
            "reason": (
                "Etherscan API V2 requires a registered API key for every EVM "
                "chain (Ethereum, Base, Polygon, BSC) since the V1 deprecation "
                "— no genuinely free/keyless endpoint exists. ETHERSCAN_API_KEY "
                "is not configured, so this signal is honestly unavailable "
                "rather than simulated."
            ),
        }

    if cfg["chainid"] is None:
        return {
            "available": False,
            "chain": cfg["display"],
            "address": address,
            "explorer_url": explorer_url,
            "reason": f"Unrecognized EVM chain '{chain}' — no chain ID mapping configured.",
        }

    params = {
        "chainid": cfg["chainid"],
        "module": "account",
        "action": "txlist",
        "address": address,
        "sort": "desc",
        "offset": limit,
        "page": 1,
        "apikey": api_key,
    }
    try:
        resp = httpx.get(ETHERSCAN_V2_BASE, params=params, timeout=settings.MIXER_SIGNALS_TIMEOUT_SECONDS)
        resp.raise_for_status()
        body = resp.json()
    except Exception as exc:
        logger.warning(f"Etherscan V2 fetch failed for {address} on {chain}: {exc}")
        return {
            "available": False,
            "chain": cfg["display"],
            "address": address,
            "explorer_url": explorer_url,
            "reason": f"Etherscan API V2 unreachable or errored: {exc}",
        }

    if str(body.get("status")) != "1":
        # Etherscan puts the useful detail in `result` for plan/tier errors
        # (message is just "NOTOK"); fall back to message otherwise.
        detail = body.get("result") if isinstance(body.get("result"), str) else None
        return {
            "available": False,
            "chain": cfg["display"],
            "address": address,
            "explorer_url": explorer_url,
            "reason": f"Etherscan API V2 returned: {detail or body.get('message', 'unknown error')}",
        }

    txs = body.get("result", []) or []
    heuristics = _compute_heuristics(address, txs)

    recent = []
    for tx in txs[:10]:
        frm = (tx.get("from") or "").lower()
        recent.append({
            "timestamp": int(tx["timeStamp"]) * 1000 if tx.get("timeStamp") else None,
            "direction": "out" if frm == address.lower() else "in",
            "counterparty": tx.get("to") if frm == address.lower() else tx.get("from"),
            "amount_wei": tx.get("value"),
        })

    return {
        "available": True,
        "chain": cfg["display"],
        "address": address,
        "explorer_url": explorer_url,
        "source": "etherscan_v2_api",
        "sample_size": len(txs),
        "total_tx_count": len(txs),
        "hard_signal": {
            "source": "N/A — Etherscan V2 txlist has no built-in risk classification",
            "flagged": None,
            "detail": "Etherscan does not expose an address risk flag via the free API tier; only the self-computed heuristic signal below is available for this chain.",
        },
        "soft_signal": heuristics,
        "recent_transactions": recent,
    }
