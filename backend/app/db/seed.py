from __future__ import annotations

import uuid
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.security import get_password_hash
from app.db.database import SessionLocal
from app.models.alerts import Alert, AlertType
from app.models.approvals import Approval, ApprovalAction
from app.models.audit_records import AuditRecord
from app.models.compliance_decisions import AIDecisionType, ComplianceDecision, FinalDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.policy_rules import PolicyRule
from app.models.revalidation_records import RevalidationRecord, RevalidationStatus
from app.models.users import User, UserRole


def _ai_reasoning(seed: str) -> str:
    base = (
        "The orchestration engine evaluated corridor policy, sanctions posture, wallet graph proximity, issuer "
        "stability, chain governance, and route liquidity. We weighted deterministic controls above model preference, "
        "then compared confidence bands across alternate actions. The payment context indicates structured business "
        "intent, but controls still require strict provenance, bounded exposure, and audit-grade traceability. "
        "The model therefore explains risk in layered form: jurisdictional permissibility first, entity hygiene "
        "second, wallet behavior third, and operational resilience fourth. Where indicators remain clean, direct "
        "execution is favored for lower friction and lower settlement latency. Where indicators are mixed, the "
        "engine recommends escalation, split execution, or alternate chain routing to reduce concentration and "
        "bridge risk. Final output honors policy veto, human-approval thresholds, and privacy-preserving checks. "
    )
    words = (base + f"Scenario marker {seed}. ").split()
    # Expand to ~300 words deterministically
    while len(words) < 300:
        words.extend(words[:40])
    return " ".join(words[:300])


def _fhe_result(overall_pass: bool) -> dict:
    return {
        "overall_pass": overall_pass,
        "method": "fhe_simulated",
        "fhe_available": False,
        "checks": [
            {
                "check_id": str(uuid.uuid4()),
                "check_label": "daily_limit_check",
                "threshold": 500000,
                "result": False,
                "method": "fhe_simulated",
                "encrypted_proof": "fhe-proof-a1",
            },
            {
                "check_id": str(uuid.uuid4()),
                "check_label": "dual_approval_check",
                "threshold": 100000,
                "result": False,
                "method": "fhe_simulated",
                "encrypted_proof": "fhe-proof-b2",
            },
            {
                "check_id": str(uuid.uuid4()),
                "check_label": "reporting_check",
                "threshold": 10000,
                "result": True,
                "method": "fhe_simulated",
                "encrypted_proof": "fhe-proof-c3",
            },
        ],
    }


def _zk_ref(payment_id: uuid.UUID, marker: str) -> str:
    payload = {
        "bundle_id": str(uuid.uuid4()),
        "payment_id": str(payment_id),
        "combined_proof_hash": (marker * 64)[:64],
        "proof_method": "zk_simulated",
        "is_valid": True,
    }
    return json.dumps(payload)


def _seed_users(db) -> dict[str, User]:
    users = {
        "admin": User(
            id=uuid.uuid4(),
            email="admin@test.com",
            hashed_password=get_password_hash("hackathon123"),
            full_name="Admin User",
            role=UserRole.admin,
            is_active=True,
        ),
        "treasury": User(
            id=uuid.uuid4(),
            email="treasury@test.com",
            hashed_password=get_password_hash("hackathon123"),
            full_name="Treasury Officer",
            role=UserRole.treasury_officer,
            is_active=True,
        ),
        "compliance": User(
            id=uuid.uuid4(),
            email="compliance@test.com",
            hashed_password=get_password_hash("hackathon123"),
            full_name="Compliance Officer",
            role=UserRole.compliance_officer,
            is_active=True,
        ),
        "auditor": User(
            id=uuid.uuid4(),
            email="auditor@test.com",
            hashed_password=get_password_hash("hackathon123"),
            full_name="Auditor User",
            role=UserRole.auditor,
            is_active=True,
        ),
        "reviewer": User(
            id=uuid.uuid4(),
            email="reviewer@test.com",
            hashed_password=get_password_hash("hackathon123"),
            full_name="Reviewer User",
            role=UserRole.reviewer,
            is_active=True,
        ),
    }
    db.add_all(users.values())
    db.commit()
    return users


def _seed_policy_rules(db) -> None:
    pairs = [
        ("SG", "UAE", True, 10000),
        ("SG", "USA", True, 10000),
        ("UK", "UAE", True, 15000),
        ("USA", "Russia", False, 0),
        ("USA", "Iran", False, 0),
        ("SG", "India", True, 5000),
        ("UAE", "India", True, 5000),
        ("Germany", "UAE", True, 12000),
        ("USA", "UK", True, 50000),
        ("UK", "USA", True, 50000),
        ("Singapore", "Hong Kong", True, 20000),
        ("Hong Kong", "Singapore", True, 20000),
        ("USA", "North Korea", False, 0),
        ("UK", "Russia", False, 0),
        ("UAE", "Egypt", True, 10000),
        ("Egypt", "UAE", True, 10000),
        ("Japan", "USA", True, 30000),
        ("USA", "Japan", True, 30000),
        ("South Korea", "Japan", True, 15000),
        ("Japan", "South Korea", True, 15000),
    ]
    rows = []
    for src, dst, allowed, threshold in pairs:
        rows.append(
            PolicyRule(
                id=uuid.uuid4(),
                source_country=src,
                destination_country=dst,
                is_allowed=allowed,
                requires_kyc=True,
                requires_travel_rule=True,
                reporting_threshold=Decimal(threshold),
                kyc_expiry_days=365 if allowed else 0,
                notes=f"Seeded policy for {src}->{dst}",
                version_hash=f"policy-{src}-{dst}",
            )
        )
    db.add_all(rows)
    db.commit()


