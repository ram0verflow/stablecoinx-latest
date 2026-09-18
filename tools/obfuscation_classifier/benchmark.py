#!/usr/bin/env python3
"""
Benchmark runner for the Protocol-Aware Obfuscation Classifier.

Usage:
    python tools/obfuscation_classifier/benchmark.py

Loads test_cases.json, skips "TODO" placeholders, runs analyze_txid() on
every real case, compares against the curated expectation, and writes
benchmark_report.json + benchmark_report.md. Prints a readable table too.

This script does not overclaim: it reports fetch errors and mismatches as
plainly as matches, and adds SMALL_SAMPLE_WARNING when the runnable sample
is under 10 cases — the whole point of Phase 2 is an honest report, not a
flattering one.
"""

from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from classifier import analyze_txid

# Blockstream rate-limits bursts of rapid sequential requests (observed
# directly during Phase 2 development — a 23-case run with no delay tripped
# a 429 partway through, repeatedly, even after waiting for an initial
# rate-limit window to clear). A small inter-request delay plus one retry
# after a longer backoff specifically for rate-limit errors keeps a full
# benchmark run reliable without hammering the API.
REQUEST_DELAY_SECONDS = 1.5
RATE_LIMIT_RETRY_BACKOFF_SECONDS = 8

HERE = Path(__file__).resolve().parent
TEST_CASES_PATH = HERE / "test_cases.json"
REPORT_JSON_PATH = HERE / "benchmark_report.json"
REPORT_MD_PATH = HERE / "benchmark_report.md"

POSITIVE_CLASSIFICATIONS = {"CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN", "LIKELY_WHIRLPOOL_LEGACY_COINJOIN"}

CLAIM = (
    "StableCoinX performs protocol-aware Whirlpool-style CoinJoin identification from "
    "transaction structure. This is identification, not unmixing, not user attribution, "
    "and not illicit attribution."
)


def is_predicted_positive(protocol: str, classification: str) -> bool:
    return protocol == "WHIRLPOOL_LEGACY" and classification in POSITIVE_CLASSIFICATIONS


def is_expected_positive(expected_family: str) -> bool:
    return expected_family == "WHIRLPOOL_LEGACY"


def run_benchmark() -> Dict[str, Any]:
    with open(TEST_CASES_PATH) as f:
        cases = json.load(f)

    skipped_todo = 0
    runnable_rows: List[Dict[str, Any]] = []
    error_rows: List[Dict[str, Any]] = []

    confusion: Dict[str, Dict[str, int]] = {}

    for i, case in enumerate(cases):
        txid = case.get("txid", "")
        if txid == "TODO":
            skipped_todo += 1
            continue

        if i > 0:
            time.sleep(REQUEST_DELAY_SECONDS)

        result = analyze_txid(txid)
        if (
            isinstance(result, dict)
            and result.get("error")
            and "rate limited" in str(result.get("message", "")).lower()
        ):
            # One retry after a longer backoff — this is the specific failure
            # mode observed in practice, not a general "retry everything" policy.
            time.sleep(RATE_LIMIT_RETRY_BACKOFF_SECONDS)
            result = analyze_txid(txid)

        if isinstance(result, dict) and result.get("error"):
            error_rows.append({
                "txid": txid,
                "category": case.get("category"),
                "error_message": result.get("message"),
            })
            continue

        d = result.to_dict()
        predicted_protocol = d.get("protocol")
        predicted_classification = d.get("classification")
        expected_family = case.get("expected_family")
        expected_classification = case.get("expected_classification")

        correct = predicted_classification == expected_classification

        pred_positive = is_predicted_positive(predicted_protocol, predicted_classification)
        exp_positive = is_expected_positive(expected_family)

        if pred_positive and exp_positive:
            outcome = "TP"
        elif pred_positive and not exp_positive:
            outcome = "FP"
        elif not pred_positive and exp_positive:
            outcome = "FN"
        else:
            outcome = "TN"

        confusion.setdefault(expected_family, {})
        confusion[expected_family][predicted_protocol] = confusion[expected_family].get(predicted_protocol, 0) + 1

        runnable_rows.append({
            "txid": txid,
            "category": case.get("category"),
            "expected_family": expected_family,
            "expected_classification": expected_classification,
            "predicted_protocol": predicted_protocol,
            "predicted_classification": predicted_classification,
            "confidence": d.get("confidence"),
            "correct": correct,
            "outcome": outcome,
        })

    total_runnable = len(runnable_rows)
    correct_count = sum(1 for r in runnable_rows if r["correct"])
    incorrect_count = total_runnable - correct_count

    tp = sum(1 for r in runnable_rows if r["outcome"] == "TP")
    fp = sum(1 for r in runnable_rows if r["outcome"] == "FP")
    fn = sum(1 for r in runnable_rows if r["outcome"] == "FN")
    tn = sum(1 for r in runnable_rows if r["outcome"] == "TN")

    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else None
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else None

    report: Dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "claim": CLAIM,
        "total_cases_in_file": len(cases),
        "skipped_todo_cases": skipped_todo,
        "total_runnable_cases": total_runnable,
        "error_cases": len(error_rows),
        "correct_count": correct_count,
        "incorrect_count": incorrect_count,
        "whirlpool_positive_detection": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "true_negatives": tn,
            "precision": precision,
            "recall": recall,
        },
        "confusion_expected_family_vs_predicted_protocol": confusion,
        "rows": runnable_rows,
        "errors": error_rows,
        "SMALL_SAMPLE_WARNING": total_runnable < 10,
    }
    return report


