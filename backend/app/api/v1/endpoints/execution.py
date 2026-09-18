"""
Execution API endpoints for on-chain settlement.
"""

import json
from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.dependencies import get_current_user
from app.models.users import User
from app.models.payment_intents import PaymentIntent
from app.models.audit_records import AuditRecord
from app.services.blockchain.execution_orchestrator import (
    ExecutionOrchestrator,
    ExecutionError,
)

router = APIRouter()


@router.post("/execute/{payment_id}")
async def execute_settlement(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Trigger settlement execution for a payment.

    This endpoint:
    1. Verifies all approvals
    2. Checks policy version
    3. Loads on-chain authorization
    4. Executes token transfer
    5. Monitors transaction
    6. Registers proof
    7. Saves audit record
    8. Sends notifications
    """
    try:
        # Verify payment exists
        payment = db.query(PaymentIntent).filter(
            PaymentIntent.id == payment_id
        ).first()

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # Create orchestrator and execute
        orchestrator = ExecutionOrchestrator(db)
        result = await orchestrator.execute_settlement(payment_id)

        return {
            "status": "success",
            "execution": result,
        }

    except ExecutionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Execution failed: {str(e)}")


@router.get("/status/{payment_id}")
def get_execution_status(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Get execution status and transaction details for a payment.

    Returns:
    - Execution status (not_executed, in_progress, executed, failed)
    - Transaction hash if executed
    - Proof registry hash if registered
    - Block number
    - Chain
    - Audit trail
    """
    try:
        # Get payment
        payment = db.query(PaymentIntent).filter(
            PaymentIntent.id == payment_id
        ).first()

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        # Get audit records
        audit_records = db.query(AuditRecord).filter(
            AuditRecord.payment_id == payment_id
        ).all()

        # Build status response
        status = "not_executed"
        tx_details = None

        if payment.status.value == "executed":
            status = "executed"

            if audit_records:
                latest = audit_records[-1]
                meta = {}
                if latest.report_path:
                    try:
                        meta = json.loads(latest.report_path)
                    except Exception:
                        meta = {}
                tx_details = {
                    "tx_hash": latest.tx_hash,
                    "proof_tx_hash": latest.on_chain_proof_hash,
                    "block_number": meta.get("block_number"),
                    "chain": meta.get("chain"),
                    "timestamp": latest.created_at.isoformat(),
                }
        elif payment.status.value == "failed":
            status = "failed"

        return {
            "payment_id": str(payment_id),
            "payment_status": payment.status.value,
            "execution_status": status,
            "tx_details": tx_details,
            "audit_records": [
                {
                    "tx_hash": record.tx_hash,
                    "timestamp": record.created_at.isoformat(),
                }
                for record in audit_records
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching status: {str(e)}")


@router.get("/audit/{payment_id}")
def get_audit_trail(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get complete audit trail for a payment execution."""
    try:
        audit_records = db.query(AuditRecord).filter(
            AuditRecord.payment_id == payment_id
        ).order_by(AuditRecord.created_at.asc()).all()

        return {
            "payment_id": str(payment_id),
            "audit_records": [
                {
                    "id": str(record.id),
                    "tx_hash": record.tx_hash,
                    "proof_tx_hash": record.on_chain_proof_hash,
                    "timestamp": record.created_at.isoformat(),
                }
                for record in audit_records
            ],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching audit trail: {str(e)}")
