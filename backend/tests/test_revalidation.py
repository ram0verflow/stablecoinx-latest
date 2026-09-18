from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models.compliance_decisions import ComplianceDecision, FinalDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.revalidation_records import RevalidationRecord, RevalidationStatus
from app.services.revalidation_engine import RevalidationEngine


def _seed_executed_payment(db_session, test_user):
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Sender",
        receiver_company="Receiver",
        source_country="SG",
        destination_country="UAE",
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
        amount=1500,
        token="USDC",
        purpose="Payroll",
        status=PaymentStatus.executed,
        created_by=test_user.id,
        created_at=datetime.now(timezone.utc) - timedelta(days=10),
    )
    db_session.add(payment)
    db_session.flush()
    db_session.add(
        ComplianceDecision(
            id=uuid4(),
            payment_id=payment.id,
            final_decision=FinalDecision.approved,
            ai_flags={"sanctions_hit": False},
        )
    )
    db_session.commit()
    return payment


@pytest.mark.asyncio
async def test_sanctions_update_flags_past_payment(db_session, test_user, monkeypatch):
    payment = _seed_executed_payment(db_session, test_user)
    monkeypatch.setattr(
        "app.services.revalidation_engine.run_compliance_checks",
        lambda _payment: {"sanctions_hit": True},
    )
    async def _alert(*_args, **_kwargs):
        return True

    monkeypatch.setattr("app.services.revalidation_engine.AlertService.send_payment_alert", _alert)
    count = await RevalidationEngine.trigger_sanctions_update_revalidation(db_session)
    assert count >= 1

    row = db_session.query(RevalidationRecord).filter(RevalidationRecord.payment_id == payment.id).first()
    assert row is not None


def test_rescore_returns_new_decision(db_session, test_user, monkeypatch):
    payment = _seed_executed_payment(db_session, test_user)
    monkeypatch.setattr(
        "app.services.revalidation_engine.check_corridor",
        lambda *args, **kwargs: {"is_allowed": False, "allowed": False},
    )
    monkeypatch.setattr(
        "app.services.revalidation_engine.run_compliance_checks",
        lambda *_args, **_kwargs: {"sanctions_hit": False, "internal_blacklist_hit": False, "passed": True},
    )
    monkeypatch.setattr(
        "app.services.revalidation_engine.analyze_wallet",
        lambda *_args, **_kwargs: {"risk_score": 0.1, "overall_risk": "low"},
    )
    monkeypatch.setattr("app.services.revalidation_engine.get_issuer_risk", lambda *_: {"risk_level": "low"})
    monkeypatch.setattr("app.services.revalidation_engine.check_chain", lambda *_: {"allowed": True})
    monkeypatch.setattr("app.services.revalidation_engine.compute_best_route", lambda *_: {"recommended_route": "direct"})
    monkeypatch.setattr("app.services.revalidation_engine.get_ai_decision", lambda *_: {"decision": "direct_transfer"})

    out = RevalidationEngine.rescore_payment(db_session, payment.id)
    assert "new_decision" in out


@pytest.mark.asyncio
async def test_batch_processing_handles_50_payments(db_session, test_user, monkeypatch):
    ids = []
    for _ in range(50):
        p = _seed_executed_payment(db_session, test_user)
        r = RevalidationRecord(
            id=uuid4(),
            payment_id=p.id,
            trigger_reason="policy update",
            original_decision="approved",
            status=RevalidationStatus.pending,
        )
        db_session.add(r)
        ids.append(r.id)
    db_session.commit()

    monkeypatch.setattr(
        "app.services.revalidation_engine.RevalidationEngine.rescore_payment",
        lambda *_args, **_kwargs: {
            "new_decision": "pending_review",
            "risk_delta": 0.5,
            "changed": True,
        },
    )
    out = await RevalidationEngine.process_revalidation_batch(db_session, ids)
    assert out["total_processed"] == 50
