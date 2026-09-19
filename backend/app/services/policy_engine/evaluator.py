"""
Deterministic evaluator for a parsed team policy against a payment-shaped
dict. Same "every rule checked, nothing hidden" transparency used
throughout this codebase's other rule engines (see
tools/obfuscation_classifier and services/mixer_signals): every rule is
reported with whether it matched, in priority order, not just the winner.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


def _as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else [value]


def _match_field(payment: Dict[str, Any], field: str, expected: Any) -> bool:
    actual = payment.get(field)
    if actual is None:
        return False
    return str(actual).strip().lower() in {str(v).strip().lower() for v in _as_list(expected)}


def _match_chain_in(payment: Dict[str, Any], expected: Any) -> bool:
    wanted = {str(v).strip().lower() for v in _as_list(expected)}
    src = str(payment.get("source_chain") or "").strip().lower()
    dst = str(payment.get("destination_chain") or "").strip().lower()
    return src in wanted or dst in wanted


def _match_amount(payment: Dict[str, Any], key: str, threshold: float) -> bool:
    try:
        amount = float(payment.get("amount", 0))
    except (TypeError, ValueError):
        return False
    if key == "amount_gt":
        return amount > threshold
    if key == "amount_gte":
        return amount >= threshold
    if key == "amount_lt":
        return amount < threshold
    if key == "amount_lte":
        return amount <= threshold
    return False


def _rule_matches(rule: Dict[str, Any], payment: Dict[str, Any]) -> bool:
    for key, expected in rule["when"].items():
        if key == "chain_in":
            if not _match_chain_in(payment, expected):
                return False
        elif key in {"amount_gt", "amount_gte", "amount_lt", "amount_lte"}:
            if not _match_amount(payment, key, float(expected)):
                return False
        else:
            if not _match_field(payment, key, expected):
                return False
    return True


def evaluate_policy(rules: List[Dict[str, Any]], payment: Dict[str, Any]) -> Dict[str, Any]:
    """Rules are pre-sorted by priority (desc) by dsl.parse_policy_yaml.
    First match wins; every rule's outcome is still reported for
    transparency, mirroring the classifier's checked_protocols pattern."""
    evaluated: List[Dict[str, Any]] = []
    winner: Optional[Dict[str, Any]] = None

    for rule in rules:
        matched = _rule_matches(rule, payment)
        evaluated.append({
            "name": rule["name"],
            "description": rule["description"],
            "priority": rule["priority"],
            "action": rule["action"],
            "matched": matched,
        })
        if matched and winner is None:
            winner = rule

    return {
        "matched": winner is not None,
        "matched_rule": winner["name"] if winner else None,
        "action": winner["action"] if winner else "allow",
        "evaluated_rules": evaluated,
    }
