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
    limits: List[str]
    source: str


def _build_response(classifier_dict: Dict[str, Any], source: str, txid: str) -> ObfuscationAnalyzeResponse:
    separate = classifier_dict.get("separate_signals", {}) or {}
    illicit_attribution = separate.get("illicit_attribution", "NOT_EVALUATED")
    provenance_confidence = separate.get("provenance_confidence", "NOT_EVALUATED")

    provider = get_provider_attribution(txid)

    policy_recommendation = compute_policy_recommendation(
        protocol=classifier_dict.get("protocol", "UNKNOWN"),
        obfuscation_confidence=classifier_dict.get("obfuscation_confidence", "NONE"),
        classification=classifier_dict.get("classification", "NOT_WHIRLPOOL"),
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
        limits=classifier_dict.get("limits", []),
        source=source,
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
