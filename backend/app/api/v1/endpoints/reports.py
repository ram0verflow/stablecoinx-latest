from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.payment_intents import PaymentIntent
from app.models.users import User
from app.services.reports.report_service import AuditReportService

router = APIRouter()


@router.get("/{payment_id}")
def get_payment_report(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    pdf_bytes = AuditReportService.generate_audit_report(db, payment_id)
    if not pdf_bytes:
        raise HTTPException(status_code=500, detail="Failed to generate report")
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=audit_report_{payment_id}.pdf"},
    )
