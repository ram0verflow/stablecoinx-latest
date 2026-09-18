"""
Bitcoin transaction fetcher — Blockstream Esplora first, mempool.space as a
same-shape fallback (both expose the same Esplora-style REST API, so one
normalizer in schemas.py covers both).

Deliberately stdlib-only (urllib, json) — no httpx/requests dependency, so
this tool has no install step.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from typing import Any, Dict

TXID_RE = re.compile(r"^[0-9a-fA-F]{64}$")

BLOCKSTREAM_BASE = "https://blockstream.info/api"
MEMPOOL_SPACE_BASE = "https://mempool.space/api"

REQUEST_TIMEOUT_SECONDS = 10
USER_AGENT = "certapay-obfuscation-classifier/0.1 (+standalone research tool)"


class FetcherError(Exception):
    """Raised for any recoverable fetch failure. Callers must catch this and
    return a clean error payload — never let it become an uncaught traceback."""


def validate_txid(txid: str) -> str:
    txid = (txid or "").strip()
    if not TXID_RE.match(txid):
        raise FetcherError(
            f"Invalid txid format: expected 64 hex characters, got {len(txid)!r} "
            f"characters ({txid[:20]!r}...)"
        )
    return txid


def _get_json(url: str) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise FetcherError("Transaction not found") from e
        if e.code == 429:
            raise FetcherError("Rate limited by the block explorer API — try again shortly") from e
        raise FetcherError(f"Block explorer API returned HTTP {e.code}") from e
    except urllib.error.URLError as e:
        raise FetcherError(f"Could not reach block explorer API: {e.reason}") from e
    except TimeoutError as e:
        raise FetcherError("Block explorer API request timed out") from e

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise FetcherError("Block explorer API returned a non-JSON response") from e


def fetch_transaction(txid: str) -> Dict[str, Any]:
    """
    Fetch a raw Esplora-shaped transaction JSON for `txid`.

    Tries Blockstream Esplora first (per spec), falls back to mempool.space
    (same response shape) only on a connectivity/availability failure — a
    definitive "not found" or bad-format error is not retried against the
    fallback, since it would fail there too.
    """
    txid = validate_txid(txid)
    url = f"{BLOCKSTREAM_BASE}/tx/{txid}"

    try:
        return _get_json(url)
    except FetcherError as primary_error:
        if "not found" in str(primary_error).lower() or "Invalid txid" in str(primary_error):
            raise

        fallback_url = f"{MEMPOOL_SPACE_BASE}/tx/{txid}"
        try:
            return _get_json(fallback_url)
        except FetcherError as fallback_error:
            raise FetcherError(
                f"Both block explorer APIs failed. Blockstream: {primary_error}. "
                f"mempool.space: {fallback_error}."
            ) from fallback_error
