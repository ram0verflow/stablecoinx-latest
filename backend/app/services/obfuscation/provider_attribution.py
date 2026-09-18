"""
External attribution provider for Obfuscation Intelligence (PHASE D).

Important, repeated deliberately: Beeceptor here is a MOCK EXTERNAL
ATTRIBUTION PROVIDER, not the classifier and not ground truth. The
classifier (tools/obfuscation_classifier) only ever reports transaction
*structure*. Whether a wallet/txid has known illicit exposure is a
completely different question, answered (in this demo) by this mock
provider — a real deployment would point this at Chainalysis/TRM/Elliptic
or similar, not at Beeceptor.

Contract (GET {BEECEPTOR_OBFUSCATION_URL}/tx-risk/{txid}):
    {"known_illicit_attribution": bool, "known_scam_exposure": bool,
     "known_sanctions_exposure": bool, "risk_score": number,
     "freshness_seconds": number, "provider_status": "live_mock"}
"""

from __future__ import annotations

import logging
from typing import Any, Dict

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

NOT_CONFIGURED: Dict[str, Any] = {"source": "none", "status": "not_configured"}


def get_provider_attribution(txid: str) -> Dict[str, Any]:
    """
    Returns a provider_attribution dict. Never raises — any failure
    (timeout, non-2xx, malformed body) becomes status="degraded", which
    policy.py treats as a reason for manual review, never a silent pass.
    """
    mode = (settings.OBFUSCATION_PROVIDER_MODE or "none").strip().lower()

    if mode != "beeceptor":
        return dict(NOT_CONFIGURED)

    base_url = (settings.BEECEPTOR_OBFUSCATION_URL or "").strip()
    if not base_url:
        return {"source": "beeceptor", "status": "not_configured"}

    url = f"{base_url.rstrip('/')}/tx-risk/{txid}"
    try:
        resp = httpx.get(url, timeout=settings.BEECEPTOR_OBFUSCATION_TIMEOUT_SECONDS)
        if resp.status_code >= 300:
            logger.warning(f"Beeceptor obfuscation provider returned HTTP {resp.status_code} for {txid}")
            return {"source": "beeceptor", "status": "degraded", "reason": f"http_{resp.status_code}"}

        body = resp.json()
        return {
            "source": "beeceptor",
            "status": "live_mock",
            "known_illicit_attribution": bool(body.get("known_illicit_attribution", False)),
            "known_scam_exposure": bool(body.get("known_scam_exposure", False)),
            "known_sanctions_exposure": bool(body.get("known_sanctions_exposure", False)),
            "risk_score": body.get("risk_score"),
            "freshness_seconds": body.get("freshness_seconds"),
        }
    except Exception as exc:
        logger.warning(f"Beeceptor obfuscation provider unreachable for {txid}: {exc}")
        return {"source": "beeceptor", "status": "degraded", "reason": str(exc)}