def seed_db():
    db = SessionLocal()
    try:
        if db.query(User).count() > 0:
            print("Database already seeded.")
            return

        users = _seed_users(db)
        _seed_policy_rules(db)

        now = datetime.now(timezone.utc)
        payments_data = [
            # 1
            ("SG Payroll Corp", "UAE Staffing LLC", "SG", "UAE", Decimal("45000"), "USDC", "Payroll", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            # 2
            ("SG Treasury Pte", "US Treasury Ops Inc", "SG", "USA", Decimal("250000"), "USDC", "Treasury Transfer", PaymentStatus.under_review, "Base Sepolia", "Base Sepolia", "manual_review", FinalDecision.pending_review),
            # 3
            ("UK Supplier Hub", "UAE Industrial Buyer", "UK", "UAE", Decimal("12000"), "USDT", "Supplier Payment", PaymentStatus.approved, "Base Sepolia", "Polygon Amoy", "alternate_chain", FinalDecision.approved),
            # 4
            ("USA Export Co", "Russia Components LLC", "USA", "Russia", Decimal("8000"), "USDC", "Supplier Payment", PaymentStatus.blocked, "Base Sepolia", "Base Sepolia", "block", FinalDecision.blocked),
            # 5
            ("SG Payroll Services", "India Talent Pvt", "SG", "India", Decimal("9500"), "USDC", "Payroll", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            # 6
            ("UAE Procurement Co", "India Supplier Park", "UAE", "India", Decimal("75000"), "USDC", "Supplier Payment", PaymentStatus.under_review, "Base Sepolia", "Base Sepolia", "manual_review", FinalDecision.pending_review),
            # 7
            ("Germany Treasury GmbH", "UAE Capital Desk", "Germany", "UAE", Decimal("180000"), "USDC", "Treasury Transfer", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            # 8
            ("USA Risk Sender", "Iran Counterparty", "USA", "Iran", Decimal("4000"), "USDC", "Supplier Payment", PaymentStatus.blocked, "Base Sepolia", "Base Sepolia", "block", FinalDecision.blocked),
            # 9
            ("SG FastPay", "UAE Merchant", "SG", "UAE", Decimal("500"), "USDC", "Supplier Payment", PaymentStatus.approved, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            # 10
            ("SG Mega Treasury", "USA Prime Capital", "SG", "USA", Decimal("1000000"), "USDC", "Treasury Transfer", PaymentStatus.under_review, "Base Sepolia", "Polygon Amoy", "split_payment", FinalDecision.pending_review),
        ]

        payments: list[PaymentIntent] = []
        for i, (sender, receiver, src, dst, amount, token, purpose, status, src_chain, dst_chain, ai_decision, final_decision) in enumerate(payments_data, start=1):
            payment = PaymentIntent(
                id=uuid.uuid4(),
                sender_company=sender,
                receiver_company=receiver,
                source_country=src,
                destination_country=dst,
                source_chain=src_chain,
                destination_chain=dst_chain,
                amount=amount,
                token=token,
                purpose=purpose,
                status=status,
                created_by=users["admin"].id,
                sender_wallet=f"0x{i:040x}",
                receiver_wallet=f"0x{i+100:040x}",
                created_at=now - timedelta(days=max(0, 10 - i)),
                updated_at=now - timedelta(hours=max(1, i)),
                executed_at=(now - timedelta(hours=i)) if status == PaymentStatus.executed else None,
            )
            payments.append(payment)
        db.add_all(payments)
        db.commit()

        decisions: list[ComplianceDecision] = []
        alerts: list[Alert] = []
        audits: list[AuditRecord] = []
        approvals: list[Approval] = []

        for idx, payment in enumerate(payments, start=1):
            ai_decision = payments_data[idx - 1][10]
            final_decision = payments_data[idx - 1][11]
            decision = ComplianceDecision(
                id=uuid.uuid4(),
                payment_id=payment.id,
                country_policy_result={
                    "is_allowed": payment.status != PaymentStatus.blocked,
                    "allowed": payment.status != PaymentStatus.blocked,
                    "policy_version": "demo-policy-v9",
                    "notes": f"Corridor {payment.source_country}->{payment.destination_country} evaluated",
                    "exceeds_reporting_threshold": float(payment.amount) > 10000,
                },
                wallet_risk_result={
                    "risk_score": 0.15 if idx in [1, 5, 9] else 0.74 if idx in [6, 10] else 0.92 if idx in [4, 8] else 0.4,
                    "overall_risk": "low" if idx in [1, 5, 9] else "high" if idx in [6, 10] else "critical" if idx in [4, 8] else "medium",
                    "mixer_adjacent": idx in [6, 10],
                },
                issuer_risk_result={"token": payment.token, "risk_level": "low" if payment.token == "USDC" else "medium"},
                chain_governance_result={"allowed": True, "bridge_trust_score": 0.87, "selected_chain": payment.destination_chain},
                liquidity_result={"recommended_route": "direct" if ai_decision == "direct_transfer" else ai_decision, "estimated_cost_usd": 0.43},
                ai_decision=AIDecisionType(ai_decision),
                ai_reasoning=_ai_reasoning(str(payment.id)[:8]),
                ai_confidence="0.94" if payment.status in [PaymentStatus.approved, PaymentStatus.executed] else "0.88",
                ai_flags={"sanctions_hit": idx in [4, 8], "high_amount": float(payment.amount) >= 250000},
                ai_alternatives=["manual_review", "alternate_chain"],
                ai_engine_used="ollama" if idx % 2 else "groq",
                ai_prompt_tokens="1240",
                ai_latency_ms=str(820 + idx * 37),
                ai_risk_summary="Seeded demonstration risk synthesis",
                fhe_check_result=_fhe_result(payment.status != PaymentStatus.blocked),
                zk_proof_reference=_zk_ref(payment.id, hex((idx % 15) + 1)[2:]),
                policy_version="demo-policy-v9",
                final_decision=final_decision,
                created_at=payment.created_at + timedelta(minutes=3),
            )
            decisions.append(decision)

            if payment.status in [PaymentStatus.approved, PaymentStatus.executed]:
                alerts.append(
                    Alert(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        alert_type=AlertType.approved,
                        message=f"Payment approved for {payment.source_country}->{payment.destination_country}",
                        is_read=True,
                        created_at=payment.updated_at,
                    )
                )
            if payment.status == PaymentStatus.blocked:
                alerts.append(
                    Alert(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        alert_type=AlertType.blocked,
                        message=f"Payment blocked for {payment.source_country}->{payment.destination_country}",
                        is_read=False,
                        created_at=payment.updated_at,
                    )
                )
            if payment.status in [PaymentStatus.under_review, PaymentStatus.revalidation]:
                alerts.append(
                    Alert(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        alert_type=AlertType.review_needed,
                        message=f"Manual approval required for {payment.source_country}->{payment.destination_country}",
                        is_read=False,
                        created_at=payment.updated_at,
                    )
                )
            if payment.status == PaymentStatus.executed:
                tx_hash = "0x" + f"{idx:x}" * 64
                proof_hash = "0x" + f"{(idx+1):x}" * 64
                alerts.append(
                    Alert(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        alert_type=AlertType.settlement_executed,
                        message=f"Settlement executed on Base Sepolia: {tx_hash[:14]}...",
                        is_read=True,
                        created_at=payment.executed_at or now,
                    )
                )
                audits.append(
                    AuditRecord(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        tx_hash=tx_hash[:66],
                        on_chain_proof_hash=proof_hash[:66],
                        report_path=json.dumps({
                            "block_number": 8600000 + idx,
                            "chain": "Base Sepolia",
                            "tx_hash": tx_hash[:66],
                            "proof_tx_hash": proof_hash[:66]
                        }),
                        zk_proof_reference=proof_hash[:66],
                        created_at=payment.executed_at or now,
                    )
                )

            if payment.status in [PaymentStatus.under_review, PaymentStatus.executed]:
                approvals.append(
                    Approval(
                        id=uuid.uuid4(),
                        payment_id=payment.id,
                        reviewer_id=users["treasury"].id,
                        action=ApprovalAction.approve if payment.status == PaymentStatus.executed else ApprovalAction.escalate,
                        notes="Seeded approval trail",
                        created_at=payment.updated_at,
                    )
                )
                if float(payment.amount) >= 100000 and payment.status == PaymentStatus.executed:
                    approvals.append(
                        Approval(
                            id=uuid.uuid4(),
                            payment_id=payment.id,
                            reviewer_id=users["admin"].id,
                            action=ApprovalAction.approve,
                            notes="Second signer for dual-approval threshold",
                            created_at=payment.updated_at + timedelta(minutes=2),
                        )
                    )

        db.add_all(decisions)
        db.add_all(alerts)
        db.add_all(audits)
        db.add_all(approvals)

        db.add(
            RevalidationRecord(
                id=uuid.uuid4(),
                payment_id=payments[0].id,
                trigger_reason="Sanctions list update triggered retrospective check",
                original_decision="approved",
                new_decision="pending_review",
                new_risk_score=Decimal("71.50"),
                status=RevalidationStatus.completed,
                created_at=now - timedelta(hours=2),
            )
        )
        db.add(
            Alert(
                id=uuid.uuid4(),
                payment_id=payments[0].id,
                alert_type=AlertType.revalidation_triggered,
                message="Historical payment flagged by sanctions update revalidation",
                is_read=False,
                created_at=now - timedelta(hours=2),
            )
        )
        db.commit()

        print("Demo dataset seeded: users, payments, decisions, approvals, alerts, audits, revalidation.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
