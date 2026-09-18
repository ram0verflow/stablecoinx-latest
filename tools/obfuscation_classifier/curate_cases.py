#!/usr/bin/env python3
"""
Helper CLI for populating and sanity-checking test_cases.json.

Usage:
    python tools/obfuscation_classifier/curate_cases.py
    python tools/obfuscation_classifier/curate_cases.py --write-enriched
    python tools/obfuscation_classifier/curate_cases.py --suggest-negatives
    python tools/obfuscation_classifier/curate_cases.py --suggest-negatives --auto-add-negatives

This does NOT run the benchmark scoring — see benchmark.py for that. This
script is purely about curating/inspecting the fixture file itself.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

from classifier import analyze_txid
from features import extract_features
from fetchers import FetcherError, fetch_transaction
from schemas import normalize_transaction

HERE = Path(__file__).resolve().parent
TEST_CASES_PATH = HERE / "test_cases.json"
ENRICHED_PATH = HERE / "test_cases.enriched.json"

BLOCKSTREAM_BASE = "https://blockstream.info/api"
AUTO_CURATED_SOURCE_NOTE = "Auto-curated from recent Bitcoin block; manually verify before public claims."


def load_test_cases() -> List[Dict[str, Any]]:
    with open(TEST_CASES_PATH) as f:
        return json.load(f)


def _get_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "certapay-obfuscation-classifier-curator"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode().strip()


def summarize_case(case: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Fetch + classify one case, printing a human-readable summary. Returns
    the enriched case dict (with live-fetched fields added) or None on
    fetch failure (printed, not raised)."""
    txid = case["txid"]
    if txid == "TODO":
        print(f"[SKIP] {case.get('category', '?')}: TODO placeholder — {case.get('notes', '')}")
        return None

    print(f"\n--- {txid} (expected: {case.get('expected_classification', case.get('category'))}) ---")
    try:
        raw = fetch_transaction(txid)
    except FetcherError as e:
        print(f"  FETCH ERROR: {e}")
        return None

    tx = normalize_transaction(raw)
    feats = extract_features(tx)
    result = analyze_txid(txid)
    result_dict = result.to_dict() if hasattr(result, "to_dict") else result

    print(f"  input_count:  {feats['input_count']}")
    print(f"  output_count: {feats['output_count']}")
    print(f"  output_values_sats: {feats['output_values_sats']}")
    print(f"  all_outputs_equal: {feats['all_outputs_equal']}")
    print(f"  largest_equal_output_group_size: {feats['largest_equal_output_group_size']}")
    print(f"  -> classification: {result_dict.get('classification')} "
          f"(protocol={result_dict.get('protocol')}, confidence={result_dict.get('confidence')})")

    match_ok = result_dict.get("classification") == case.get("expected_classification")
    if "expected_classification" in case:
        print(f"  matches expected_classification: {match_ok}")

    enriched = dict(case)
    enriched["_curation"] = {
        "input_count": feats["input_count"],
        "output_count": feats["output_count"],
        "all_outputs_equal": feats["all_outputs_equal"],
        "largest_equal_output_group_size": feats["largest_equal_output_group_size"],
        "predicted_classification": result_dict.get("classification"),
        "predicted_protocol": result_dict.get("protocol"),
        "matches_expected": match_ok if "expected_classification" in case else None,
    }
    return enriched


