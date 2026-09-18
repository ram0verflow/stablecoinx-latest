from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.db.database import get_db
from app.models.compliance_decisions import ComplianceDecision
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.users import User
from app.services.ai.ai_health_service import get_active_ai_engine
from app.services.blockchain.rpc_service import rpc_service
from app.services.compliance.wallet_graph_service import wallet_graph_service
from app.db.redis_client import get_redis

router = APIRouter()


@router.get("/stats")
async def monitoring_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    try:
        now = datetime.now(timezone.utc)
        day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

        total_payments = db.query(func.count(PaymentIntent.id)).scalar() or 0
        approved_today = (
            db.query(func.count(PaymentIntent.id))
            .filter(
                PaymentIntent.status == PaymentStatus.executed,
                PaymentIntent.updated_at >= day_start,
            )
            .scalar()
            or 0
        )
        blocked_today = (
            db.query(func.count(PaymentIntent.id))
            .filter(
                PaymentIntent.status == PaymentStatus.blocked,
                PaymentIntent.updated_at >= day_start,
            )
            .scalar()
            or 0
        )
        pending_review = (
            db.query(func.count(PaymentIntent.id))
            .filter(PaymentIntent.status.in_([PaymentStatus.under_review, PaymentStatus.revalidation]))
            .scalar()
            or 0
        )

        latencies = (
            db.query(ComplianceDecision.ai_latency_ms)
            .filter(ComplianceDecision.ai_latency_ms.isnot(None))
            .all()
        )
        latency_values = []
        for row in latencies:
            try:
                latency_values.append(float(row[0]))
            except Exception:
                continue
        avg_ai_latency_ms = (sum(latency_values) / len(latency_values)) if latency_values else 0.0

        success = (
            db.query(func.count(PaymentIntent.id))
            .filter(PaymentIntent.status == PaymentStatus.executed)
            .scalar()
            or 0
        )
        failed = (
            db.query(func.count(PaymentIntent.id))
            .filter(PaymentIntent.status == PaymentStatus.failed)
            .scalar()
            or 0
        )
        tx_success_rate = (success / (success + failed) * 100.0) if (success + failed) else 0.0

        corridor_rows = (
            db.query(
                PaymentIntent.source_country,
                PaymentIntent.destination_country,
                func.count(PaymentIntent.id).label("count"),
                func.sum(
                    case(
                        (PaymentIntent.status == PaymentStatus.blocked, 1),
                        else_=0,
                    )
                ).label("blocked"),
            )
            .group_by(PaymentIntent.source_country, PaymentIntent.destination_country)
            .order_by(func.count(PaymentIntent.id).desc())
            .limit(8)
            .all()
        )
        top_corridors: List[Dict[str, Any]] = []
        for src, dst, count, blocked in corridor_rows:
            block_rate = (float(blocked or 0) / float(count) * 100.0) if count else 0.0
            top_corridors.append(
                {
                    "corridor": f"{src}->{dst}",
                    "count": int(count),
                    "block_rate": round(block_rate, 2),
                }
            )

        redis_ok = False
        try:
            r = get_redis()
            if r:
                r.ping()
                redis_ok = True
        except Exception:
            redis_ok = False

        neo4j_ok = False
        try:
            if wallet_graph_service.driver:
                wallet_graph_service.driver.verify_connectivity()
                neo4j_ok = True
        except Exception:
            neo4j_ok = False
        ai_engine = get_active_ai_engine()
        ai_engine_status = "down" if ai_engine == "none" else ai_engine

        return {
            "total_payments": int(total_payments),
            "approved_today": int(approved_today),
            "blocked_today": int(blocked_today),
            "pending_review": int(pending_review),
            "avg_ai_latency_ms": round(float(avg_ai_latency_ms), 2),
            "tx_success_rate": round(float(tx_success_rate), 2),
            "top_corridors": top_corridors,
            "ai_engine_status": ai_engine_status,
            "rpc_status": {
                "base_sepolia": rpc_service.check_rpc_health("base_sepolia"),
                "polygon_amoy": rpc_service.check_rpc_health("polygon_amoy"),
            },
            "neo4j_status": neo4j_ok,
            "redis_status": redis_ok,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error fetching monitoring stats: {exc}")


@router.get("/ai-performance")
def ai_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    rows = (
        db.query(
            ComplianceDecision.created_at,
            ComplianceDecision.ai_engine_used,
            ComplianceDecision.ai_latency_ms,
            ComplianceDecision.ai_decision,
        )
        .filter(ComplianceDecision.ai_latency_ms.isnot(None))
        .order_by(ComplianceDecision.created_at.desc())
        .limit(50)
        .all()
    )
    out = []
    for created_at, engine, latency, decision in rows:
        try:
            lat = float(latency)
        except Exception:
            continue
        out.append(
            {
                "timestamp": created_at.isoformat() if created_at else None,
                "engine": engine or "unknown",
                "latency_ms": lat,
                "decision": decision.value if decision else None,
            }
        )
    return {"history": out}


@router.get("/route-efficiency")
def route_efficiency(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    rows = db.query(ComplianceDecision.liquidity_result).all()
    buckets: Dict[str, int] = {}
    for (liquidity,) in rows:
        if not isinstance(liquidity, dict):
            continue
        route = liquidity.get("recommended_route") or liquidity.get("cheapestRoute") or "unknown"
        buckets[route] = buckets.get(route, 0) + 1

    total = sum(buckets.values())
    breakdown = [
        {
            "route": route,
            "count": count,
            "share_pct": round((count / total * 100.0), 2) if total else 0.0,
        }
        for route, count in sorted(buckets.items(), key=lambda x: x[1], reverse=True)
    ]
    return {"total": total, "breakdown": breakdown}
