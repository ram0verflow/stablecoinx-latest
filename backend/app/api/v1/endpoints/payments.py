from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID

from app.db.database import get_db
from app.schemas import PaymentCreate, PaymentResponse, PaymentStatusUpdate
from app.models.payment_intents import PaymentIntent
from app.models.users import User
from app.api.dependencies import get_current_user, require_role

router = APIRouter()

@router.post("/create", response_model=PaymentResponse)
def create_payment(
    *,
    db: Session = Depends(get_db),
    payment_in: PaymentCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
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
        created_by=current_user.id
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
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
    
    payment.status = status_in.status.value
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
    payment.status = "approved"
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
    payment.status = "rejected"
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
    payment.status = "under_review"
    db.add(payment)
    db.commit()
    return {"status": "success", "message": "Payment escalated"}
