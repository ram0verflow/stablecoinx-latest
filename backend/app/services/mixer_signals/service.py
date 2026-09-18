"""
Chain-aware dispatcher for mixer/risk signal analysis. Selects the real
backend (TronScan for Tron, Etherscan V2 for EVM chains) based on which
chain the wallet actually settles on — never a single hardcoded chain.

A short in-process TTL cache sits in front of both providers. Both
TronScan's public API and Etherscan's free tier rate-limit per second;
without this, a judge opening several payments in a row, or re-analyzing
the same address, would risk a 429 instead of a real result. The cache
never masks a failure — only a successful `available=True` result is
cached — and it's short enough (30s) that "check my own input" always
reflects genuinely live data, not a stale demo.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, Tuple

from app.services.mixer_signals import evm_provider, tron_provider

_TRON_CHAIN_NAMES = {"tron", "trx"}
_CACHE_TTL_SECONDS = 30.0

_cache: Dict[Tuple[str, str], Tuple[float, Dict[str, Any]]] = {}
_cache_lock = threading.Lock()


def _cache_key(address: str, chain: str) -> Tuple[str, str]:
    return (address.strip().lower(), (chain or "").strip().lower())


def analyze_wallet(address: str, chain: str, use_cache: bool = True) -> Dict[str, Any]:
    key = _cache_key(address, chain)

    if use_cache:
        with _cache_lock:
            cached = _cache.get(key)
        if cached and (time.monotonic() - cached[0]) < _CACHE_TTL_SECONDS:
            return dict(cached[1])

    normalized = (chain or "").strip().lower()
    if normalized in _TRON_CHAIN_NAMES:
        result = tron_provider.analyze(address)
    else:
        result = evm_provider.analyze(address, chain)

    if use_cache and result.get("available"):
        with _cache_lock:
            _cache[key] = (time.monotonic(), result)

    return result
