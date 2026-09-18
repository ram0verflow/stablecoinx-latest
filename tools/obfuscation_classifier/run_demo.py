#!/usr/bin/env python3
"""
CLI entry point for the Protocol-Aware Obfuscation Classifier.

Usage:
    python tools/obfuscation_classifier/run_demo.py --txid <bitcoin_txid>

Standalone proof-of-concept — not wired into the main app. See README.md.
"""

from __future__ import annotations

import argparse
import json
import sys

from classifier import analyze_txid


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Identify legacy Whirlpool-style CoinJoin transaction structure from a Bitcoin txid.",
    )
    parser.add_argument("--txid", required=True, help="Bitcoin transaction id (64 hex characters)")
    args = parser.parse_args()

    result = analyze_txid(args.txid)
    payload = result.to_dict() if hasattr(result, "to_dict") else result

    print(json.dumps(payload, indent=2))
    return 1 if isinstance(payload, dict) and payload.get("error") else 0


if __name__ == "__main__":
    sys.exit(main())
