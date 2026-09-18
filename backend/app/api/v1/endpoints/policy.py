from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID

from app.db.database import get_db
from app.schemas import PolicyRuleResponse
from app.models.policy_rules import PolicyRule
from app.models.payment_intents import PaymentIntent
from app.api.dependencies import get_current_user
from app.models.users import User

router = APIRouter()

@router.get("/rules", response_model=List[PolicyRuleResponse])
def get_policy_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    rules = db.query(PolicyRule).all()
    return rules

@router.get("/check/{payment_id}")
def check_payment_policy(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Run real country policy check for a specific payment."""
    try:
        payment = db.query(PaymentIntent).filter(
            PaymentIntent.id == payment_id
        ).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        from app.services.governance.country_policy_service import (
            check_corridor,
            get_current_policy_version,
        )

        policy_result = check_corridor(
            db=db,
            source_country=payment.source_country,
            destination_country=payment.destination_country,
            amount=float(payment.amount),
            purpose=(payment.purpose.value if hasattr(payment.purpose, "value") else str(payment.purpose or "")),
        )
        policy_version = get_current_policy_version(db)
        return {
            "payment_id": str(payment_id),
            "corridor": f"{payment.source_country} → {payment.destination_country}",
            "policy_result": policy_result,
            "policy_version": policy_version,
            "checked_at": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Policy check failed: {e}")
