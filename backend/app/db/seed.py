from __future__ import annotations

import json
import os
import uuid
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
from app.models.treasury_controls import TreasuryDepartmentBudget, ApprovedVendor
from app.models.treasury_policy import TreasuryPolicy
from app.models.issuer_profiles import IssuerProfile
from app.services.compliance.counterparty_risk_service import evaluate_counterparty
from app.services.compliance.provenance_service import analyze_provenance


def _ai_reasoning(seed: str) -> str:
    text = (
        "Engine evaluated corridor policy, sanctions, wallet risk, issuer profile, "
        "chain governance, and liquidity with policy-veto precedence. "
        f"Scenario marker {seed}."
    )
    return " ".join((text.split() * 40)[:300])


def _fhe_result(payment, db=None) -> dict:
    """Generate real FHE check results using the actual fhe_service."""
    try:
        from app.services.privacy.fhe_service import run_all_fhe_checks
        return run_all_fhe_checks(payment, db)
    except Exception:
        # Fallback to simulated if service unavailable
        return {
            "overall_pass": True,
            "method": "fhe_simulated",
            "fhe_available": False,
            "checks": [
                {"check_id": str(uuid.uuid4()), "check_label": "daily_limit_check", "threshold": 500000, "result": False, "method": "fhe_simulated", "encrypted_proof": "fhe-proof-a1"},
                {"check_id": str(uuid.uuid4()), "check_label": "dual_approval_check", "threshold": 100000, "result": False, "method": "fhe_simulated", "encrypted_proof": "fhe-proof-b2"},
                {"check_id": str(uuid.uuid4()), "check_label": "reporting_check", "threshold": 10000, "result": True, "method": "fhe_simulated", "encrypted_proof": "fhe-proof-c3"},
            ],
        }


def _zk_ref(payment_id: uuid.UUID, kyc_status: str = "verified", amount: float = 1000.0) -> str:
    """Generate real ZK proof bundle using the actual zk_service."""
    try:
        from app.services.privacy.zk_service import generate_combined_proof
        bundle = generate_combined_proof(
            payment_id=str(payment_id),
            kyc_result={"kyc_status": kyc_status, "company_name": "Seeded Company"},
            amount=amount,
            policy_range=(0.0, 500000.0),
            approval_id=None,
        )
        return json.dumps(bundle)
    except Exception:
        import hashlib
        h = hashlib.sha256(str(payment_id).encode()).hexdigest()
        return json.dumps({
            "bundle_id": str(uuid.uuid4()),
            "payment_id": str(payment_id),
            "combined_proof_hash": h,
            "proof_method": "zk_simulated",
            "is_valid": True,
        })


def _seed_users(db) -> dict[str, User]:
    users_cfg = [
        ("admin@settleguard.com", "Admin User", UserRole.admin, "admin"),
        ("treasury@settleguard.com", "Treasury Officer", UserRole.treasury_officer, "treasury"),
        ("compliance@settleguard.com", "Compliance Officer", UserRole.compliance_officer, "compliance"),
        ("auditor@settleguard.com", "Auditor User", UserRole.auditor, "auditor"),
        ("reviewer@settleguard.com", "Reviewer User", UserRole.reviewer, "reviewer"),
    ]
    users: dict[str, User] = {}
    for email, name, role, key in users_cfg:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            existing = User(
                id=uuid.uuid4(),
                email=email,
                hashed_password=get_password_hash("hackathon123"),
                full_name=name,
                role=role,
                is_active=True,
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)
        users[key] = existing
    return users