def print_table(report: Dict[str, Any]) -> None:
    print(f"\n{'txid':<20} {'category':<28} {'expected':<32} {'predicted':<32} {'outcome':<8}")
    print("-" * 122)
    for r in report["rows"]:
        print(f"{r['txid'][:16]+'...':<20} {r['category']:<28} {str(r['expected_classification']):<32} "
              f"{str(r['predicted_classification']):<32} {r['outcome']:<8}")

    if report["errors"]:
        print(f"\n{len(report['errors'])} case(s) failed to fetch/classify (reported, not hidden):")
        for e in report["errors"]:
            print(f"  {e['txid']} ({e['category']}): {e['error_message']}")

    print(f"\nTotal cases in file:      {report['total_cases_in_file']}")
    print(f"Skipped (TODO):           {report['skipped_todo_cases']}")
    print(f"Runnable:                 {report['total_runnable_cases']}")
    print(f"Errors:                   {report['error_cases']}")
    print(f"Correct:                  {report['correct_count']}")
    print(f"Incorrect:                {report['incorrect_count']}")
    wp = report["whirlpool_positive_detection"]
    print(f"Whirlpool-positive precision: {wp['precision']}")
    print(f"Whirlpool-positive recall:    {wp['recall']}")
    print(f"  TP={wp['true_positives']} FP={wp['false_positives']} "
          f"FN={wp['false_negatives']} TN={wp['true_negatives']}")
    if report["SMALL_SAMPLE_WARNING"]:
        print("\nSMALL_SAMPLE_WARNING: true — runnable sample is under 10 cases; "
              "treat these numbers as a seed validation, not a statistically robust benchmark.")


def write_markdown_report(report: Dict[str, Any]) -> str:
    wp = report["whirlpool_positive_detection"]
    lines = [
        "# Obfuscation Classifier — Benchmark Report",
        "",
        f"_Generated: {report['generated_at']}_",
        "",
        "**Claim:** " + report["claim"],
        "",
        "This report is a seed validation over a small, curated sample — see "
        "VALIDATION_NOTES.md for full context and known limitations. It is not a "
        "statistically robust accuracy claim.",
        "",
        "## Summary",
        "",
        f"- Total cases in file: {report['total_cases_in_file']}",
        f"- Skipped (`TODO` placeholders): {report['skipped_todo_cases']}",
        f"- Runnable cases: {report['total_runnable_cases']}",
        f"- Fetch/classify errors: {report['error_cases']}",
        f"- Correct (predicted classification == expected): {report['correct_count']}",
        f"- Incorrect: {report['incorrect_count']}",
        "",
        "## Whirlpool positive detection (structure-based, 5x5-legacy-rule scope only)",
        "",
        f"- True positives: {wp['true_positives']}",
        f"- False positives: {wp['false_positives']}",
        f"- False negatives: {wp['false_negatives']}",
        f"- True negatives: {wp['true_negatives']}",
        f"- Precision: {wp['precision']}",
        f"- Recall: {wp['recall']}",
        "",
    ]

    if report["SMALL_SAMPLE_WARNING"]:
        lines += [
            "> **SMALL_SAMPLE_WARNING: true** — the runnable sample is under 10 cases. "
            "Treat this as a seed validation, not a statistically robust benchmark.",
            "",
        ]

    lines += ["## Confusion: expected_family vs predicted_protocol", ""]
    lines += ["| expected_family | predicted_protocol | count |", "|---|---|---|"]
    for expected_family, preds in report["confusion_expected_family_vs_predicted_protocol"].items():
        for predicted_protocol, count in preds.items():
            lines.append(f"| {expected_family} | {predicted_protocol} | {count} |")
    lines.append("")

    lines += ["## Per-case results", ""]
    lines += ["| txid | category | expected | predicted | confidence | outcome |",
              "|---|---|---|---|---|---|"]
    for r in report["rows"]:
        lines.append(
            f"| `{r['txid'][:16]}...` | {r['category']} | {r['expected_classification']} | "
            f"{r['predicted_classification']} | {r['confidence']} | {r['outcome']} |"
        )
    lines.append("")

    if report["errors"]:
        lines += ["## Errors (not hidden)", ""]
        for e in report["errors"]:
            lines.append(f"- `{e['txid']}` ({e['category']}): {e['error_message']}")
        lines.append("")

    md = "\n".join(lines)
    return md


def main() -> int:
    report = run_benchmark()
    print_table(report)

    with open(REPORT_JSON_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nWrote {REPORT_JSON_PATH.name}")

    md = write_markdown_report(report)
    with open(REPORT_MD_PATH, "w") as f:
        f.write(md)
    print(f"Wrote {REPORT_MD_PATH.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
