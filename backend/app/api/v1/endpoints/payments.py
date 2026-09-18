from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID
import asyncio
import hashlib
from datetime import datetime, timedelta, timezone

from app.db.database import get_db, SessionLocal
from app.schemas import PaymentCreate, PaymentResponse, PaymentStatusUpdate
from app.models.payment_intents import PaymentIntent
from app.models.users import User
from app.api.dependencies import get_current_user, require_role
from app.services.payment_pipeline import run_payment_pipeline

router = APIRouter()


def _run_pipeline_in_thread(payment_id: UUID) -> None:
    """
    Sync wrapper — creates its own DB session and runs the pipeline.
    Always called via run_in_executor so blocking I/O never stalls the event loop.
    """
    db = SessionLocal()
    try:
        run_payment_pipeline(db, payment_id)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Pipeline thread error for {payment_id}: {exc}")
    finally:
        db.close()


async def process_payment_background(payment_id: UUID) -> None:
    """
    Async entry point for FastAPI background tasks.
    Offloads the sync pipeline to the default thread pool executor.
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _run_pipeline_in_thread, payment_id)


# Legacy alias kept for ai.py which imports this name
process_payment_sync = _run_pipeline_in_thread

@router.post("/create", response_model=PaymentResponse)
def create_payment(
    *,
    db: Session = Depends(get_db),
    payment_in: PaymentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> Any:
    if payment_in.amount <= 0 or payment_in.amount > 10_000_000:
        raise HTTPException(
            status_code=400,
            detail="Amount must be positive and <= 10,000,000",
        )

    now = datetime.now(timezone.utc)
    time_bucket = int(now.timestamp() // 60)
    intent_hash = hashlib.sha256(
        f"{payment_in.sender_company}|{payment_in.receiver_company}|{payment_in.amount}|{time_bucket}".encode("utf-8")
    ).hexdigest()

    duplicate_since = now - timedelta(seconds=60)
    duplicate = db.query(PaymentIntent).filter(
        PaymentIntent.intent_hash == intent_hash,
        PaymentIntent.created_at >= duplicate_since,
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=f"Duplicate payment intent detected (matches payment {duplicate.id})",
        )

    payment = PaymentIntent(
        sender_company=payment_in.sender_company,
        receiver_company=payment_in.receiver_company,
        source_country=payment_in.source_country,
        destination_country=payment_in.destination_country,
        source_chain=payment_in.source_chain,
        destination_chain=payment_in.destination_chain,
        amount=payment_in.amount,
        token=payment_in.token,
        purpose=payment_in.purpose,
        urgency=payment_in.urgency,
        intent_hash=intent_hash,
        created_by=current_user.id
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    background_tasks.add_task(process_payment_background, payment.id)
    
    return payment

@router.get("/", response_model=List[PaymentResponse])
def read_payments(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    payments = db.query(PaymentIntent).offset(skip).limit(limit).all()
    return payments

@router.get("/pending", response_model=List[PaymentResponse])
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Returns payments that are in pending or review status
    payments = db.query(PaymentIntent).filter(
        PaymentIntent.status.in_(["pending", "under_review", "review"])
    ).all()
    return payments

from app.models.compliance_decisions import ComplianceDecision

@router.get("/{payment_id}", response_model=PaymentResponse)
def read_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.get("/{payment_id}/analysis")
def read_payment_analysis(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    decision = db.query(ComplianceDecision).filter(ComplianceDecision.payment_id == payment_id).order_by(ComplianceDecision.created_at.desc()).first()
    
    if not decision:
        raise HTTPException(status_code=404, detail="Analysis not found")
        
    return {
        "paymentId": str(payment_id),
        "countryPolicy": [
            {
                "layer": "Corridor Policy Check",
                "status": "PASS" if decision.country_policy_result and decision.country_policy_result.get("is_allowed") else "FAIL",
                "details": decision.country_policy_result.get("notes", "Checked against current policies") if decision.country_policy_result else ""
            }
        ],
        "walletRisk": {
            "score": int(decision.wallet_risk_result.get("risk_score", 0.0) * 100) if decision.wallet_risk_result else 0,
            "level": str(decision.wallet_risk_result.get("overall_risk", "Low")).title() if decision.wallet_risk_result else "Low",
            "warnings": decision.wallet_risk_result.get("suspicious_links", []) if decision.wallet_risk_result else []
        },
        "issuerRisk": {
            "usdc": {
                "rating": "A+",
                "reserve": "100% Cash/Treasuries",
                "audited": True,
                "depegEvents": 0
            },
            "usdt": {
                "rating": "B",
                "reserve": "85% Cash",
                "audited": False,
                "depegEvents": 1
            }
        },
        "chainGovernance": {
            "allowedChains": ["Base Sepolia", "Polygon Amoy"],
            "bridgeTrustScore": int(decision.chain_governance_result.get("bridge_trust_score", 0.8) * 100) if decision.chain_governance_result else 80,
            "gasEstimate": "0.0001 ETH"
        },
        "liquidityAnalysis": {
            "cheapestRoute": decision.liquidity_result.get("recommended_route", "Direct") if decision.liquidity_result else "Direct",
            "slippage": f"{decision.liquidity_result.get('slippage_percent', 0.0)}%" if decision.liquidity_result else "0.0%",
            "eta": f"{decision.liquidity_result.get('eta_minutes', 1)} mins" if decision.liquidity_result else "~1 min",
            "totalCost": f"${decision.liquidity_result.get('estimated_cost_usd', 0.0)}" if decision.liquidity_result else "$0.05"
        },
        "aiDecision": {
            "action": decision.ai_decision.value.upper() if decision.ai_decision else "REVIEW",
            "reasoning": decision.ai_reasoning or "No reasoning provided.",
            "confidence": float(decision.ai_confidence) * 100 if decision.ai_confidence else 95,
            "engineUsed": decision.ai_engine_used or "unknown",
            "latencyMs": int(decision.ai_latency_ms) if decision.ai_latency_ms else 0,
            "riskSummary": decision.ai_risk_summary or "",
            "flags": decision.ai_flags or [],
            "alternativeOptions": decision.ai_alternatives or []
        },
        "fheCheck": _build_fhe_response(decision.fhe_check_result),
        "zkProof": _build_zk_response(decision.zk_proof_reference),
    }

def _build_fhe_response(fhe_data: dict | None) -> dict:
    if not fhe_data:
        return {
            "status": "PENDING",
            "details": "FHE checks not yet run",
            "checks": [],
            "method": "fhe_simulated",
            "overall_pass": None,
        }
    checks = fhe_data.get("checks", [])
    overall_pass = fhe_data.get("overall_pass", True)
    return {
        "status": "PASS" if overall_pass else "FAIL",
        "details": fhe_data.get("privacy_statement", "FHE threshold checks completed"),
        "checks": checks,
        "method": fhe_data.get("method", "fhe_simulated"),
        "overall_pass": overall_pass,
        "fhe_available": fhe_data.get("fhe_available", False),
    }

def _build_zk_response(zk_ref: str | None) -> dict:
    if not zk_ref:
        return {
            "generated": False,
            "proofHash": "Pending",
            "components": {},
            "on_chain_tx": None,
            "basescan_url": None,
        }
    try:
        import json as _json
        bundle = _json.loads(zk_ref)
    except Exception:
        return {
            "generated": True,
            "proofHash": str(zk_ref)[:66],
            "components": {},
            "on_chain_tx": None,
            "basescan_url": None,
        }

    components = bundle.get("components", {})
    kyc = components.get("kyc_proof", {})
    range_p = components.get("range_proof", {})
    approval_p = components.get("approval_proof", {})

    return {
        "generated": True,
        "proofHash": bundle.get("combined_proof_hash", ""),
        "bundleId": bundle.get("bundle_id", ""),
        "isValid": bundle.get("is_valid", False),
        "proofMethod": bundle.get("proof_method", "zk_simulated"),
        "on_chain_tx": bundle.get("on_chain_tx"),
        "basescan_url": bundle.get("basescan_url"),
        "components": {
            "kyc": {
                "proof_type": kyc.get("proof_type"),
                "is_valid": kyc.get("is_valid"),
                "proof_hash": kyc.get("proof_hash", "")[:16] + "...",
                "public_inputs": kyc.get("public_inputs", {}),
                "proof_method": kyc.get("proof_method"),
            },
            "range": {
                "proof_type": range_p.get("proof_type"),
                "is_valid": range_p.get("is_valid"),
                "proof_hash": range_p.get("proof_hash", "")[:16] + "...",
                "public_inputs": range_p.get("public_inputs", {}),
                "proof_method": range_p.get("proof_method"),
            },
            "approval": {
                "proof_type": approval_p.get("proof_type"),
                "is_valid": approval_p.get("is_valid"),
                "proof_hash": approval_p.get("proof_hash", "")[:16] + "...",
                "public_inputs": approval_p.get("public_inputs", {}),
                "proof_method": approval_p.get("proof_method"),
            },
        },
        "privacy_statement": bundle.get("privacy_statement", ""),
    }

from app.models.payment_intents import PaymentStatus as _PS

@router.patch("/{payment_id}/status", response_model=PaymentResponse)
def update_payment_status(
    payment_id: UUID,
    status_in: PaymentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "treasury_officer"]))
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = _PS(status_in.status.value)
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

@router.post("/{payment_id}/approve")
def approve_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "treasury_officer"]))
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = _PS.approved
    db.add(payment)
    db.commit()
    return {"status": "success", "message": "Payment approved"}

@router.post("/{payment_id}/reject")
def reject_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "treasury_officer"]))
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = _PS.rejected
    db.add(payment)
    db.commit()
    return {"status": "success", "message": "Payment rejected"}

@router.post("/{payment_id}/escalate")
def escalate_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(["admin", "treasury_officer"]))
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    payment.status = _PS.under_review
    db.add(payment)
    db.commit()
    return {"status": "success", "message": "Payment escalated"}
