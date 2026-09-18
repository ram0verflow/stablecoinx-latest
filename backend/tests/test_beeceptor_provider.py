import httpx
import pytest

from app.core.config import settings
from app.services.compliance import beeceptor_provider


@pytest.fixture(autouse=True)
def _configured_base_url(monkeypatch):
    monkeypatch.setattr(settings, "BEECEPTOR_BASE_URL", "https://example.free.beeceptor.com")
    monkeypatch.setattr(settings, "BEECEPTOR_TIMEOUT_SECONDS", 5.0)


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://example.free.beeceptor.com/compliance/screen")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self):
        return self._payload


def test_unconfigured_base_url_is_degraded(monkeypatch):
    monkeypatch.setattr(settings, "BEECEPTOR_BASE_URL", "")
    result = beeceptor_provider.screen("Acme", "Zenith", None, None)
    assert result["provider_status"] == "degraded"
    assert result["overall"] == "fail"


def test_live_clean_response_passes(monkeypatch):
    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResponse(200, {"kyc_status": "verified", "sanctions_hit": False, "internal_blacklist_hit": False}),
    )
    result = beeceptor_provider.screen("Acme", "Zenith", "0xabc", "0xdef")
    assert result["provider_status"] == "live"
    assert result["overall"] == "pass"
    assert result["sanctions_hit"] is False


def test_live_sanctions_hit_fails(monkeypatch):
    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResponse(200, {"kyc_status": "verified", "sanctions_hit": True, "matched_entity": "Restricted Co"}),
    )
    result = beeceptor_provider.screen("Acme", "Restricted Co", None, None)
    assert result["provider_status"] == "live"
    assert result["sanctions_hit"] is True
    assert result["overall"] == "fail"
    assert result["sanctions_details"]["matched_entity"] == "Restricted Co"


def test_timeout_is_degraded_not_a_pass(monkeypatch):
    def _raise_timeout(*a, **k):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "post", _raise_timeout)
    result = beeceptor_provider.screen("Acme", "Zenith", None, None)
    assert result["provider_status"] == "degraded"
    assert result["overall"] == "fail"


def test_http_error_is_degraded(monkeypatch):
    monkeypatch.setattr(httpx, "post", lambda *a, **k: _FakeResponse(500, {}))
    result = beeceptor_provider.screen("Acme", "Zenith", None, None)
    assert result["provider_status"] == "degraded"
    assert result["overall"] == "fail"


def test_malformed_json_body_is_degraded(monkeypatch):
    class _BadResponse(_FakeResponse):
        def json(self):
            raise ValueError("not json")

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _BadResponse(200, {}))
    result = beeceptor_provider.screen("Acme", "Zenith", None, None)
    assert result["provider_status"] == "degraded"


def test_non_dict_response_is_degraded(monkeypatch):
    class _ListResponse(_FakeResponse):
        def json(self):
            return ["not", "a", "dict"]

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _ListResponse(200, {}))
    result = beeceptor_provider.screen("Acme", "Zenith", None, None)
    assert result["provider_status"] == "degraded"


# ── check_wallet_risk ────────────────────────────────────────────────

def test_wallet_risk_unconfigured_base_url_is_degraded(monkeypatch):
    monkeypatch.setattr(settings, "BEECEPTOR_BASE_URL", "")
    result = beeceptor_provider.check_wallet_risk("0xabc")
    assert result["provider_status"] == "degraded"
    assert result["overall_risk"] == "unknown"
    assert result["neo4j_degraded"] is True


def test_wallet_risk_live_clean(monkeypatch):
    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResponse(200, {"risk_score": 0.1, "overall_risk": "low", "mixer_adjacent": False, "laundering_cluster": False}),
    )
    result = beeceptor_provider.check_wallet_risk("0xabc")
    assert result["provider_status"] == "live"
    assert result["overall_risk"] == "low"
    assert result["neo4j_degraded"] is False


def test_wallet_risk_high_risk(monkeypatch):
    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResponse(200, {"risk_score": 0.9, "overall_risk": "high", "mixer_adjacent": True, "laundering_cluster": False}),
    )
    result = beeceptor_provider.check_wallet_risk("0xba00000000000000000000000000000000000001")
    assert result["overall_risk"] == "high"
    assert result["mixer_adjacent"] is True


def test_wallet_risk_timeout_is_degraded(monkeypatch):
    def _raise_timeout(*a, **k):
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "post", _raise_timeout)
    result = beeceptor_provider.check_wallet_risk("0xabc")
    assert result["provider_status"] == "degraded"
    assert result["neo4j_degraded"] is True
    assert result["overall_risk"] == "unknown"


def test_wallet_risk_invalid_overall_risk_value_becomes_unknown(monkeypatch):
    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResponse(200, {"risk_score": 0.5, "overall_risk": "not-a-real-level"}),
    )
    result = beeceptor_provider.check_wallet_risk("0xabc")
    assert result["provider_status"] == "live"
    assert result["overall_risk"] == "unknown"
