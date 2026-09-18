"""
Historical Revalidation Engine for SettleGuard.
Rescores past payments when conditions change (sanctions, policies, wallet intelligence, issuer risk).
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.compliance_decisions import ComplianceDecision, FinalDecision
from app.models.revalidation_records import RevalidationRecord, RevalidationStatus

from app.services.governance.country_policy_service import check_corridor
from app.services.compliance.compliance_engine import run_compliance_checks
from app.services.compliance.wallet_graph_service import analyze_wallet
from app.services.compliance.issuer_risk_service import get_issuer_risk
from app.services.governance.chain_governance_service import check_chain
from app.services.governance.liquidity_service import compute_best_route
from app.services.governance.policy_veto_service import apply_veto
from app.services.ai.ai_decision_engine import get_ai_decision
from app.services.notifications.alert_service import AlertService

logger = logging.getLogger(__name__)


class RevalidationEngine:
    """Engine for historical revalidation of past payments."""

    @staticmethod
    async def trigger_sanctions_update_revalidation(db: Session) -> int:
        """
        Revalidate all executed payments from last 90 days against updated sanctions list.

        Returns:
            Count of flagged payments
        """
        logger.info("Starting sanctions update revalidation...")

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)

        # Fetch all executed payments from last 90 days
        payments = db.query(PaymentIntent).filter(
            and_(
                PaymentIntent.status == PaymentStatus.executed,
                PaymentIntent.created_at >= cutoff_date,
            )
        ).all()

        flagged_count = 0

        for payment in payments:
            try:
                # Re-run sanctions check
                compliance = run_compliance_checks(payment)
                sanctions_hit = compliance.get("sanctions_hit", False)

                # Get original decision
                original_decision = db.query(ComplianceDecision).filter(
                    ComplianceDecision.payment_id == payment.id
                ).first()

                if original_decision:
                    original_flags = original_decision.ai_flags or {}
                    original_sanctions = bool(original_flags.get("sanctions_hit", False))

                    # If new sanctions hit found
                    if sanctions_hit and not original_sanctions:
                        flagged_count += 1

                        # Create revalidation record
                        revalidation = RevalidationRecord(
                            payment_id=payment.id,
                            trigger_reason="Sanctions list update - new hit detected",
                            original_decision=str(original_decision.final_decision.value),
                            new_decision=FinalDecision.blocked.value,
                            status=RevalidationStatus.completed,
                        )
                        db.add(revalidation)

                        # Flag payment for review
                        payment.status = PaymentStatus.revalidation
                        db.add(payment)

                        # Send Telegram alert
                        try:
                            await AlertService.send_payment_alert(
                                db,
                                "revalidation_triggered",
                                payment.id,
                                {
                                    "id": str(payment.id),
                                    "source_country": payment.source_country,
                                    "destination_country": payment.destination_country,
                                    "amount": str(payment.amount),
                                    "token": payment.token,
                                    "purpose": payment.purpose,
                                },
                                {
                                    "count": 1,
                                    "trigger_reason": "Sanctions list update",
                                },
                            )
                        except Exception as e:
                            logger.error(f"Error sending Telegram alert: {e}")

            except Exception as e:
                logger.error(f"Error revalidating payment {payment.id}: {e}")
                continue

        db.commit()
        logger.info(f"Sanctions revalidation complete: {flagged_count} payments flagged")
        return flagged_count

    @staticmethod
    async def trigger_policy_change_revalidation(
        db: Session, changed_corridors: List[str]
    ) -> int:
        """
        Revalidate all executed payments for changed corridors from last 180 days.

        Args:
            db: Database session
            changed_corridors: List of affected corridor codes (e.g., ["SG-UK", "US-DE"])

        Returns:
            Count of flagged payments
        """
        logger.info(f"Starting policy change revalidation for corridors: {changed_corridors}")

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=180)
        flagged_count = 0

        # Build corridor filter (source_country -> destination_country)
        corridor_filters = []
        for corridor in changed_corridors:
            parts = corridor.split("-")
            if len(parts) == 2:
                corridor_filters.append(
                    and_(
                        PaymentIntent.source_country == parts[0],
                        PaymentIntent.destination_country == parts[1],
                    )
                )

        if not corridor_filters:
            logger.warning("No valid corridors provided for policy change revalidation")
            return 0

        # Fetch payments for changed corridors
        payments = db.query(PaymentIntent).filter(
            and_(
                PaymentIntent.status == PaymentStatus.executed,
                PaymentIntent.created_at >= cutoff_date,
                or_(*corridor_filters),
            )
        ).all()

        for payment in payments:
            try:
                # Re-run country policy check
                country_policy = check_corridor(
                    db, payment.source_country, payment.destination_country, float(payment.amount)
                )

                # Get original decision
                original_decision = db.query(ComplianceDecision).filter(
                    ComplianceDecision.payment_id == payment.id
                ).first()

                if original_decision:
                    original_policy = original_decision.country_policy_result or {}
                    original_allowed = original_policy.get("allowed", False)
                    new_allowed = country_policy.get("allowed", False)

                    # If policy decision changed
                    if original_allowed != new_allowed:
                        flagged_count += 1

                        # Create revalidation record
                        new_decision = FinalDecision.approved.value if new_allowed else FinalDecision.blocked.value
                        revalidation = RevalidationRecord(
                            payment_id=payment.id,
                            trigger_reason="Policy rules change - corridor policy updated",
                            original_decision=str(original_decision.final_decision.value),
                            new_decision=new_decision,
                            status=RevalidationStatus.completed,
                        )
                        db.add(revalidation)

                        # Flag payment for review
                        payment.status = PaymentStatus.revalidation
                        db.add(payment)

            except Exception as e:
                logger.error(f"Error revalidating payment {payment.id}: {e}")
                continue

        db.commit()
        logger.info(f"Policy change revalidation complete: {flagged_count} payments flagged")
        return flagged_count

    @staticmethod
    async def trigger_wallet_intelligence_revalidation(
        db: Session, suspicious_wallets: List[str]
    ) -> int:
        """
        Revalidate all payments involving suspicious wallets from last 90 days.

        Args:
            db: Database session
            suspicious_wallets: List of wallet addresses/companies now flagged as suspicious

        Returns:
            Count of flagged payments
        """
        logger.info(f"Starting wallet intelligence revalidation for {len(suspicious_wallets)} wallets")

        cutoff_date = datetime.now(timezone.utc) - timedelta(days=90)
        flagged_count = 0

        # Fetch payments involving suspicious wallets
        payments = db.query(PaymentIntent).filter(
            and_(
                PaymentIntent.status == PaymentStatus.executed,
                PaymentIntent.created_at >= cutoff_date,
                or_(
                    PaymentIntent.sender_company.in_(suspicious_wallets),
                    PaymentIntent.receiver_company.in_(suspicious_wallets),
                ),
            )
        ).all()

        for payment in payments:
            try:
                # Re-run wallet graph analysis
                wallet_risk = analyze_wallet(payment.sender_company)
                risk_score = float(wallet_risk.get("risk_score", 0))

                # If new risk score is high (> 0.7), flag for review
                if risk_score > 0.7:
                    flagged_count += 1

                    # Create revalidation record
                    original_decision = db.query(ComplianceDecision).filter(
                        ComplianceDecision.payment_id == payment.id
                    ).first()

                    revalidation = RevalidationRecord(
                        payment_id=payment.id,
                        trigger_reason="Wallet intelligence update - new suspicious activity detected",
                        original_decision=str(original_decision.final_decision.value) if original_decision else "unknown",
                        new_decision=FinalDecision.pending_review.value,
                        new_risk_score=risk_score,
                        status=RevalidationStatus.completed,
                    )
                    db.add(revalidation)

                    # Flag payment for review
                    payment.status = PaymentStatus.revalidation
                    db.add(payment)

            except Exception as e:
                logger.error(f"Error revalidating payment {payment.id}: {e}")
                continue

        db.commit()
        logger.info(f"Wallet intelligence revalidation complete: {flagged_count} payments flagged")
        return flagged_count

    @staticmethod
    async def trigger_issuer_risk_revalidation(
        db: Session, token: str, new_risk_level: str
    ) -> int:
        """
        Revalidate all executed payments using a token when issuer risk changes.

        Args:
            db: Database session
            token: Token symbol (e.g., "USDC", "USDT")
            new_risk_level: New risk level ("low", "medium", "high", "critical")

        Returns:
            Count of flagged payments
        """
        logger.info(f"Starting issuer risk revalidation for {token} - new level: {new_risk_level}")

        flagged_count = 0

        # Only flag if risk level is high or critical
        if new_risk_level not in ["high", "critical"]:
            logger.info(f"Risk level {new_risk_level} not flagged for revalidation")
            return 0

        # Fetch all executed payments using this token
        payments = db.query(PaymentIntent).filter(
            and_(
                PaymentIntent.status == PaymentStatus.executed,
                PaymentIntent.token == token,
            )
        ).all()

        for payment in payments:
            try:
                # Create revalidation record
                original_decision = db.query(ComplianceDecision).filter(
                    ComplianceDecision.payment_id == payment.id
                ).first()

                revalidation = RevalidationRecord(
                    payment_id=payment.id,
                    trigger_reason=f"Issuer risk downgrade for {token} - new level: {new_risk_level}",
                    original_decision=str(original_decision.final_decision.value) if original_decision else "unknown",
                    new_decision=FinalDecision.pending_review.value,
                    status=RevalidationStatus.completed,
                )
                db.add(revalidation)

                # Flag payment for review
                payment.status = PaymentStatus.revalidation
                db.add(payment)
                flagged_count += 1

            except Exception as e:
                logger.error(f"Error revalidating payment {payment.id}: {e}")
                continue

        db.commit()
        logger.info(f"Issuer risk revalidation complete: {flagged_count} payments flagged")
        return flagged_count

    @staticmethod
    def rescore_payment(db: Session, payment_id: UUID) -> Dict[str, Any]:
        """
        Rescore a single payment by running full compliance pipeline.

        Args:
            db: Database session
            payment_id: Payment ID to rescore

        Returns:
            {
                original_decision: str,
                new_decision: str,
                changed: bool,
                risk_delta: float,
                engines_results: dict
            }
        """
        logger.info(f"Rescoring payment {payment_id}...")

        payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
        if not payment:
            logger.error(f"Payment not found: {payment_id}")
            return {}

        # Get original decision
        original_record = db.query(ComplianceDecision).filter(
            ComplianceDecision.payment_id == payment_id
        ).first()

        original_decision = original_record.final_decision.value if original_record else "unknown"
        original_risk = 0.0
        if original_record and original_record.wallet_risk_result:
            if isinstance(original_record.wallet_risk_result, dict):
                original_risk = float(original_record.wallet_risk_result.get("risk_score", 0))

        # Re-run all compliance engines
        try:
            country_policy = check_corridor(
                db, payment.source_country, payment.destination_country, float(payment.amount)
            )
            treasury_controls = {"pass": True}  # Simplified for demo
            compliance = run_compliance_checks(payment)
            wallet_graph = analyze_wallet(payment.sender_company)
            issuer_risk = get_issuer_risk(payment.token)
            chain_governance = check_chain(payment.source_chain, payment.destination_chain)
            liquidity = compute_best_route(payment)

            # Re-run AI engine
            ai_engine = original_record.ai_engine_used if original_record else "ollama"
            ai_result = get_ai_decision(
                payment,
                {
                    "country_policy": country_policy,
                    "treasury_controls": treasury_controls,
                    "compliance": compliance,
                    "wallet_graph": wallet_graph,
                    "issuer_risk": issuer_risk,
                    "chain_governance": chain_governance,
                    "liquidity": liquidity,
                },
                ai_engine,
            )

            ai_decision = ai_result.get("decision", "manual_review")

            # Apply policy veto
            pipeline_results = {
                "country_policy": country_policy,
                "treasury_controls": treasury_controls,
                "compliance": compliance,
                "wallet_graph": wallet_graph,
                "issuer_risk": issuer_risk,
                "chain_governance": chain_governance,
                "liquidity": liquidity,
                "ai_decision": ai_decision,
            }

            final_decision_enum = apply_veto(pipeline_results, ai_decision)
            new_decision = final_decision_enum.value

            new_risk = float(wallet_graph.get("risk_score", 0))
            risk_delta = new_risk - original_risk
            changed = new_decision != original_decision

            logger.info(
                f"Rescore complete: {original_decision} → {new_decision} "
                f"(changed={changed}, risk_delta={risk_delta})"
            )

            return {
                "original_decision": original_decision,
                "new_decision": new_decision,
                "changed": changed,
                "risk_delta": risk_delta,
                "engines_results": {
                    "country_policy": country_policy.get("allowed", False),
                    "compliance": compliance.get("passed", False),
                    "wallet_risk": wallet_graph.get("overall_risk", "unknown"),
                    "issuer_risk": issuer_risk.get("risk_level", "unknown"),
                    "chain_governance": chain_governance.get("allowed", False),
                },
            }

        except Exception as e:
            logger.error(f"Error rescoring payment {payment_id}: {e}")
            return {
                "original_decision": original_decision,
                "new_decision": "error",
                "changed": False,
                "risk_delta": 0,
                "error": str(e),
            }

    @staticmethod
    async def process_revalidation_batch(
        db: Session, revalidation_ids: List[UUID]
    ) -> Dict[str, Any]:
        """
        Process a batch of revalidation records (up to 50).

        Args:
            db: Database session
            revalidation_ids: List of revalidation record IDs

        Returns:
            {
                total_processed: int,
                flagged_for_review: int,
                summary_message: str
            }
        """
        logger.info(f"Processing revalidation batch: {len(revalidation_ids)} records")

        # Limit to 50 per batch
        batch = revalidation_ids[:50]
        flagged_count = 0
        total_processed = len(batch)

        for revalidation_id in batch:
            try:
                revalidation = db.query(RevalidationRecord).filter(
                    RevalidationRecord.id == revalidation_id
                ).first()

                if not revalidation:
                    continue

                # Rescore the payment
                rescore_result = RevalidationEngine.rescore_payment(
                    db, revalidation.payment_id
                )

                # Update revalidation record with new scores
                revalidation.new_decision = rescore_result.get("new_decision", "unknown")
                revalidation.new_risk_score = rescore_result.get("risk_delta", 0)
                revalidation.status = RevalidationStatus.completed

                # If decision changed, flag for review
                if rescore_result.get("changed", False):
                    flagged_count += 1
                    payment = db.query(PaymentIntent).filter(
                        PaymentIntent.id == revalidation.payment_id
                    ).first()
                    if payment:
                        payment.status = PaymentStatus.under_review
                        db.add(payment)

                db.add(revalidation)

            except Exception as e:
                logger.error(f"Error processing revalidation {revalidation_id}: {e}")
                continue

        db.commit()

        summary_message = (
            f"🔁 Revalidation batch complete: {total_processed} payments rescored, "
            f"{flagged_count} flagged for review"
        )

        logger.info(summary_message)
        return {
            "total_processed": total_processed,
            "flagged_for_review": flagged_count,
            "summary_message": summary_message,
        }

    @staticmethod
    def get_revalidation_stats(db: Session) -> Dict[str, Any]:
        """Get statistics about revalidation records."""
        total = db.query(RevalidationRecord).count()
        pending = db.query(RevalidationRecord).filter(
            RevalidationRecord.status == RevalidationStatus.pending
        ).count()
        completed = db.query(RevalidationRecord).filter(
            RevalidationRecord.status == RevalidationStatus.completed
        ).count()

        # Count flagged (decision changed)
        all_records = db.query(RevalidationRecord).all()
        flagged = sum(
            1 for r in all_records
            if r.new_decision and r.original_decision and r.new_decision != r.original_decision
        )

        return {
            "total": total,
            "pending": pending,
            "completed": completed,
            "flagged_for_review": flagged,
        }
