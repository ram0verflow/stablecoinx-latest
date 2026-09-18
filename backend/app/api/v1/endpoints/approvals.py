from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID

from app.db.database import get_db
from app.schemas import ApprovalCreate, ApprovalResponse
from app.models.approvals import Approval
from app.api.dependencies import get_current_user, require_roles
from app.models.users import User

router = APIRouter()

@router.post("/{payment_id}", response_model=ApprovalResponse)
def submit_approval(
    payment_id: UUID,
    approval_in: ApprovalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "treasury_officer"]))
) -> Any:
    approval = Approval(
        payment_id=payment_id,
        reviewer_id=current_user.id,
        action=approval_in.action,
        notes=approval_in.notes
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval

@router.get("/", response_model=List[ApprovalResponse])
def get_approvals(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Approval).offset(skip).limit(limit).all()
