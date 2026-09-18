"""
Payment Pipeline — Master Orchestrator
Runs all 14 compliance stages synchronously in a thread pool.
All blocking I/O (httpx, Neo4j, Redis, Web3) is safe here because
this function is always called via run_in_executor, never on the event loop.
"""

import json
import logging
import asyncio
from sqlalchemy.orm import Session
from uuid import UUID

from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.compliance_decisions import ComplianceDecision, AIDecisionType, FinalDecision

from app.core.config import settings  # FIXED: PHASE7
from app.services.governance.country_policy_service import check_corridor
from app.services.governance.treasury_controls_service import check_treasury_controls
from app.services.compliance.compliance_engine import run_compliance_checks
from app.services.compliance.wallet_graph_service import analyze_wallet
from app.services.compliance.issuer_risk_service import get_issuer_risk
from app.services.governance.chain_governance_service import check_chain
from app.services.governance.liquidity_service import compute_best_route
from app.services.governance.policy_veto_service import apply_veto
from app.services.ai.ai_decision_engine import get_ai_decision
from app.services.privacy.fhe_service import run_all_fhe_checks
from app.services.privacy.zk_service import generate_combined_proof
from app.models.users import User

logger = logging.getLogger(__name__)


def run_payment_pipeline(db: Session, payment_id: UUID) -> dict | None:
    """
    Synchronous master orchestrator — safe to call from a thread pool.
    All blocking calls (httpx, Neo4j, Redis, Web3) run here in a thread,
    never on the asyncio event loop.
    """
    # Step 1: Load payment intent
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        logger.error(f"Payment {payment_id} not found")
        return None

    pipeline_results: dict = {}

    # Step 2: Country Policy Governance
    country_policy = check_corridor(
        db, payment.source_country, payment.destination_country, float(payment.amount)
    )
    pipeline_results["country_policy"] = country_policy

    # Step 3: Corporate Treasury Controls
    treasury_controls = check_treasury_controls(db, payment)
    pipeline_results["treasury_controls"] = treasury_controls

    # Step 4: Compliance Engine (KYC/KYB/sanctions)
    compliance = run_compliance_checks(payment)
    pipeline_results["compliance"] = compliance

    # Step 5: Wallet Graph Intelligence
    sender_user = db.query(User).filter(User.id == payment.created_by).first()
    wallet_address = None
    if sender_user and sender_user.wallet_address:
        wallet_address = sender_user.wallet_address
    if hasattr(payment, "sender_wallet") and payment.sender_wallet:
        wallet_address = payment.sender_wallet
    wallet_graph = analyze_wallet(wallet_address or payment.sender_company)
    receiver_wallet_result = analyze_wallet(
        payment.receiver_wallet or payment.receiver_company
    )
    if receiver_wallet_result.get("risk_score", 0) > wallet_graph.get("risk_score", 0):
        wallet_graph = receiver_wallet_result
    pipeline_results["wallet_graph"] = wallet_graph

    # Step 6: Stablecoin Issuer Risk
    issuer_risk = get_issuer_risk(db, payment.token)  # FIXED: M5
    pipeline_results["issuer_risk"] = issuer_risk

    # Step 7: Cross-Chain Governance
    chain_governance = check_chain(payment.source_chain, payment.destination_chain)
    pipeline_results["chain_governance"] = chain_governance

    # Step 8: Liquidity + Cost Engine
    liquidity = compute_best_route(payment)
    pipeline_results["liquidity"] = liquidity

    # Step 9: AI Decision Engine
    creator_user = db.query(User).filter(User.id == payment.created_by).first()
    preferred_engine = (creator_user.ai_preference if creator_user else None) or "ollama"

    ai_result = get_ai_decision(payment, pipeline_results, preferred_engine)
    ai_decision = ai_result.get("decision", "manual_review")
    pipeline_results["ai_decision"] = ai_decision

    # Step 10: Policy Final Veto
    final_decision_enum = apply_veto(pipeline_results, ai_decision)
    pipeline_results["final_decision"] = final_decision_enum.value

    # Step 11: Persist compliance decision record
    decision_record = ComplianceDecision(
        payment_id=payment.id,
        country_policy_result=country_policy,
        treasury_controls_result=treasury_controls,  # FIXED: M1
        compliance_result=compliance,  # FIXED: M1
        wallet_risk_result=wallet_graph,
        issuer_risk_result=issuer_risk,
        chain_governance_result=chain_governance,
        liquidity_result=liquidity,
        ai_decision=(
            AIDecisionType(ai_decision)
            if ai_decision in [e.value for e in AIDecisionType]
            else AIDecisionType.manual_review
        ),
        ai_reasoning=ai_result.get("reasoning"),
        ai_confidence=str(ai_result.get("confidence")),
        ai_flags=ai_result.get("flags"),
        ai_alternatives=ai_result.get("alternative_options"),
        ai_engine_used=ai_result.get("meta", {}).get("engine"),
        ai_prompt_tokens=str(ai_result.get("meta", {}).get("tokens")),
        ai_latency_ms=str(ai_result.get("meta", {}).get("latency_ms")),
        ai_risk_summary=ai_result.get("risk_summary"),
        policy_version=country_policy.get("policy_version", "v1.0"),
        final_decision=final_decision_enum,
    )
    db.add(decision_record)
    db.flush()

    # Step 11a: FHE Private Threshold Checks
    fhe_result: dict = {}
    try:
        fhe_result = run_all_fhe_checks(payment)
        decision_record.fhe_check_result = fhe_result
        pipeline_results["fhe_checks"] = fhe_result

        if not fhe_result.get("overall_pass", True):
            logger.warning(
                f"FHE daily-limit check FAILED for {payment.id} — overriding to BLOCKED"
            )
            final_decision_enum = FinalDecision.blocked
            decision_record.final_decision = FinalDecision.blocked
    except Exception as exc:
        logger.error(f"FHE checks failed for {payment.id}: {exc}")
        fhe_result = {"error": str(exc), "overall_pass": True}
        decision_record.fhe_check_result = fhe_result

    # Step 11b: ZK Proof Generation
    zk_bundle: dict = {}
    try:
        amount = float(payment.amount)
        zk_bundle = generate_combined_proof(
            payment_id=str(payment.id),
            kyc_result={
                "kyc_status": compliance.get("kyc_status", "missing"),
                "company_name": payment.sender_company,
            },
            amount=amount,
            policy_range=(0.0, float(settings.TREASURY_DAILY_LIMIT)),  # FIXED: PHASE7
            approval_id=None,
        )

        # Attempt on-chain registration (graceful fallback)
        try:
            from app.services.blockchain.contract_service import contract_service
            proof_hash = zk_bundle["combined_proof_hash"]
            dummy_tx = "0x" + "0" * 64
            token_address = settings.MOCK_USDC_ADDRESS if payment.token == "USDC" else settings.MOCK_USDT_ADDRESS
            on_chain_tx = contract_service.register_proof_on_chain(
                payment_id=("0x" + str(payment.id).replace("-", "")[:64].ljust(64, "0")),
                tx_hash=dummy_tx,
                zk_proof_hash=("0x" + proof_hash)[:66].ljust(66, "0"),
                ai_decision=ai_decision,
                policy_version=country_policy.get("policy_version", "v1.0"),
                amount=int(amount),
                token=token_address,
            )
            zk_bundle["on_chain_tx"] = on_chain_tx
            zk_bundle["basescan_url"] = f"https://sepolia.basescan.org/tx/{on_chain_tx}"
        except Exception as chain_err:
            logger.warning(f"On-chain proof registration skipped: {chain_err}")
            zk_bundle["on_chain_tx"] = None
            zk_bundle["basescan_url"] = None

        decision_record.zk_proof_reference = json.dumps(zk_bundle)
        pipeline_results["zk_proof"] = zk_bundle

    except Exception as exc:
        logger.error(f"ZK proof generation failed for {payment.id}: {exc}")
        zk_bundle = {"error": str(exc)}
        decision_record.zk_proof_reference = json.dumps(zk_bundle)

    # Step 12: Determine payment status
    needs_review = (
        final_decision_enum == FinalDecision.pending_review
        or float(payment.amount) > 100_000
        or wallet_graph.get("overall_risk") in ("high", "critical")
    )

    if final_decision_enum == FinalDecision.blocked:
        payment.status = PaymentStatus.blocked
    elif needs_review:
        payment.status = PaymentStatus.under_review
    elif final_decision_enum == FinalDecision.approved:
        payment.status = PaymentStatus.approved
    else:
        payment.status = PaymentStatus.pending

    db.add(payment)
    db.commit()
    db.refresh(payment)
    db.refresh(decision_record)

    # Step 13: Create DB alert + send Telegram (sync wrapper)
    _send_notifications_sync(db, payment, pipeline_results, wallet_graph, ai_result, zk_bundle)

    # Step 14: Log
    logger.info(
        f"Pipeline done: payment={payment.id} status={payment.status.value} "
        f"fhe_pass={fhe_result.get('overall_pass')} zk_valid={zk_bundle.get('is_valid')}"
    )

    return pipeline_results


