from types import SimpleNamespace

from app.services.compliance import compliance_engine


def _payment(sender: str, receiver: str):
    return SimpleNamespace(sender_company=sender, receiver_company=receiver)


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
