from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID

from app.db.database import get_db
from app.schemas import PolicyRuleResponse
from app.models.policy_rules import PolicyRule
from app.api.dependencies import get_current_user
from app.models.users import User

router = APIRouter()

@router.get("/rules", response_model=List[PolicyRuleResponse])
def get_policy_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    rules = db.query(PolicyRule).all()
    return rules

@router.get("/check/{payment_id}")
def check_policy(payment_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Any:
    return {"status": "ok", "message": "Policy check passed (placeholder)"}