def _send_notifications_sync(db, payment, pipeline_results, wallet_graph, ai_result, zk_bundle):
    """Run async AlertService in a new event loop inside this thread."""
    from app.services.notifications.alert_service import AlertService

    payment_data = {
        "id": str(payment.id),
        "source_country": payment.source_country,
        "destination_country": payment.destination_country,
        "amount": str(payment.amount),
        "token": payment.token,
        "purpose": payment.purpose,
    }

    ai_decision = pipeline_results.get("ai_decision", "manual_review")

    try:
        if payment.status == PaymentStatus.blocked:
            extra = {
                "block_reason": "Policy or compliance check failed",
                "policy_veto_applied": str(
                    pipeline_results.get("final_decision") == "blocked"
                ),
                "sanctions_hit": str(
                    pipeline_results.get("compliance", {}).get("sanctions_hit", False)
                ),
            }
            coro = AlertService.send_payment_alert(
                db, "payment_blocked", payment.id, payment_data, extra
            )
        elif payment.status == PaymentStatus.under_review:
            extra = {
                "review_reason": "Amount or risk threshold exceeded",
                "wallet_risk_score": wallet_graph.get("overall_risk", "unknown"),
                "ai_decision": ai_decision,
            }
            coro = AlertService.send_payment_alert(
                db, "review_needed", payment.id, payment_data, extra
            )
        elif payment.status == PaymentStatus.approved:
            extra = {
                "ai_decision": ai_decision,
                "recommended_chain": payment.destination_chain,
                "confidence": ai_result.get("confidence", 0),
                "tx_hash": zk_bundle.get("on_chain_tx", "pending"),
            }
            coro = AlertService.send_payment_alert(
                db, "payment_approved", payment.id, payment_data, extra
            )
        else:
            return

        try:
            asyncio.run(coro)
        except RuntimeError:
            import nest_asyncio
            nest_asyncio.apply()
            asyncio.run(coro)

    except Exception as exc:
        logger.error(f"Notification error for {payment.id}: {exc}")
