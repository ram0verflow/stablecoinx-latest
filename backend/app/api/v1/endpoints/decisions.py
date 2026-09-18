from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
from uuid import UUID

from app.db.database import get_db
from app.schemas import ComplianceDecisionResponse
from app.models.compliance_decisions import ComplianceDecision
from app.api.dependencies import get_current_user
from app.models.users import User

router = APIRouter()

@router.get("/{payment_id}", response_model=ComplianceDecisionResponse)
def get_decision(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    decision = db.query(ComplianceDecision).filter(ComplianceDecision.payment_id == payment_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found for this payment")
    return decision
