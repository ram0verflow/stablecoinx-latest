"""
Mixer Signals API — chain-aware, general-purpose EVM/Tron address risk
signal endpoint (replaces the Bitcoin-specific Obfuscation Intelligence
feature as the primary compliance signal for this platform's actual
USDC/USDT rails; see app/services/mixer_signals/).

Response shape enforces two separate signals, never blended:
  - hard_signal: a real third-party classification (TronScan risk flag on
    Tron; unavailable on EVM chains, which expose no such field on the
    free API tier).
  - soft_signal: our own deterministic heuristic pattern score, computed
    over the wallet's real, live-fetched transaction history.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.mixer_signals.service import analyze_wallet

router = APIRouter()

_EVM_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_TRON_RE = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")


class PatternCheck(BaseModel):
    name: str
    label: str
    matched: bool
    weight: int
    detail: str


class SoftSignal(BaseModel):
    score: int
    tier: str
    patterns_checked: List[PatternCheck]
    distinct_out_counterparties: int
    distinct_in_counterparties: int
    incoming_count: int
    outgoing_count: int


class HardSignal(BaseModel):
    source: str
    flagged: Optional[bool] = None
    detail: str


class RecentTransaction(BaseModel):
    timestamp: Optional[int] = None
    direction: str
    counterparty: Optional[str] = None
    amount_sun: Optional[int] = None
    amount_wei: Optional[str] = None


class MixerSignalResponse(BaseModel):
    available: bool
    chain: str
    address: str
    explorer_url: str
    reason: Optional[str] = None
    source: Optional[str] = None
    sample_size: Optional[int] = None
    total_tx_count: Optional[int] = None
    hard_signal: Optional[HardSignal] = None
    soft_signal: Optional[SoftSignal] = None
    recent_transactions: List[RecentTransaction] = []


@router.get("/analyze", response_model=MixerSignalResponse)
def analyze(
    address: str = Query(...),
    chain: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    address = (address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="address is required")

    is_tron = (chain or "").strip().lower() in {"tron", "trx"}
    if is_tron and not _TRON_RE.match(address):
        raise HTTPException(status_code=400, detail=f"Invalid Tron address format: {address}")
    if not is_tron and not _EVM_RE.match(address):
        raise HTTPException(status_code=400, detail=f"Invalid EVM address format: {address}")

    result: Dict[str, Any] = analyze_wallet(address, chain)
    return MixerSignalResponse(**result)