def suggest_recent_negative_candidates(blocks_to_scan: int = 3, max_checked: int = 250) -> Dict[str, Any]:
    """
    Scan a few recent mainnet blocks for likely ordinary/batching/consolidation
    negative examples. Read-only — never writes test_cases.json itself; the
    caller decides whether to persist anything (see --auto-add-negatives).
    """
    print(f"\nScanning up to {blocks_to_scan} recent block(s) for negative-example candidates...")
    try:
        tip = _get_text(f"{BLOCKSTREAM_BASE}/blocks/tip/hash")
    except Exception as e:
        print(f"  Could not reach Blockstream to list recent blocks: {e}")
        return {"ordinary": None, "batching": None, "consolidation": None}

    all_txids: List[str] = []
    block_hash = tip
    for _ in range(blocks_to_scan):
        try:
            txids = json.loads(_get_text(f"{BLOCKSTREAM_BASE}/block/{block_hash}/txids"))
            all_txids.extend(txids[1:])  # skip coinbase
            block = json.loads(_get_text(f"{BLOCKSTREAM_BASE}/block/{block_hash}"))
            block_hash = block["previousblockhash"]
        except Exception as e:
            print(f"  Stopped scanning blocks early: {e}")
            break
        time.sleep(0.1)

    found: Dict[str, Optional[Dict[str, Any]]] = {"ordinary": None, "batching": None, "consolidation": None}
    checked = 0
    for t in all_txids:
        if all(v is not None for v in found.values()) or checked >= max_checked:
            break
        checked += 1
        try:
            raw = fetch_transaction(t)
        except FetcherError:
            continue
        tx = normalize_transaction(raw)
        feats = extract_features(tx)

        if found["ordinary"] is None and tx.input_count == 1 and tx.output_count <= 2:
            found["ordinary"] = {"txid": t, "category": "ordinary_payment_negative", **feats}
        if found["batching"] is None and tx.output_count >= 20 and not feats["all_outputs_equal"]:
            found["batching"] = {"txid": t, "category": "batching_negative", **feats}
        if found["consolidation"] is None and tx.input_count >= 10 and tx.output_count <= 3:
            found["consolidation"] = {"txid": t, "category": "consolidation_negative", **feats}
        time.sleep(0.02)

    print(f"  Checked {checked} recent transactions.")
    for key, val in found.items():
        if val:
            print(f"  {key}: {val['txid']} (in={val['input_count']}, out={val['output_count']})")
        else:
            print(f"  {key}: none found in this scan")
    return found


def main() -> int:
    parser = argparse.ArgumentParser(description="Curate and sanity-check obfuscation classifier test cases.")
    parser.add_argument("--write-enriched", action="store_true",
                         help="Write test_cases.enriched.json with live-fetched summary fields added.")
    parser.add_argument("--suggest-negatives", action="store_true",
                         help="Scan recent mainnet blocks for candidate negative examples (read-only by default).")
    parser.add_argument("--auto-add-negatives", action="store_true",
                         help="Implies --suggest-negatives, and appends any found candidates to test_cases.json "
                              "with an explicit 'auto-curated, manually verify' source note.")
    args = parser.parse_args()

    cases = load_test_cases()
    print(f"Loaded {len(cases)} test cases from {TEST_CASES_PATH.name}")

    enriched_cases = []
    for case in cases:
        enriched = summarize_case(case)
        enriched_cases.append(enriched if enriched is not None else case)

    if args.write_enriched:
        with open(ENRICHED_PATH, "w") as f:
            json.dump(enriched_cases, f, indent=2)
        print(f"\nWrote {ENRICHED_PATH.name}")

    if args.suggest_negatives or args.auto_add_negatives:
        candidates = suggest_recent_negative_candidates()

        if args.auto_add_negatives:
            added = 0
            for key, val in candidates.items():
                if val is None:
                    continue
                cases.append({
                    "txid": val["txid"],
                    "expected_family": "UNKNOWN",
                    "expected_classification": "NOT_WHIRLPOOL",
                    "category": val["category"],
                    "source": "Auto-curated from a recent Bitcoin mainnet block via Blockstream Esplora",
                    "source_url": f"{BLOCKSTREAM_BASE}/tx/{val['txid']}",
                    "notes": AUTO_CURATED_SOURCE_NOTE,
                })
                added += 1
            if added:
                with open(TEST_CASES_PATH, "w") as f:
                    json.dump(cases, f, indent=2)
                print(f"\nAppended {added} auto-curated negative candidate(s) to {TEST_CASES_PATH.name}. "
                      f"{AUTO_CURATED_SOURCE_NOTE}")
            else:
                print("\nNo candidates found to add.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
