from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID

from app.db.database import get_db
from app.schemas import AlertResponse, AlertMarkRead
from app.models.alerts import Alert
from app.api.dependencies import get_current_user
from app.models.users import User

router = APIRouter()

@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
    return alerts

@router.patch("/{id}/read", response_model=AlertResponse)
def mark_alert_read_patch(
    id: UUID,
    update_data: AlertMarkRead,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = update_data.is_read
    db.commit()
    db.refresh(alert)
    return alert

@router.post("/{id}/read", response_model=AlertResponse)
def mark_alert_read_post(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """POST version of mark-read for frontend compatibility."""
    alert = db.query(Alert).filter(Alert.id == id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert
