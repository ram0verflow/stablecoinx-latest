"""
Deterministic feature extraction from a NormalizedTransaction.

No ML, no black-box scoring — every value here is a plain, explainable
count/aggregate/comparison over inputs and outputs.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, List, Optional

from schemas import NormalizedTransaction

SATS_PER_BTC = 100_000_000


def extract_features(tx: NormalizedTransaction) -> Dict[str, Any]:
    output_values_sats: List[int] = [o.value_sats for o in tx.outputs if o.value_sats is not None]

    value_counts = Counter(output_values_sats)
    unique_output_values = sorted(value_counts.keys())

    all_outputs_equal = (
        len(output_values_sats) == tx.output_count
        and tx.output_count > 0
        and len(unique_output_values) == 1
    )

    largest_equal_output_group_size = max(value_counts.values()) if value_counts else 0
    equal_output_group_count = sum(1 for count in value_counts.values() if count >= 2)

    total_output_sats: Optional[int] = sum(output_values_sats) if output_values_sats else None

    input_values_sats = [i.value_sats for i in tx.inputs if i.value_sats is not None]
    total_input_sats: Optional[int] = (
        sum(input_values_sats) if len(input_values_sats) == tx.input_count and tx.input_count > 0 else None
    )

    equal_output_value_sats: Optional[int] = unique_output_values[0] if all_outputs_equal else None
    output_value_btc: Optional[float] = (
        equal_output_value_sats / SATS_PER_BTC if equal_output_value_sats is not None else None
    )

    features: Dict[str, Any] = {
        "input_count": tx.input_count,
        "output_count": tx.output_count,
        "output_values_sats": output_values_sats,
        "unique_output_values": unique_output_values,
        "all_outputs_equal": all_outputs_equal,
        "largest_equal_output_group_size": largest_equal_output_group_size,
        "equal_output_group_count": equal_output_group_count,
        "total_output_sats": total_output_sats,
        "total_input_sats": total_input_sats,
        "fee_sats": tx.fee_sats,
        "equal_output_value_sats": equal_output_value_sats,
        "output_value_btc": output_value_btc,
        # Convenience booleans used directly by rules.py
        "is_5x5": tx.input_count == 5 and tx.output_count == 5,
        "has_equal_outputs": all_outputs_equal,
        "has_whirlpool_output_count": tx.output_count == 5,
        "has_whirlpool_input_count": tx.input_count == 5,
    }
    return features
