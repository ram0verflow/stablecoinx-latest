from uuid import uuid4

import pytest

from app.models.compliance_decisions import ComplianceDecision, FinalDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.services.payment_pipeline import run_payment_pipeline


def _payment(db_session, test_user, sender="Sender", receiver="Receiver"):
    p = PaymentIntent(
        id=uuid4(),
        sender_company=sender,
        receiver_company=receiver,
        source_country="SG",
        destination_country="UAE",
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
        amount=5000,
        token="USDC",
        purpose="Payroll",
        status=PaymentStatus.pending,
        created_by=test_user.id,
    )
    db_session.add(p)
    db_session.commit()
    return p


@pytest.mark.asyncio
async def test_complete_payment_flow_approved(db_session, test_user, monkeypatch):
    payment = _payment(db_session, test_user)

    monkeypatch.setattr("app.services.payment_pipeline.check_corridor", lambda *_: {"is_allowed": True, "policy_version": "v1"})
    monkeypatch.setattr("app.services.payment_pipeline.check_treasury_controls", lambda *_: {"dual_approval_required": False})
    monkeypatch.setattr(
        "app.services.payment_pipeline.run_compliance_checks",
        lambda *_: {"sanctions_hit": False, "internal_blacklist_hit": False, "kyc_status": "verified"},
    )
    monkeypatch.setattr("app.services.payment_pipeline.analyze_wallet", lambda *_: {"risk_score": 0.1, "overall_risk": "low"})
    monkeypatch.setattr("app.services.payment_pipeline.get_issuer_risk", lambda *_: {"risk_level": "low"})
    monkeypatch.setattr("app.services.payment_pipeline.check_chain", lambda *_: {"allowed": True})
    monkeypatch.setattr("app.services.payment_pipeline.compute_best_route", lambda *_: {"recommended_route": "direct"})
    monkeypatch.setattr(
        "app.services.payment_pipeline.get_ai_decision",
        lambda *_: {
            "decision": "direct_transfer",
            "confidence": 0.99,
            "reasoning": "ok",
            "flags": [],
            "alternative_options": [],
            "meta": {"engine": "groq", "tokens": 1, "latency_ms": 1},
        },
    )
    monkeypatch.setattr("app.services.payment_pipeline.apply_veto", lambda *_: FinalDecision.approved)
    monkeypatch.setattr("app.services.payment_pipeline.run_all_fhe_checks", lambda *_: {"overall_pass": True, "checks": []})
    monkeypatch.setattr(
        "app.services.payment_pipeline.generate_combined_proof",
        lambda *_args, **_kwargs: {"combined_proof_hash": "a" * 64, "is_valid": True},
    )
    async def _alert(*_args, **_kwargs):
        return True
    monkeypatch.setattr("app.services.payment_pipeline.AlertService.send_payment_alert", _alert)

    await run_payment_pipeline(db_session, payment.id)

    updated = db_session.query(PaymentIntent).filter(PaymentIntent.id == payment.id).first()
    assert updated.status == PaymentStatus.approved
    decision = db_session.query(ComplianceDecision).filter(ComplianceDecision.payment_id == payment.id).first()
    assert decision is not None


@pytest.mark.asyncio
async def test_complete_payment_flow_blocked(db_session, test_user, monkeypatch):
    payment = _payment(db_session, test_user, sender="Zephyr Holdings LLC", receiver="Receiver")

    monkeypatch.setattr("app.services.payment_pipeline.check_corridor", lambda *_: {"is_allowed": True, "policy_version": "v1"})
    monkeypatch.setattr("app.services.payment_pipeline.check_treasury_controls", lambda *_: {"dual_approval_required": False})
    monkeypatch.setattr(
        "app.services.payment_pipeline.run_compliance_checks",
        lambda *_: {"sanctions_hit": True, "internal_blacklist_hit": False, "kyc_status": "verified"},
    )
    monkeypatch.setattr("app.services.payment_pipeline.analyze_wallet", lambda *_: {"risk_score": 0.1, "overall_risk": "low"})
    monkeypatch.setattr("app.services.payment_pipeline.get_issuer_risk", lambda *_: {"risk_level": "low"})
    monkeypatch.setattr("app.services.payment_pipeline.check_chain", lambda *_: {"allowed": True})
    monkeypatch.setattr("app.services.payment_pipeline.compute_best_route", lambda *_: {"recommended_route": "direct"})
    monkeypatch.setattr(
        "app.services.payment_pipeline.get_ai_decision",
        lambda *_: {
            "decision": "direct_transfer",
            "confidence": 0.99,
            "reasoning": "ok",
            "flags": [],
            "alternative_options": [],
            "meta": {"engine": "groq", "tokens": 1, "latency_ms": 1},
        },
    )
    monkeypatch.setattr("app.services.payment_pipeline.apply_veto", lambda *_: FinalDecision.blocked)
    monkeypatch.setattr("app.services.payment_pipeline.run_all_fhe_checks", lambda *_: {"overall_pass": True, "checks": []})
    monkeypatch.setattr(
        "app.services.payment_pipeline.generate_combined_proof",
        lambda *_args, **_kwargs: {"combined_proof_hash": "b" * 64, "is_valid": True},
    )
    async def _alert(*_args, **_kwargs):
        return True
    monkeypatch.setattr("app.services.payment_pipeline.AlertService.send_payment_alert", _alert)

    await run_payment_pipeline(db_session, payment.id)

    updated = db_session.query(PaymentIntent).filter(PaymentIntent.id == payment.id).first()
    assert updated.status == PaymentStatus.blocked
