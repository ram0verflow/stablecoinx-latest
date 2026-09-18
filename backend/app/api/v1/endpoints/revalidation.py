"""
Revalidation API endpoints.
All trigger endpoints return immediately and run work in background threads.
FastAPI automatically runs sync background tasks in a thread pool.
"""

import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any, List
from uuid import UUID
from pydantic import BaseModel

from app.db.database import get_db, SessionLocal
from app.schemas import RevalidationResponse, RevalidationTrigger
from app.models.revalidation_records import RevalidationRecord
from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.revalidation.revalidation_engine import RevalidationEngine

logger = logging.getLogger(__name__)
router = APIRouter()


class PolicyChangeRequest(BaseModel):
    corridors: List[str]


class WalletIntelligenceRequest(BaseModel):
    wallets: List[str]


class IssuerRiskRequest(BaseModel):
    token: str
    risk_level: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_async_in_thread(coro_factory, *args):
    """
    Run an async coroutine in a fresh event loop inside a thread.
    Used by sync background task wrappers.
    """
    db = SessionLocal()
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(coro_factory(db, *args))
        finally:
            loop.close()
    except Exception as exc:
        logger.error(f"Revalidation background task error: {exc}")
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[RevalidationResponse])
def get_revalidation_records(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> Any:
    return (
        db.query(RevalidationRecord)
        .order_by(RevalidationRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/trigger")
def trigger_revalidation(
    data: RevalidationTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Manually trigger all revalidation checks (background)."""
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_sanctions_update_revalidation,
    )
    return {"status": "triggered", "trigger_type": "manual_all",
            "message": "Revalidation running in background"}


@router.post("/trigger/sanctions")
def trigger_sanctions_revalidation(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Trigger sanctions list update revalidation (background)."""
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_sanctions_update_revalidation,
    )
    return {"status": "triggered", "trigger_type": "sanctions_update",
            "message": "Sanctions revalidation running in background"}


@router.post("/trigger/policy")
def trigger_policy_revalidation(
    request: PolicyChangeRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Trigger policy rules change revalidation (background)."""
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_policy_change_revalidation,
        request.corridors,
    )
    return {"status": "triggered", "trigger_type": "policy_change",
            "corridors": request.corridors,
            "message": "Revalidation running in background"}


@router.post("/trigger/wallet")
def trigger_wallet_revalidation(
    request: WalletIntelligenceRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Trigger wallet intelligence update revalidation (background)."""
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_wallet_intelligence_revalidation,
        request.wallets,
    )
    return {"status": "triggered", "trigger_type": "wallet_intelligence",
            "wallet_count": len(request.wallets),
            "message": "Revalidation running in background"}


@router.post("/trigger/issuer")
def trigger_issuer_revalidation(
    request: IssuerRiskRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Trigger issuer risk change revalidation (background)."""
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_issuer_risk_revalidation,
        request.token,
        request.risk_level,
    )
    return {"status": "triggered", "trigger_type": "issuer_risk",
            "token": request.token, "risk_level": request.risk_level,
            "message": "Issuer revalidation running in background"}


@router.get("/stats/summary")
def get_revalidation_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get revalidation statistics."""
    try:
        return RevalidationEngine.get_revalidation_stats(db)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching stats: {exc}")


@router.get("/{revalidation_id}")
def get_revalidation_detail(
    revalidation_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get a specific revalidation record."""
    record = db.query(RevalidationRecord).filter(
        RevalidationRecord.id == revalidation_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Revalidation record not found")
    return {
        "id": str(record.id),
        "payment_id": str(record.payment_id),
        "trigger_reason": record.trigger_reason,
        "original_decision": record.original_decision,
        "new_decision": record.new_decision,
        "new_risk_score": float(record.new_risk_score) if record.new_risk_score else None,
        "status": record.status.value,
        "created_at": record.created_at.isoformat(),
        "decision_changed": record.original_decision != record.new_decision,
    }


@router.post("/rescore/{payment_id}")
def rescore_single_payment(
    payment_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Manually rescore a single payment (background)."""
    def _rescore(pid: UUID):
        _db = SessionLocal()
        try:
            RevalidationEngine.rescore_payment(_db, pid)
        except Exception as exc:
            logger.error(f"Rescore error for {pid}: {exc}")
        finally:
            _db.close()

    background_tasks.add_task(_rescore, payment_id)
    return {
        "payment_id": str(payment_id),
        "status": "rescore_triggered",
        "message": "Rescore running in background.",
    }
