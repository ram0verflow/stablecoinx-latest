"""
Beeceptor-backed ComplianceProvider.

Two mock endpoints the user configures in their Beeceptor workspace:

    POST {BEECEPTOR_BASE_URL}/compliance/screen
    body: {"sender_company", "receiver_company", "sender_wallet", "receiver_wallet"}
    -> {"kyc_status": "verified"|"missing"|"expired", "sanctions_hit": bool,
        "matched_entity": string|null, "internal_blacklist_hit": bool}

    POST {BEECEPTOR_BASE_URL}/compliance/wallet-risk
    body: {"identifier"}
    -> {"risk_score": float, "overall_risk": "low"|"medium"|"high"|"critical",
        "mixer_adjacent": bool, "laundering_cluster": bool}

Any failure to reach or parse either endpoint (timeout, non-2xx, malformed
body) is treated as a DEGRADED result, never a silent pass — a compliance
provider outage must route the payment to manual review, not approve it or
report it as low risk. This is the same seam Beeceptor's own latency/failure
-injection tooling is meant to exercise (see docs/SPONSOR_INTEGRATIONS.md).
"""

import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

PROVIDER_NAME = "beeceptor"


def _degraded(reason: str) -> dict:
    return {
        "kyc_status": "unknown",
        "kyb_status": "unknown",
        "sanctions_hit": False,
        "sanctions_details": {},
        "internal_blacklist_hit": False,
        "expired_docs": False,
        "kyc_details": {},
        "overall": "fail",
        "provider_name": PROVIDER_NAME,
        "provider_status": "degraded",
        "provider_detail": reason,
        "latency_ms": None,
    }


def _normalize(data: dict, latency_ms: int) -> dict:
    if not isinstance(data, dict):
        return _degraded("malformed response body (not a JSON object)")

    kyc_status = data.get("kyc_status")
    if kyc_status not in ("verified", "missing", "expired"):
        kyc_status = "unknown"

    sanctions_hit = bool(data.get("sanctions_hit", False))
    internal_blacklist_hit = bool(data.get("internal_blacklist_hit", False))
    kyc_missing = kyc_status != "verified"

    overall = "fail" if (sanctions_hit or internal_blacklist_hit or kyc_missing) else "pass"

    return {
        "kyc_status": kyc_status,
        "kyb_status": kyc_status,
        "sanctions_hit": sanctions_hit,
        "sanctions_details": {"matched_entity": data.get("matched_entity")},
        "internal_blacklist_hit": internal_blacklist_hit,
        "expired_docs": kyc_status == "expired",
        "kyc_details": {},
        "overall": overall,
        "provider_name": PROVIDER_NAME,
        "provider_status": "live",
        "provider_detail": None,
        "latency_ms": latency_ms,
    }


def _wallet_degraded(reason: str) -> dict:
    return {
        "risk_score": None,
        "overall_risk": "unknown",
        "mixer_adjacent": False,
        "laundering_cluster": False,
        "suspicious_links": [],
        "provider_name": PROVIDER_NAME,
        "provider_status": "degraded",
        "provider_detail": reason,
        # kept as `neo4j_degraded` (not e.g. `provider_degraded`) so callers and
        # the existing test suite have one fail-safe signal regardless of which
        # backing intelligence source is actually configured.
        "neo4j_degraded": True,
    }


def check_wallet_risk(identifier: str) -> dict:
    base_url = settings.BEECEPTOR_BASE_URL.strip()
    if not base_url:
        return _wallet_degraded("BEECEPTOR_BASE_URL not configured")

    try:
        response = httpx.post(
            f"{base_url.rstrip('/')}/compliance/wallet-risk",
            json={"identifier": identifier},
            timeout=settings.BEECEPTOR_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        logger.warning("Beeceptor wallet-risk provider timed out")
        return _wallet_degraded("request timed out")
    except httpx.HTTPStatusError as exc:
        logger.warning(f"Beeceptor wallet-risk provider returned {exc.response.status_code}")
        return _wallet_degraded(f"provider returned HTTP {exc.response.status_code}")
    except (httpx.RequestError, ValueError) as exc:
        logger.warning(f"Beeceptor wallet-risk provider unreachable or returned invalid JSON: {exc}")
        return _wallet_degraded(str(exc))

    if not isinstance(data, dict):
        return _wallet_degraded("malformed response body (not a JSON object)")

    overall_risk = data.get("overall_risk")
    if overall_risk not in ("low", "medium", "high", "critical"):
        overall_risk = "unknown"

    return {
        "risk_score": data.get("risk_score"),
        "overall_risk": overall_risk,
        "mixer_adjacent": bool(data.get("mixer_adjacent", False)),
        "laundering_cluster": bool(data.get("laundering_cluster", False)),
        "suspicious_links": data.get("suspicious_links", []) if isinstance(data.get("suspicious_links"), list) else [],
        "provider_name": PROVIDER_NAME,
        "provider_status": "live",
        "provider_detail": None,
        "neo4j_degraded": False,
    }


def screen(
    sender_company: str,
    receiver_company: str,
    sender_wallet: str | None,
    receiver_wallet: str | None,
) -> dict:
    base_url = settings.BEECEPTOR_BASE_URL.strip()
    if not base_url:
        return _degraded("BEECEPTOR_BASE_URL not configured")

    payload = {
        "sender_company": sender_company,
        "receiver_company": receiver_company,
        "sender_wallet": sender_wallet,
        "receiver_wallet": receiver_wallet,
    }

    started = time.monotonic()
    try:
        response = httpx.post(
            f"{base_url.rstrip('/')}/compliance/screen",
            json=payload,
            timeout=settings.BEECEPTOR_TIMEOUT_SECONDS,
        )
        latency_ms = int((time.monotonic() - started) * 1000)
        response.raise_for_status()
        data = response.json()
    except httpx.TimeoutException:
        logger.warning("Beeceptor compliance provider timed out")
        return _degraded("request timed out")
    except httpx.HTTPStatusError as exc:
        logger.warning(f"Beeceptor compliance provider returned {exc.response.status_code}")
        return _degraded(f"provider returned HTTP {exc.response.status_code}")
    except (httpx.RequestError, ValueError) as exc:
        logger.warning(f"Beeceptor compliance provider unreachable or returned invalid JSON: {exc}")
        return _degraded(str(exc))

    return _normalize(data, latency_ms)
