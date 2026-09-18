from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.models.approvals import Approval, ApprovalAction
from app.models.compliance_decisions import ComplianceDecision, FinalDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.services.blockchain.execution_orchestrator import ExecutionError, ExecutionOrchestrator


def _make_payment(db_session, test_user, amount: float = 1000):
    payment = PaymentIntent(
        id=uuid4(),
        sender_company="Sender",
        receiver_company="Receiver",
        source_country="SG",
        destination_country="UAE",
        source_chain="Base Sepolia",
        destination_chain="Base Sepolia",
        amount=amount,
        token="USDC",
        purpose="Payroll",
        status=PaymentStatus.pending,
        created_by=test_user.id,
    )
    db_session.add(payment)
    db_session.commit()
    return payment


def _make_decision(db_session, payment_id, policy_version="v1"):
    decision = ComplianceDecision(
        id=uuid4(),
        payment_id=payment_id,
        final_decision=FinalDecision.approved,
        policy_version=policy_version,
    )
    db_session.add(decision)
    db_session.commit()
    return decision


@pytest.mark.asyncio
async def test_execution_blocked_without_approval(db_session, test_user):
    payment = _make_payment(db_session, test_user)
    _make_decision(db_session, payment.id, policy_version="v1")
    orch = ExecutionOrchestrator(db_session)
    with pytest.raises(ExecutionError):
        await orch.execute_settlement(payment.id)


@pytest.mark.asyncio
async def test_execution_blocked_wrong_policy_version(db_session, test_user, monkeypatch):
    payment = _make_payment(db_session, test_user)
    _make_decision(db_session, payment.id, policy_version="old")
    db_session.add(
        Approval(
            id=uuid4(),
            payment_id=payment.id,
            reviewer_id=test_user.id,
            action=ApprovalAction.approve,
        )
    )
    db_session.commit()
    monkeypatch.setattr(
        "app.services.blockchain.execution_orchestrator.get_current_policy_version",
        lambda _db: "new",
    )

    orch = ExecutionOrchestrator(db_session)
    with pytest.raises(ExecutionError):
        await orch.execute_settlement(payment.id)


@pytest.mark.asyncio
async def test_execution_succeeds_with_valid_approval(db_session, test_user, monkeypatch):
    payment = _make_payment(db_session, test_user)
    _make_decision(db_session, payment.id, policy_version="v1")
    db_session.add(
        Approval(
            id=uuid4(),
            payment_id=payment.id,
            reviewer_id=test_user.id,
            action=ApprovalAction.approve,
        )
    )
    db_session.commit()

    async def _auth(*_args, **_kwargs):
        return True, "0xauth"

    async def _transfer(*_args, **_kwargs):
        return "0x" + "a" * 64, 123

    async def _monitor(*_args, **_kwargs):
        return True, None

    async def _proof(*_args, **_kwargs):
        return "0x" + "b" * 64

    async def _notify(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.blockchain.execution_orchestrator.get_current_policy_version",
        lambda _db: "v1",
    )
    monkeypatch.setattr(ExecutionOrchestrator, "_choose_web3", lambda self: object())
    monkeypatch.setattr(ExecutionOrchestrator, "load_contract_authorization", _auth)
    monkeypatch.setattr(ExecutionOrchestrator, "execute_token_transfer", _transfer)
    monkeypatch.setattr(ExecutionOrchestrator, "monitor_transaction", _monitor)
    monkeypatch.setattr(ExecutionOrchestrator, "register_settlement_proof", _proof)
    monkeypatch.setattr(ExecutionOrchestrator, "send_notifications", _notify)

    orch = ExecutionOrchestrator(db_session)
    out = await orch.execute_settlement(payment.id)
    assert out["status"] == "executed"
    assert out["tx_hash"].startswith("0x")


@pytest.mark.asyncio
async def test_settlement_proof_registered_on_chain(db_session, test_user, monkeypatch):
    payment = _make_payment(db_session, test_user)
    _make_decision(db_session, payment.id, policy_version="v1")
    db_session.add(
        Approval(
            id=uuid4(),
            payment_id=payment.id,
            reviewer_id=test_user.id,
            action=ApprovalAction.approve,
        )
    )
    db_session.commit()

    called = {"proof": False}

    async def _auth(*_args, **_kwargs):
        return True, None

    async def _transfer(*_args, **_kwargs):
        return "0x" + "c" * 64, 888

    async def _monitor(*_args, **_kwargs):
        return True, None

    async def _proof(*_args, **_kwargs):
        called["proof"] = True
        return "0x" + "d" * 64

    async def _notify(*_args, **_kwargs):
        return None

    monkeypatch.setattr(
        "app.services.blockchain.execution_orchestrator.get_current_policy_version",
        lambda _db: "v1",
    )
    monkeypatch.setattr(ExecutionOrchestrator, "_choose_web3", lambda self: object())
    monkeypatch.setattr(ExecutionOrchestrator, "load_contract_authorization", _auth)
    monkeypatch.setattr(ExecutionOrchestrator, "execute_token_transfer", _transfer)
    monkeypatch.setattr(ExecutionOrchestrator, "monitor_transaction", _monitor)
    monkeypatch.setattr(ExecutionOrchestrator, "register_settlement_proof", _proof)
    monkeypatch.setattr(ExecutionOrchestrator, "send_notifications", _notify)

    orch = ExecutionOrchestrator(db_session)
    await orch.execute_settlement(payment.id)
    assert called["proof"] is True
