"""
Top-level orchestration: txid in, ClassificationResult (or a clean error
dict) out. This is the only function callers outside this package should use.
"""

from __future__ import annotations

from typing import Any, Dict, Union

from fetchers import FetcherError, fetch_transaction
from features import extract_features
from rules import classify_whirlpool_legacy
from schemas import ClassificationResult, normalize_transaction


def analyze_txid(txid: str) -> Union[ClassificationResult, Dict[str, Any]]:
    """
    Analyze a Bitcoin txid and return a ClassificationResult.

    On any recoverable failure (bad txid format, not found, API timeout,
    non-JSON response, rate limiting, or any other unexpected error), this
    returns a plain error dict — {"error": true, "message": ..., "txid": ...}
    — instead of a ClassificationResult, and never raises. This is a
    deliberate, pragmatic deviation from the plain `-> ClassificationResult`
    signature: forcing a failed fetch into a fake classification (with a
    made-up protocol/confidence) would be more misleading than useful.
    """
    try:
        raw = fetch_transaction(txid)
        tx = normalize_transaction(raw)
        features = extract_features(tx)
        rule_result = classify_whirlpool_legacy(features)

        return ClassificationResult(
            txid=tx.txid or txid,
            classification=rule_result["classification"],
            protocol=rule_result["protocol"],
            confidence=rule_result["confidence"],
            obfuscation_confidence=rule_result["obfuscation_confidence"],
            evidence=rule_result["evidence"],
            evidence_against=rule_result["evidence_against"],
            classification_hint=rule_result.get("classification_hint"),
        )
    except FetcherError as e:
        return {"error": True, "message": str(e), "txid": txid}
    except Exception as e:  # last-resort safety net — never a bare traceback
        return {"error": True, "message": f"Unexpected error: {e}", "txid": txid}