def _seed_policy_rules(db) -> None:
    pairs = [
        ("SG", "UAE", True, 10000), ("SG", "USA", True, 10000), ("UK", "UAE", True, 15000),
        ("USA", "Russia", False, 0), ("USA", "Iran", False, 0), ("SG", "India", True, 5000),
        ("UAE", "India", True, 5000), ("Germany", "UAE", True, 12000), ("USA", "UK", True, 50000),
        ("UK", "USA", True, 50000), ("Singapore", "Hong Kong", True, 20000), ("Hong Kong", "Singapore", True, 20000),
        ("USA", "North Korea", False, 0), ("UK", "Russia", False, 0), ("UAE", "Egypt", True, 10000),
        ("Egypt", "UAE", True, 10000), ("Japan", "USA", True, 30000), ("USA", "Japan", True, 30000),
        ("South Korea", "Japan", True, 15000), ("Japan", "South Korea", True, 15000),
    ]
    for src, dst, allowed, threshold in pairs:
        existing = db.query(PolicyRule).filter(
            PolicyRule.source_country == src,
            PolicyRule.destination_country == dst,
        ).first()
        if not existing:
            db.add(
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
            db.commit()


def _seed_treasury_controls(db) -> None:
    # FIXED: M5
    budgets = [
        ("payroll", 200000.0),
        ("supplier payment", 300000.0),
        ("treasury transfer", 1000000.0),
        ("cross-border settlement", 250000.0),
        ("__default__", 100000.0),
    ]
    for purpose_key, budget_limit in budgets:
        existing = db.query(TreasuryDepartmentBudget).filter(
            TreasuryDepartmentBudget.purpose_key == purpose_key
        ).first()
        if not existing:
            db.add(TreasuryDepartmentBudget(
                purpose_key=purpose_key,
                budget_limit=budget_limit,
                is_active=True,
            ))
            db.commit()

    vendors = [
        "TechNova Solutions",
        "Global Logistics Inc",
        "Apex Marketing",
        "Prime Materials",
        "Quantum Computing Corp",
    ]
    for vendor_name in vendors:
        existing = db.query(ApprovedVendor).filter(
            ApprovedVendor.vendor_name == vendor_name
        ).first()
        if not existing:
            db.add(ApprovedVendor(vendor_name=vendor_name, is_active=True))
            db.commit()


def _seed_treasury_policies(db) -> None:
    rows = [
        ("payroll", 200000.0, "USD", ["TechNova Solutions"]),
        ("supplier payment", 300000.0, "USD", None),
        ("treasury transfer", 1000000.0, "USD", None),
    ]
    now = datetime.now(timezone.utc)
    for dept, lim, cur, vendors in rows:
        existing = db.query(TreasuryPolicy).filter(TreasuryPolicy.department == dept).first()
        if not existing:
            db.add(
                TreasuryPolicy(
                    department=dept,
                    budget_limit=lim,
                    currency=cur,
                    vendor_allowlist=vendors,
                    is_active=True,
                    created_at=now,
                )
            )
            db.commit()


def _seed_issuer_profiles(db) -> None:
    defaults = [
        ("USDC", "USDC", "Circle", "US", False, "low", 0.01, "high", "deep", "high", "preferred", 0.95, "low"),
        ("USDT", "USDT", "Tether", "KY", False, "medium", 0.03, "medium", "deep", "medium", "acceptable", 0.78, "medium"),
        ("BUSD", "BUSD", "Paxos", "US", False, "low", 0.02, "high", "deep", "high", "preferred", 0.88, "low"),
        ("PYUSD", "PYUSD", "PayPal", "US", False, "low", 0.025, "medium", "deep", "medium", "acceptable", 0.82, "medium"),
    ]
    for (
        token,
        issuer_id,
        issuer,
        jurisdiction,
        is_sanctioned,
        freeze_risk,
        depeg,
        trust,
        depth,
        comfort,
        recommendation,
        score,
        risk_level,
    ) in defaults:
        existing = db.query(IssuerProfile).filter(IssuerProfile.token == token).first()
        if not existing:
            db.add(
                IssuerProfile(
                    token=token,
                    issuer_id=issuer_id,
                    issuer=issuer,
                    jurisdiction=jurisdiction,
                    is_sanctioned=is_sanctioned,
                    issuer_freeze_risk=freeze_risk,
                    depeg_risk_score=depeg,
                    redemption_trust=trust,
                    liquidity_depth=depth,
                    regulatory_comfort=comfort,
                    recommendation=recommendation,
                    score=score,
                    risk_level=risk_level,
                    is_active=True,
                )
            )
            db.commit()


_DEMO_TEAM_POLICIES = {
    "acme-treasury": (
        "Acme Treasury",
        """team: acme-treasury
version: 1
rules:
  - name: block-sanctioned-corridor
    description: Block payments into sanctioned jurisdictions regardless of amount
    priority: 100
    when:
      destination_country: [Iran, "North Korea", Russia]
    action: block

  - name: enhanced-review-large-usdt
    description: Escalate large USDT transfers for manual review
    priority: 50
    when:
      token: USDT
      amount_gt: 100000
    action: enhanced_review

  - name: flag-tron-settlement
    description: Flag any payment settling on Tron for extra scrutiny
    priority: 10
    when:
      chain_in: [Tron]
    action: enhanced_review
""",
    ),
    "nimbus-payments": (
        "Nimbus Payments",
        """team: nimbus-payments
version: 1
rules:
  - name: dual-approval-large-treasury
    description: Require dual approval on treasury transfers over 250k
    priority: 80
    when:
      purpose: "Treasury Transfer"
      amount_gt: 250000
    action: require_dual_approval

  - name: block-sanctioned-corridor
    description: Block payments into sanctioned jurisdictions
    priority: 100
    when:
      destination_country: [Iran, "North Korea"]
    action: block
""",
    ),
}


def _seed_teams(db) -> None:
    from app.models.team_policies import TeamPolicy
    from app.models.teams import Team

    for slug, (name, yaml_text) in _DEMO_TEAM_POLICIES.items():
        team = db.query(Team).filter(Team.slug == slug).first()
        if not team:
            team = Team(name=name, slug=slug)
            db.add(team)
            db.commit()
            db.refresh(team)

        policy = db.query(TeamPolicy).filter(TeamPolicy.team_id == team.id).first()
        if not policy:
            db.add(TeamPolicy(team_id=team.id, yaml_text=yaml_text, version=1))
            db.commit()


def seed_db():
    from app.core.config import settings

    if settings.APP_ENV not in ("demo", "development"):
        raise RuntimeError("Seed script only runs when APP_ENV is demo or development")
    db = SessionLocal()
    try:
        users = _seed_users(db)
        _seed_policy_rules(db)
        _seed_treasury_controls(db)
        _seed_treasury_policies(db)
        _seed_issuer_profiles(db)
        _seed_teams(db)
        now = datetime.now(timezone.utc)
        payments_data = [
            ("SG Payroll Corp", "UAE Staffing LLC", "SG", "UAE", Decimal("45000"), "USDC", "Payroll", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            ("SG Treasury Pte", "US Treasury Ops Inc", "SG", "USA", Decimal("250000"), "USDC", "Treasury Transfer", PaymentStatus.under_review, "Base Sepolia", "Base Sepolia", "manual_review", FinalDecision.pending_review),
            ("UK Supplier Hub", "UAE Industrial Buyer", "UK", "UAE", Decimal("12000"), "USDT", "Supplier Payment", PaymentStatus.approved, "Base Sepolia", "Base Sepolia", "alternate_chain", FinalDecision.approved),
            ("USA Export Co", "Russia Components LLC", "USA", "Russia", Decimal("8000"), "USDC", "Supplier Payment", PaymentStatus.blocked, "Base Sepolia", "Base Sepolia", "block", FinalDecision.blocked),
            ("SG Payroll Services", "India Talent Pvt", "SG", "India", Decimal("9500"), "USDC", "Payroll", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            ("UAE Procurement Co", "India Supplier Park", "UAE", "India", Decimal("75000"), "USDC", "Supplier Payment", PaymentStatus.approved, "Base Sepolia", "Tron", "alternate_chain", FinalDecision.approved),
            ("Germany Treasury GmbH", "UAE Capital Desk", "Germany", "UAE", Decimal("180000"), "USDC", "Treasury Transfer", PaymentStatus.executed, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            ("USA Risk Sender", "Iran Counterparty", "USA", "Iran", Decimal("4000"), "USDC", "Supplier Payment", PaymentStatus.blocked, "Base Sepolia", "Tron", "block", FinalDecision.blocked),
            ("SG FastPay", "UAE Merchant", "SG", "UAE", Decimal("500"), "USDC", "Supplier Payment", PaymentStatus.approved, "Base Sepolia", "Base Sepolia", "direct_transfer", FinalDecision.approved),
            ("SG Mega Treasury", "USA Prime Capital", "SG", "USA", Decimal("1000000"), "USDC", "Treasury Transfer", PaymentStatus.approved, "Tron", "Base Sepolia", "alternate_chain", FinalDecision.approved),
            ("UK Treasury Desk", "Meridian Capital Partners", "UK", "Switzerland", Decimal("92000"), "USDC", "Treasury Transfer", PaymentStatus.under_review, "Base Sepolia", "Ethereum Mainnet", "manual_review", FinalDecision.pending_review),
        ]

        # Every seeded payment carries REAL, live, verified wallet addresses
        # on its own declared chain (TronScan / Etherscan V2, not
        # fabricated) so every Mixer Signal panel in the product shows a
        # genuine, non-empty result — no payment is left pointing at a
        # placeholder 0x{i:040x} address that would score 0%/NONE.
        # Reused across payments deliberately: each address's real,
        # verified score (checked live before assignment) is what matters
        # for the demo, not one-address-per-company uniqueness.
        #   Tron A = TVt7oQuLnHZz252eaDFLbh66zHDGgksoSY  -> 100 HIGH (fan-out)
        #   Tron B = TRpXQyT3RLWKmxAGNU1bHGuzxB56Dr86Pu  -> 50 MEDIUM (fan-in)
        #   Base Sepolia C = 0xa6b711d174d92bc75b1619e978b2c24fccec08f4 -> 100 HIGH
        #   Base Sepolia D = 0xfef98a7526f6bc617ae9838b3a4a01e87e22a715 -> 65 HIGH
        #   Base Sepolia E = 0xbe0c634b0cd48da9ec5477c98a2359128b148463 -> 65 HIGH
        #   Base Sepolia F = 0xd407e409e34e0b9afb99ecceb609bdbcd5e7f1bf -> 65 HIGH
        _TRON_A = "TVt7oQuLnHZz252eaDFLbh66zHDGgksoSY"
        _TRON_B = "TRpXQyT3RLWKmxAGNU1bHGuzxB56Dr86Pu"
        _BASE_C = "0xa6b711d174d92bc75b1619e978b2c24fccec08f4"
        _BASE_D = "0xfef98a7526f6bc617ae9838b3a4a01e87e22a715"
        _BASE_E = "0xbe0c634b0cd48da9ec5477c98a2359128b148463"
        _BASE_F = "0xd407e409e34e0b9afb99ecceb609bdbcd5e7f1bf"

        REAL_WALLET_OVERRIDES = {
            1: {"sender_wallet": _BASE_D, "receiver_wallet": _BASE_E},
            2: {"sender_wallet": _BASE_F, "receiver_wallet": _BASE_C},
            3: {"sender_wallet": _BASE_D, "receiver_wallet": _BASE_F},
            4: {"sender_wallet": _BASE_E, "receiver_wallet": _BASE_D},
            5: {"sender_wallet": _BASE_C, "receiver_wallet": _BASE_F},
            6: {"sender_wallet": _BASE_E, "receiver_wallet": _TRON_B},
            7: {"sender_wallet": _BASE_D, "receiver_wallet": _BASE_C},
            8: {"sender_wallet": _BASE_C, "receiver_wallet": _TRON_A},
            9: {"sender_wallet": _BASE_F, "receiver_wallet": _BASE_E},
            10: {"sender_wallet": _TRON_A, "receiver_wallet": _BASE_D},
            11: {"sender_wallet": _BASE_C, "receiver_wallet": _BASE_D},
        }

        # Counterparty Intelligence overrides — three of these are the
        # headline demo journeys (good=6, medium=10, bad=8); the rest carry
        # coherent values so every seeded payment's counterparty card is
        # internally consistent with its existing status/final_decision
        # rather than showing "not configured" everywhere.
        WALLET_RISK_OVERRIDES = {
            1: (0.15, "low", False), 2: (0.40, "medium", False), 3: (0.15, "low", False),
            4: (0.92, "critical", False), 5: (0.15, "low", False), 6: (0.12, "low", False),
            7: (0.15, "low", False), 8: (0.92, "critical", True), 9: (0.15, "low", False),
            10: (0.40, "medium", True), 11: (0.30, "medium", False),
        }
        COUNTERPARTY_OVERRIDES = {
            1: dict(counterparty_type="vendor", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    route_type="direct", route_provider="Manual", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Same-chain settlement to a verified payroll vendor; full route evidence.",
                    sanctions_hit=False),
            2: dict(counterparty_type="treasury", counterparty_kyb_status="pending", counterparty_kyb_provider="beeceptor",
                    route_type="public_bridge", route_provider="Relay", source_wallet_visibility="partial",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="partial", route_provenance_confidence="medium",
                    route_evidence_notes="Treasury-to-treasury transfer via public bridge; KYB re-verification pending.",
                    sanctions_hit=False),
            3: dict(counterparty_type="vendor", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    route_type="direct", route_provider="Manual", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Verified UK-UAE trade counterparty, direct settlement.",
                    sanctions_hit=False),
            4: dict(counterparty_type="unknown", counterparty_kyb_status="missing", counterparty_kyb_provider="none",
                    route_type="private_relay", route_provider="Unknown", source_wallet_visibility="hidden",
                    origin_tx_visibility="missing", destination_tx_visibility="missing",
                    route_trace_completeness="opaque", route_provenance_confidence="low",
                    route_evidence_notes="Sanctioned corridor (Russia) — counterparty verification never attempted.",
                    sanctions_hit=True),
            5: dict(counterparty_type="vendor", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    route_type="direct", route_provider="Manual", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Verified payroll counterparty, full route evidence.",
                    sanctions_hit=False),
            # HEADLINE GOOD JOURNEY — verified liquidity provider, cross-chain
            # swap with complete route evidence, low wallet-risk signal.
            6: dict(counterparty_type="liquidity_provider", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    counterparty_attestation_id="ATT-IN-SUPPLY-2201",
                    route_type="chain_swap", route_provider="Relay", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Cross-chain settlement via Relay chain-swap; origin tx, destination tx, and quote reference all verified.",
                    sanctions_hit=False, provenance_fixture="good"),
            7: dict(counterparty_type="treasury", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    route_type="direct", route_provider="Manual", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Verified intercompany treasury desk, full route evidence.",
                    sanctions_hit=False),
            # HEADLINE BAD JOURNEY — unknown counterparty, failed/missing KYB,
            # opaque private-relay route, sanctioned corridor.
            8: dict(counterparty_type="unknown", counterparty_kyb_status="failed", counterparty_kyb_provider="none",
                    route_type="private_relay", route_provider="Unknown", source_wallet_visibility="hidden",
                    origin_tx_visibility="missing", destination_tx_visibility="missing",
                    route_trace_completeness="opaque", route_provenance_confidence="low",
                    route_evidence_notes="Source wallet hidden, relayer unknown, no quote/order id — only payout visible. Sanctioned corridor (Iran).",
                    sanctions_hit=True, provenance_fixture="bad"),
            9: dict(counterparty_type="vendor", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                    route_type="direct", route_provider="Manual", source_wallet_visibility="visible",
                    origin_tx_visibility="present", destination_tx_visibility="present",
                    route_trace_completeness="full", route_provenance_confidence="high",
                    route_evidence_notes="Small verified merchant settlement, full route evidence.",
                    sanctions_hit=False),
            # HEADLINE MEDIUM JOURNEY — opaque but not risky. 38% of inbound
            # funding traces to a mint, 44% dead-ends at an exchange omnibus,
            # 14% arrives via an intent-protocol solver fill. Custodial and
            # infrastructure opacity are not risk signals on their own —
            # this is the fixture that proves the tool knows opacity != risk.
            10: dict(counterparty_type="liquidity_provider", counterparty_kyb_status="pending", counterparty_kyb_provider="beeceptor",
                     route_type="relay", route_provider="Relay", source_wallet_visibility="partial",
                     origin_tx_visibility="missing", destination_tx_visibility="present",
                     route_trace_completeness="partial", route_provenance_confidence="medium",
                     route_evidence_notes="38% of inbound funding traces to a mint, 44% dead-ends at an exchange omnibus (reachable via Travel Rule), 14% arrives via a solver fill. Custodial/infra opacity is not a risk signal on its own.",
                     sanctions_hit=False, provenance_fixture="medium"),
            # HEADLINE DECEPTIVE JOURNEY — the acceptance-test case. Looks
            # clean on paper (KYB verified, raw terminal is a real mint) but
            # the funding path itself is a seven-hop disposable-wallet
            # layering chain. Proves the two-axis model actually gates on
            # path integrity, not just where the trail eventually ends.
            11: dict(counterparty_type="liquidity_provider", counterparty_kyb_status="verified", counterparty_kyb_provider="beeceptor",
                     route_type="chain_swap", route_provider="Relay", source_wallet_visibility="partial",
                     origin_tx_visibility="present", destination_tx_visibility="present",
                     route_trace_completeness="full", route_provenance_confidence="high",
                     route_evidence_notes="Raw terminal resolves to a real issuer mint at depth 8 — but the path there is a disposable-wallet layering chain. See Provenance & Path Integrity below.",
                     sanctions_hit=False, provenance_fixture="deceptive"),
        }

        seeded_payments: list[PaymentIntent] = []
        for i, (sender, receiver, src, dst, amount, token, purpose, status, src_chain, dst_chain, ai_decision, final_decision) in enumerate(payments_data, start=1):
            existing = db.query(PaymentIntent).filter(
                PaymentIntent.sender_company == sender,
                PaymentIntent.receiver_company == receiver,
                PaymentIntent.amount == amount,
                PaymentIntent.token == token,
                PaymentIntent.purpose == purpose,
            ).first()
            wallet_override = REAL_WALLET_OVERRIDES.get(i, {})
            sender_wallet = wallet_override.get("sender_wallet", f"0x{i:040x}")
            receiver_wallet = wallet_override.get("receiver_wallet", f"0x{i+100:040x}")
            cp = COUNTERPARTY_OVERRIDES.get(i, {})
            counterparty_fields = dict(
                counterparty_name=receiver,
                counterparty_type=cp.get("counterparty_type", "unknown"),
                counterparty_wallet_address=receiver_wallet,
                counterparty_chain=dst_chain,
                counterparty_kyb_status=cp.get("counterparty_kyb_status", "missing"),
                counterparty_kyb_provider=cp.get("counterparty_kyb_provider", "none"),
                counterparty_attestation_id=cp.get("counterparty_attestation_id"),
                route_type=cp.get("route_type", "unknown"),
                route_provider=cp.get("route_provider", "Unknown"),
                source_wallet_visibility=cp.get("source_wallet_visibility", "unknown"),
                origin_tx_visibility=cp.get("origin_tx_visibility", "missing"),
                destination_tx_visibility=cp.get("destination_tx_visibility", "missing"),
                route_trace_completeness=cp.get("route_trace_completeness", "opaque"),
                route_provenance_confidence=cp.get("route_provenance_confidence", "low"),
                route_evidence_notes=cp.get("route_evidence_notes"),
                provenance_fixture=cp.get("provenance_fixture"),
            )
            if not existing:
                existing = PaymentIntent(
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
                    sender_wallet=sender_wallet,
                    receiver_wallet=receiver_wallet,
                    created_at=now - timedelta(days=max(0, 10 - i)),
                    updated_at=now - timedelta(hours=max(1, i)),
                    executed_at=(now - timedelta(hours=i)) if status == PaymentStatus.executed else None,
                    **counterparty_fields,
                )
                db.add(existing)
                db.commit()
                db.refresh(existing)
            elif (
                existing.source_chain != src_chain
                or existing.destination_chain != dst_chain
                or existing.sender_wallet != sender_wallet
                or existing.receiver_wallet != receiver_wallet
                or existing.status != status
                or existing.counterparty_type != counterparty_fields["counterparty_type"]
                or existing.provenance_fixture != counterparty_fields["provenance_fixture"]
            ):
                # Backfill chain/wallet/counterparty corrections onto an
                # already-seeded row without touching its id or history.
                existing.source_chain = src_chain
                existing.destination_chain = dst_chain
                existing.sender_wallet = sender_wallet
                existing.receiver_wallet = receiver_wallet
                existing.status = status
                for field_name, value in counterparty_fields.items():
                    setattr(existing, field_name, value)
                db.commit()
                db.refresh(existing)
            seeded_payments.append(existing)

            wallet_risk_score, wallet_overall_risk, wallet_mixer_adjacent = WALLET_RISK_OVERRIDES.get(i, (0.4, "medium", False))
            wallet_risk_result = {"risk_score": wallet_risk_score, "overall_risk": wallet_overall_risk, "mixer_adjacent": wallet_mixer_adjacent}
            compliance_stub = {"sanctions_hit": cp.get("sanctions_hit", False), "internal_blacklist_hit": False}
            provenance_result = analyze_provenance(existing, wallet_risk_result, compliance_stub)
            counterparty_risk_result = evaluate_counterparty(existing, wallet_risk_result, compliance_stub, provenance_result)
            if provenance_result.get("available"):
                # Same write-back the live pipeline does — provenance
                # supersedes the manually-set route_* fields once available.
                existing.route_type = counterparty_risk_result["route_type"]
                existing.route_trace_completeness = counterparty_risk_result["route_trace_completeness"]
                existing.route_provenance_confidence = counterparty_risk_result["route_provenance_confidence"]
                db.commit()

            existing_decision = db.query(ComplianceDecision).filter(ComplianceDecision.payment_id == existing.id).first()
            if not existing_decision:
                db.add(
                    ComplianceDecision(
                        id=uuid.uuid4(),
                        payment_id=existing.id,
                        country_policy_result={"is_allowed": existing.status != PaymentStatus.blocked, "allowed": existing.status != PaymentStatus.blocked, "policy_version": "demo-policy-v9", "notes": f"Corridor {existing.source_country}->{existing.destination_country} evaluated", "exceeds_reporting_threshold": float(existing.amount) > 10000},
                        wallet_risk_result=wallet_risk_result,
                        counterparty_risk_result=counterparty_risk_result,
                        issuer_risk_result={"token": existing.token, "risk_level": "low" if existing.token == "USDC" else "medium"},
                        chain_governance_result={"allowed": True, "bridge_trust_score": 0.87, "selected_chain": existing.destination_chain},
                        liquidity_result={"recommended_route": "direct" if ai_decision == "direct_transfer" else ai_decision, "estimated_cost_usd": 0.43},
                        ai_decision=AIDecisionType(ai_decision),
                        ai_reasoning=_ai_reasoning(str(existing.id)[:8]),
                        ai_confidence="0.94" if existing.status in [PaymentStatus.approved, PaymentStatus.executed] else "0.88",
                        ai_flags={"sanctions_hit": i in [4, 8], "high_amount": float(existing.amount) >= 250000},
                        ai_alternatives=["manual_review", "alternate_chain"],
                        ai_engine_used="ollama" if i % 2 else "groq",
                        ai_prompt_tokens="1240",
                        ai_latency_ms=str(820 + i * 37),
                        ai_risk_summary="Seeded demonstration risk synthesis",
                        fhe_check_result=_fhe_result(existing, db),
                        zk_proof_reference=_zk_ref(existing.id, "verified" if existing.status != PaymentStatus.blocked else "missing", float(existing.amount)),
                        policy_version="demo-policy-v9",
                        final_decision=final_decision,
                        created_at=existing.created_at + timedelta(minutes=3),
                    )
                )
                db.commit()

            existing_approval = db.query(Approval).filter(Approval.payment_id == existing.id).first()
            if not existing_approval and existing.status in [PaymentStatus.under_review, PaymentStatus.executed]:
                db.add(
                    Approval(
                        id=uuid.uuid4(),
                        payment_id=existing.id,
                        reviewer_id=users["treasury"].id,
                        action=ApprovalAction.approve if existing.status == PaymentStatus.executed else ApprovalAction.escalate,
                        notes="Seeded approval trail",
                        created_at=existing.updated_at,
                    )
                )
                db.commit()

            existing_alert = db.query(Alert).filter(Alert.payment_id == existing.id).first()
            if not existing_alert:
                alert_type = AlertType.review_needed
                msg = f"Manual approval required for {existing.source_country}->{existing.destination_country}"
                if existing.status in [PaymentStatus.approved, PaymentStatus.executed]:
                    alert_type = AlertType.approved
                    msg = f"Payment approved for {existing.source_country}->{existing.destination_country}"
                elif existing.status == PaymentStatus.blocked:
                    alert_type = AlertType.blocked
                    msg = f"Payment blocked for {existing.source_country}->{existing.destination_country}"
                db.add(
                    Alert(
                        id=uuid.uuid4(),
                        payment_id=existing.id,
                        alert_type=alert_type,
                        message=msg,
                        is_read=existing.status in [PaymentStatus.approved, PaymentStatus.executed],
                        created_at=existing.updated_at,
                    )
                )
                db.commit()

            existing_audit = db.query(AuditRecord).filter(AuditRecord.payment_id == existing.id).first()
            if not existing_audit and existing.status == PaymentStatus.executed:
                tx_hash = "0x" + f"{i:x}" * 64
                proof_hash = "0x" + f"{(i+1):x}" * 64
                db.add(
                    AuditRecord(
                        id=uuid.uuid4(),
                        payment_id=existing.id,
                        tx_hash=tx_hash[:66],
                        on_chain_proof_hash=proof_hash[:66],
                        report_path=json.dumps({"block_number": 8600000 + i, "chain": "Base Sepolia", "tx_hash": tx_hash[:66], "proof_tx_hash": proof_hash[:66]}),
                        zk_proof_reference=proof_hash[:66],
                        created_at=existing.executed_at or now,
                    )
                )
                db.commit()

        if seeded_payments:
            first_payment = seeded_payments[0]
            existing_reval = db.query(RevalidationRecord).filter(
                RevalidationRecord.payment_id == first_payment.id,
                RevalidationRecord.trigger_reason == "Sanctions list update triggered retrospective check",
            ).first()
            if not existing_reval:
                db.add(
                    RevalidationRecord(
                        id=uuid.uuid4(),
                        payment_id=first_payment.id,
                        trigger_reason="Sanctions list update triggered retrospective check",
                        original_decision="approved",
                        new_decision="pending_review",
                        new_risk_score=Decimal("71.50"),
                        status=RevalidationStatus.completed,
                        created_at=now - timedelta(hours=2),
                    )
                )
                db.commit()

        print("Demo dataset seeded/verified idempotently.")
    finally:
        db.close()


# Alias for scripts / docs: `python -c "from app.db.seed import run_seed; run_seed()"`
run_seed = seed_db

if __name__ == "__main__":
    seed_db()
