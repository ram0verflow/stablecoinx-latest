"""
Loads the precomputed demo fixtures (PHASE B) — see
app/data/obfuscation_demo_fixtures.json for provenance.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

_FIXTURES_PATH = Path(__file__).resolve().parents[2] / "data" / "obfuscation_demo_fixtures.json"

_cache: Optional[Dict[str, Any]] = None


def _load() -> Dict[str, Any]:
    global _cache
    if _cache is None:
        with open(_FIXTURES_PATH) as f:
            _cache = json.load(f)
    return _cache


def get_fixture(txid: str) -> Optional[Dict[str, Any]]:
    """Returns the precomputed classifier result dict for `txid`, or None
    if it isn't a fixture txid — callers should fall back to a live fetch."""
    return _load().get(txid)


def list_fixture_txids() -> list:
    return [k for k in _load().keys() if k != "_meta"]


def list_all_fixtures() -> Dict[str, Dict[str, Any]]:
    """Returns {txid: precomputed_result} for every fixture (excludes _meta)."""
    return {k: v for k, v in _load().items() if k != "_meta"}
