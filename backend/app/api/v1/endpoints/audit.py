from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID
import io

from app.db.database import get_db
from app.schemas import AuditRecordResponse
from app.models.audit_records import AuditRecord
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.reports.report_service import AuditReportService

router = APIRouter()


# NOTE: All fixed-path routes MUST come before parameterized routes
# so that /list, /reports/{id}, /generate-all don't get captured by /{id}

@router.get("/list")
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    """List all generated audit reports with pagination."""
    try:
        payments = db.query(PaymentIntent).filter(
            PaymentIntent.status.in_([
                PaymentStatus.approved,
                PaymentStatus.executed,
            ])
        ).offset(skip).limit(limit).all()

        reports = []
        for payment in payments:
            audit_record = db.query(AuditRecord).filter(
                AuditRecord.payment_id == payment.id
            ).first()
            
            # Fetch the most recent compliance decision for the ai_decision
            from app.models.compliance_decisions import ComplianceDecision
            decision = db.query(ComplianceDecision).filter(
                ComplianceDecision.payment_id == payment.id
            ).order_by(ComplianceDecision.created_at.desc()).first()

            if audit_record:
                reports.append({
                    "payment_id": str(payment.id),
                    "audit_record_id": str(audit_record.id),
                    "created_at": payment.created_at,
                    "amount": str(payment.amount),
                    "token": payment.token,
                    "corridor": f"{payment.source_country} → {payment.destination_country}",
                    "status": payment.status.value,
                    "ai_decision": (decision.ai_decision.value if decision and decision.ai_decision else "N/A"),
                    "zk_proof": audit_record.zk_proof_reference or audit_record.on_chain_proof_hash or "Not Generated",
                })

        return {"total": len(reports), "reports": reports}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing reports: {str(e)}")


@router.get("/reports/{payment_id}")
def generate_report(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Generate and download PDF audit report for a payment."""
    try:
        payment = db.query(PaymentIntent).filter(
            PaymentIntent.id == payment_id
        ).first()

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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")


@router.post("/generate-all")
def batch_generate_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Batch generate PDF reports for all settled payments."""
    try:
        payments = db.query(PaymentIntent).filter(
            PaymentIntent.status.in_([
                PaymentStatus.approved,
                PaymentStatus.executed,
            ])
        ).all()

        generated_count = 0
        failed_count = 0

        for payment in payments:
            try:
                pdf_bytes = AuditReportService.generate_audit_report(db, payment.id)
                if pdf_bytes:
                    generated_count += 1
            except Exception:
                failed_count += 1
                continue

        return {
            "message": "Batch generation complete",
            "generated": generated_count,
            "failed": failed_count,
            "total": len(payments),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error batch generating reports: {str(e)}")


@router.get("/", response_model=List[AuditRecordResponse])
def get_audit_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    records = db.query(AuditRecord).order_by(AuditRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.get("/{id}", response_model=AuditRecordResponse)
def get_audit_record(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    record = db.query(AuditRecord).filter(AuditRecord.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Audit record not found")
    return record
