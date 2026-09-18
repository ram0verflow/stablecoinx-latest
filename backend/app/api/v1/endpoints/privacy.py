"""
Privacy Layer API Endpoints
Exposes FHE threshold checks and ZK proof generation/verification.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
from uuid import UUID

from app.db.database import get_db
from app.models.payment_intents import PaymentIntent
from app.models.compliance_decisions import ComplianceDecision
from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.privacy.fhe_service import run_all_fhe_checks, fhe_check_threshold
from app.services.privacy.zk_service import (
    generate_combined_proof,
    generate_kyc_proof,
    generate_amount_range_proof,
    verify_proof,
)
from app.services.compliance.compliance_engine import run_compliance_checks

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_payment_or_404(payment_id: UUID, db: Session) -> PaymentIntent:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


def _get_latest_decision(payment_id: UUID, db: Session) -> ComplianceDecision | None:
    return (
        db.query(ComplianceDecision)
        .filter(ComplianceDecision.payment_id == payment_id)
        .order_by(ComplianceDecision.created_at.desc())
        .first()
    )


# ── FHE ───────────────────────────────────────────────────────────────────────

@router.post("/fhe-check/{payment_id}")
def run_fhe_checks(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Run FHE threshold checks for a payment and persist results."""
    payment = _get_payment_or_404(payment_id, db)
    fhe_result = run_all_fhe_checks(payment)

    # Persist to latest compliance decision
    decision = _get_latest_decision(payment_id, db)
    if decision:
        decision.fhe_check_result = fhe_result
        db.commit()
        db.refresh(decision)

    return {
        "payment_id": str(payment_id),
        "fhe_result": fhe_result,
        "persisted": decision is not None,
    }


# ── ZK ────────────────────────────────────────────────────────────────────────

@router.post("/zk-proof/{payment_id}")
def generate_zk_proofs(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Generate ZK proof bundle for a payment and persist + register on-chain."""
    payment = _get_payment_or_404(payment_id, db)
    decision = _get_latest_decision(payment_id, db)

    # Build inputs
    compliance = run_compliance_checks(payment)
    amount = float(payment.amount)

    # Policy range: 0 → daily limit (500 000)
    policy_range = (0.0, 500_000.0)

    # Approval id from existing approvals if any
    approval_id = None
    if hasattr(payment, "approvals") and payment.approvals:
        approval_id = str(payment.approvals[-1].reviewer_id)

    combined = generate_combined_proof(
        payment_id=str(payment_id),
        kyc_result={
            "kyc_status": compliance.get("kyc_status", "missing"),
            "company_name": payment.sender_company,
        },
        amount=amount,
        policy_range=policy_range,
        approval_id=approval_id,
    )

    # Attempt on-chain registration
    on_chain_tx = None
    try:
        from app.services.blockchain.contract_service import get_contract_service
        cs = get_contract_service()
        if cs and cs.contracts:  # only attempt if contracts loaded
            proof_hash_bytes32 = "0x" + combined["combined_proof_hash"]
            dummy_tx_hash = "0x" + "0" * 64
            policy_version = (decision.policy_version if decision else "v1.0") or "v1.0"

            on_chain_tx = cs.register_proof_on_chain(
                payment_id=str(payment_id).replace("-", "")[:64].ljust(64, "0"),
                tx_hash=dummy_tx_hash,
                zk_proof_hash=proof_hash_bytes32[:66].ljust(66, "0"),
                ai_decision=(decision.ai_decision.value if decision and decision.ai_decision else "manual_review"),
                policy_version=policy_version,
                amount=int(amount),
                token=payment.token,
            )
            combined["on_chain_tx"] = on_chain_tx
            combined["basescan_url"] = f"https://sepolia.basescan.org/tx/{on_chain_tx}"
        else:
            combined["on_chain_tx"] = None
            combined["basescan_url"] = None
    except Exception as e:
        logger.warning(f"On-chain proof registration skipped: {e}")
        combined["on_chain_tx"] = None
        combined["basescan_url"] = None

    # Persist to compliance decision
    if decision:
        decision.zk_proof_reference = json.dumps(combined)
        db.commit()
        db.refresh(decision)

    return {
        "payment_id": str(payment_id),
        "proof_bundle": combined,
        "persisted": decision is not None,
    }


# ── GET all proofs ────────────────────────────────────────────────────────────

@router.get("/proofs/{payment_id}")
def get_proofs(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Return all stored FHE and ZK proof data for a payment."""
    _get_payment_or_404(payment_id, db)
    decision = _get_latest_decision(payment_id, db)

    if not decision:
        raise HTTPException(status_code=404, detail="No compliance decision found for this payment")

    zk_bundle = None
    if decision.zk_proof_reference:
        try:
            zk_bundle = json.loads(decision.zk_proof_reference)
        except (json.JSONDecodeError, TypeError):
            zk_bundle = {"raw": decision.zk_proof_reference}

    return {
        "payment_id": str(payment_id),
        "fhe_checks": decision.fhe_check_result,
        "zk_proof_bundle": zk_bundle,
        "decision_id": str(decision.id),
    }


# ── Verify ────────────────────────────────────────────────────────────────────

@router.post("/verify/{payment_id}")
def verify_payment_proofs(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Verify stored ZK proofs for a payment."""
    _get_payment_or_404(payment_id, db)
    decision = _get_latest_decision(payment_id, db)

    if not decision or not decision.zk_proof_reference:
        raise HTTPException(status_code=404, detail="No ZK proofs found for this payment")

    try:
        bundle = json.loads(decision.zk_proof_reference)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=422, detail="Stored proof data is malformed")

    components = bundle.get("components", {})
    results = {}

    for proof_name, proof_data in components.items():
        if isinstance(proof_data, dict):
            results[proof_name] = verify_proof(proof_data)

    all_valid = all(results.values()) if results else False

    return {
        "payment_id": str(payment_id),
        "verification_results": results,
        "all_valid": all_valid,
        "combined_proof_hash": bundle.get("combined_proof_hash"),
        "on_chain_tx": bundle.get("on_chain_tx"),
        "basescan_url": bundle.get("basescan_url"),
    }
