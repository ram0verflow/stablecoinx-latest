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


def _trigger_response(  # FIXED: H5
    flagged_count: int = 0,  # FIXED: H5
    triggered_count: int = 0,  # FIXED: H5
    message: str = "",  # FIXED: H5
    **extra,  # FIXED: H5
) -> dict:  # FIXED: H5
    payload = {  # FIXED: H5
        "status": "ok",  # FIXED: H5
        "flagged_count": int(flagged_count),  # FIXED: H5
        "triggered_count": int(triggered_count),  # FIXED: H5
        "message": message or "Revalidation task queued",  # FIXED: H5
    }  # FIXED: H5
    payload.update(extra)  # FIXED: H5
    return payload  # FIXED: H5


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
async def trigger_revalidation(
    data: RevalidationTrigger,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """Trigger revalidation based on trigger_type in request body."""
    trigger_type = data.trigger_type if hasattr(data, "trigger_type") else "sanctions"
    if trigger_type == "sanctions":
        background_tasks.add_task(
            _run_async_in_thread, RevalidationEngine.trigger_sanctions_update_revalidation
        )
        return _trigger_response(triggered_count=1, trigger_type="sanctions")
    if trigger_type == "policy":
        corridors = data.corridors if hasattr(data, "corridors") else []
        background_tasks.add_task(
            _run_async_in_thread,
            RevalidationEngine.trigger_policy_change_revalidation,
            corridors,
        )
        return _trigger_response(triggered_count=len(corridors), trigger_type="policy", corridors=corridors)
    if trigger_type == "wallet":
        wallets = data.wallets if hasattr(data, "wallets") else []
        background_tasks.add_task(
            _run_async_in_thread,
            RevalidationEngine.trigger_wallet_intelligence_revalidation,
            wallets,
        )
        return _trigger_response(triggered_count=len(wallets), trigger_type="wallet", wallets=wallets)
    if trigger_type == "issuer":
        token = data.token if hasattr(data, "token") and data.token else "USDT"
        risk_level = (
            data.risk_level if hasattr(data, "risk_level") and data.risk_level else "high"
        )
        background_tasks.add_task(
            _run_async_in_thread,
            RevalidationEngine.trigger_issuer_risk_revalidation,
            token,
            risk_level,
        )
        return _trigger_response(triggered_count=1, trigger_type="issuer", token=token, risk_level=risk_level)
    if trigger_type == "all":
        background_tasks.add_task(
            _run_async_in_thread, RevalidationEngine.trigger_sanctions_update_revalidation
        )
        background_tasks.add_task(
            _run_async_in_thread,
            RevalidationEngine.trigger_wallet_intelligence_revalidation,
            [],
        )
        return _trigger_response(triggered_count=2, trigger_type="all")
    raise HTTPException(
        status_code=400,
        detail=(
            f"Unknown trigger_type: {trigger_type}. "
            "Valid values: sanctions, policy, wallet, issuer, all"
        ),
    )


@router.post("/trigger/sanctions")
async def trigger_sanctions(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_sanctions_update_revalidation,
    )
    return _trigger_response(triggered_count=1, trigger_type="sanctions")


@router.post("/trigger/policy")
async def trigger_policy(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    corridors = data.get("corridors", [])
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_policy_change_revalidation,
        corridors,
    )
    return _trigger_response(triggered_count=len(corridors), trigger_type="policy", corridors=corridors)


@router.post("/trigger/wallet")
async def trigger_wallet(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    wallets = data.get("wallets", [])
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_wallet_intelligence_revalidation,
        wallets,
    )
    return _trigger_response(triggered_count=len(wallets), trigger_type="wallet", wallets=wallets)


@router.post("/trigger/issuer")
async def trigger_issuer(
    data: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    token = data.get("token", "USDT")
    risk_level = data.get("risk_level", "high")
    background_tasks.add_task(
        _run_async_in_thread,
        RevalidationEngine.trigger_issuer_risk_revalidation,
        token,
        risk_level,
    )
    return _trigger_response(triggered_count=1, trigger_type="issuer", token=token, risk_level=risk_level)


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
