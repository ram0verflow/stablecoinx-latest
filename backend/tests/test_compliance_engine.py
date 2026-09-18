from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services.compliance import compliance_engine


def _payment(sender: str, receiver: str):
    return SimpleNamespace(sender_company=sender, receiver_company=receiver)


@pytest.fixture(autouse=True)
def _default_to_local_provider(monkeypatch):
    """Pin the provider explicitly rather than relying on whatever
    COMPLIANCE_PROVIDER happens to be set to in the ambient .env — these
    tests exercise the local deterministic path specifically. Tests that
    want the Beeceptor path override this themselves."""
    monkeypatch.setattr(settings, "COMPLIANCE_PROVIDER", "local")


def test_sanctions_hit_blocks_payment():
    p = _payment("Zephyr Holdings LLC", "Clean Receiver")
    result = compliance_engine.run_compliance_checks(p)
    assert result["sanctions_hit"] is True
    assert result["overall"] == "fail"


def test_kyc_expired_fails(monkeypatch):
    def fake_kyc(_company):
        return {"kyc_status": "missing", "expiry_date": "2020-01-01T00:00:00Z", "days_until_expiry": 0}

    monkeypatch.setattr(compliance_engine, "check_kyc_status", fake_kyc)
    p = _payment("Sender", "Receiver")
    result = compliance_engine.run_compliance_checks(p)
    assert result["kyc_status"] == "missing"
    assert result["overall"] == "fail"


def test_clean_company_passes():
    p = _payment("Verified Sender", "Verified Receiver")
    result = compliance_engine.run_compliance_checks(p)
    assert result["sanctions_hit"] is False
    assert result["internal_blacklist_hit"] is False
    assert result["overall"] == "pass"


def test_internal_blacklist_hit():
    p = _payment("FraudCorp Holdings", "Clean Receiver")
    result = compliance_engine.run_compliance_checks(p)
    assert result["internal_blacklist_hit"] is True
    assert result["overall"] == "fail"


def test_local_provider_is_labeled(monkeypatch):
    monkeypatch.setattr(settings, "COMPLIANCE_PROVIDER", "local")
    p = _payment("Verified Sender", "Verified Receiver")
    result = compliance_engine.run_compliance_checks(p)
    assert result["provider_name"] == "local_deterministic"
    assert result["provider_status"] == "simulated"


def test_dispatches_to_beeceptor_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "COMPLIANCE_PROVIDER", "beeceptor")

    called = {}

    def fake_screen(**kwargs):
        called.update(kwargs)
        return {"provider_name": "beeceptor", "provider_status": "live", "overall": "pass"}

    monkeypatch.setattr(compliance_engine.beeceptor_provider, "screen", fake_screen)
    p = _payment("Acme", "Zenith")
    result = compliance_engine.run_compliance_checks(p)
    assert result["provider_name"] == "beeceptor"
    assert called["sender_company"] == "Acme"
    assert called["receiver_company"] == "Zenith"
