"""
Obfuscation Intelligence API — thin HTTP wrapper around the standalone
tools/obfuscation_classifier tool (via classifier_adapter.py), plus:
  - a demo-reliable fixture cache (PHASE B)
  - deterministic policy mapping (PHASE C, see services/obfuscation/policy.py)
  - an optional external attribution provider mock (PHASE D, Beeceptor)

Product distinction this endpoint exists to enforce in the response shape
itself, not just in prose: protocol classification is not unmixing,
obfuscation confidence is not illicit attribution, and a provider hit is a
SEPARATE signal from the classifier — never blended into one score.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.obfuscation.classifier_adapter import analyze_txid_dict
from app.services.obfuscation.fixtures import get_fixture
from app.services.obfuscation.policy import compute_policy_recommendation, policy_message_for
from app.services.obfuscation.provider_attribution import get_provider_attribution

router = APIRouter()

TXID_RE = re.compile(r"^[0-9a-fA-F]{64}$")

# backend/app/api/v1/endpoints/obfuscation.py -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[5]
_BENCHMARK_REPORT_PATH = _REPO_ROOT / "tools" / "obfuscation_classifier" / "benchmark_report.json"


class ObfuscationAnalyzeRequest(BaseModel):
    txid: str
    chain: str = "bitcoin"


class EvidenceSignal(BaseModel):
    name: str
    passed: bool
    weight: int
    detail: str


class CheckedProtocol(BaseModel):
    protocol: str
    classification: str
    score: int


class ChartData(BaseModel):
    input_count: int
    output_count: int
    output_values_sats: List[int]
    unique_output_values: List[int]
    largest_equal_output_group_size: int
    equal_output_group_count: int
    total_output_sats: Optional[int] = None
    total_input_sats: Optional[int] = None
    fee_sats: Optional[int] = None
    block_height: Optional[int] = None
    block_time: Optional[int] = None


class ProviderAttribution(BaseModel):
    source: str
    status: str
    known_illicit_attribution: Optional[bool] = None
    known_scam_exposure: Optional[bool] = None
    known_sanctions_exposure: Optional[bool] = None
    risk_score: Optional[float] = None
    freshness_seconds: Optional[float] = None
    reason: Optional[str] = None


class ObfuscationAnalyzeResponse(BaseModel):
    txid: str
    classification: str
    protocol: str
    confidence: float
    obfuscation_confidence: str
    provenance_confidence: str
    illicit_attribution: str
    provider_attribution: ProviderAttribution
    policy_recommendation: str
    policy_message: str
    evidence: List[EvidenceSignal]
    evidence_against: List[str] = Field(default_factory=list)
    classification_hint: Optional[str] = None
    checked_protocols: List[CheckedProtocol] = Field(default_factory=list)
    chart_data: Optional[ChartData] = None
    limits: List[str]
    source: str
    blockstream_url: str


def _build_response(
    classifier_dict: Dict[str, Any],
    source: str,
    txid: str,
    frozen_provider_attribution: Optional[Dict[str, Any]] = None,
) -> ObfuscationAnalyzeResponse:
    separate = classifier_dict.get("separate_signals", {}) or {}
    illicit_attribution = separate.get("illicit_attribution", "NOT_EVALUATED")
    provenance_confidence = separate.get("provenance_confidence", "NOT_EVALUATED")

    # /demo-pool passes a frozen provider_attribution (same fixture-cache
    # philosophy as the classifier result itself) — a live Beeceptor call
    # per pool entry made that endpoint take ~28s for 33 entries; a single
    # /analyze call still does a live call since it's only ever one txid.
    provider = frozen_provider_attribution if frozen_provider_attribution is not None else get_provider_attribution(txid)

    policy_recommendation = compute_policy_recommendation(
        protocol=classifier_dict.get("protocol", "UNKNOWN"),
        obfuscation_confidence=classifier_dict.get("obfuscation_confidence", "NONE"),
        classification=classifier_dict.get("classification", "NOT_COINJOIN"),
        provider_attribution=provider,
    )

    return ObfuscationAnalyzeResponse(
        txid=classifier_dict.get("txid", txid),
        classification=classifier_dict["classification"],
        protocol=classifier_dict["protocol"],
        confidence=classifier_dict["confidence"],
        obfuscation_confidence=classifier_dict["obfuscation_confidence"],
        provenance_confidence=provenance_confidence,
        illicit_attribution=illicit_attribution,
        provider_attribution=ProviderAttribution(**provider),
        policy_recommendation=policy_recommendation,
        policy_message=policy_message_for(policy_recommendation),
        evidence=[EvidenceSignal(**e) for e in classifier_dict.get("evidence", [])],
        evidence_against=classifier_dict.get("evidence_against", []),
        classification_hint=classifier_dict.get("classification_hint"),
        checked_protocols=[CheckedProtocol(**p) for p in classifier_dict.get("checked_protocols", [])],
        chart_data=ChartData(**classifier_dict["chart_data"]) if classifier_dict.get("chart_data") else None,
        limits=classifier_dict.get("limits", []),
        source=source,
        blockstream_url=f"https://blockstream.info/tx/{classifier_dict.get('txid', txid)}",
    )


@router.post("/analyze", response_model=ObfuscationAnalyzeResponse)
def analyze(
    request: ObfuscationAnalyzeRequest,
    current_user: User = Depends(get_current_user),
):
    txid = (request.txid or "").strip()

    if request.chain.strip().lower() != "bitcoin":
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported chain '{request.chain}' — Obfuscation Intelligence currently supports 'bitcoin' only.",
        )

    if not TXID_RE.match(txid):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid txid format: expected 64 hex characters, got {len(txid)}.",
        )

    fixture = get_fixture(txid)
    if fixture is not None:
        return _build_response(fixture, source="cached_validation_fixture", txid=txid)

    result = analyze_txid_dict(txid)
    if result.get("error"):
        raise HTTPException(status_code=502, detail=result.get("message", "Classifier fetch failed"))

    return _build_response(result, source="live_blockstream_fetch", txid=txid)


@router.get("/demo-txids")
def demo_txids(current_user: User = Depends(get_current_user)):
    """Lists the precomputed fixture txids, for the frontend to offer as
    one-click demo examples without the user needing to know a real txid."""
    from app.services.obfuscation.fixtures import list_fixture_txids

    return {"txids": list_fixture_txids()}


class DemoPoolEntry(BaseModel):
    result: ObfuscationAnalyzeResponse
    category: Optional[str] = None


@router.get("/demo-pool")
def demo_pool(current_user: User = Depends(get_current_user)):
    """
    Every precomputed fixture (real, Blockstream-verified txids covering
    both protocols + real negatives — see app/data/obfuscation_demo_fixtures.json),
    fully resolved (evidence, policy, provider attribution) in one call.

    Used by the frontend to deterministically assign a real txid to EVERY
    payment (no manual per-payment tagging) without triggering N live
    analyze calls or N Blockstream fetches — the whole pool is fixture-backed,
    so this is instant and rate-limit-proof regardless of how many payments
    reference it.
    """
    from app.services.obfuscation.fixtures import list_all_fixtures

    entries = []
    for txid, fixture in list_all_fixtures().items():
        category = fixture.get("_category")
        frozen_provider = fixture.get("_provider_attribution")
        resp = _build_response(
            fixture, source="cached_validation_fixture", txid=txid,
            frozen_provider_attribution=frozen_provider,
        )
        entries.append(DemoPoolEntry(result=resp, category=category))
    return {"pool": entries}


@router.get("/validation-snapshot")
def validation_snapshot(current_user: User = Depends(get_current_user)):
    """
    Trimmed summary of tools/obfuscation_classifier/benchmark_report.json,
    for the UI's validation-snapshot panel. Reads the file fresh on every
    call (not cached) so re-running benchmark.py updates the UI without a
    frontend rebuild. Returns available=false rather than an error if the
    report hasn't been generated yet — this is informational, not required
    for /analyze to work.
    """
    if not _BENCHMARK_REPORT_PATH.exists():
        return {"available": False}

    try:
        with open(_BENCHMARK_REPORT_PATH) as f:
            report: Dict[str, Any] = json.load(f)
    except Exception:
        return {"available": False}

    return {
        "available": True,
        "generated_at": report.get("generated_at"),
        "claim": report.get("claim"),
        "total_runnable_cases": report.get("total_runnable_cases"),
        "error_cases": report.get("error_cases"),
        "correct_count": report.get("correct_count"),
        "incorrect_count": report.get("incorrect_count"),
        "precision": report.get("whirlpool_positive_detection", {}).get("precision"),
        "recall": report.get("whirlpool_positive_detection", {}).get("recall"),
        "small_sample_warning": report.get("SMALL_SAMPLE_WARNING"),
    }
