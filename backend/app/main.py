from contextlib import asynccontextmanager  # FIXED: S3

from fastapi import FastAPI  # FIXED: S3
from fastapi.middleware.cors import CORSMiddleware  # FIXED: S2
from slowapi import _rate_limit_exceeded_handler  # FIXED: S3
from slowapi.errors import RateLimitExceeded  # FIXED: S3
from slowapi.middleware import SlowAPIMiddleware  # FIXED: S3

from app.api.v1.endpoints import auth, payments, decisions, approvals, audit, alerts, policy, revalidation, wallet, ai, privacy, execution, monitoring, reports, obfuscation, mixer_signals, policy_engine  # FIXED: S3
from app.core.config import settings  # FIXED: S2
from app.core.rate_limit import limiter  # FIXED: S3
from app.middleware import RateLimiterMiddleware, RequestLoggerMiddleware  # FIXED: S3
from app.services.compliance.wallet_graph_service import seed_neo4j  # FIXED: S3

settings.validate_config()  # FIXED: S3


def _startup_seed_and_graph() -> None:
    """Neo4j graph seed + SQL seed (demo/development only). Never raises."""
    import logging
    import os

    log = logging.getLogger(__name__)
    try:
        from app.db.database import Base, engine as db_engine

        # Alembic's migration history (backend/alembic/versions) predates
        # most of this schema and was never kept current, so it can't be
        # relied on for a fresh deploy. create_all() only creates tables
        # that don't exist yet — safe to run unconditionally (Postgres
        # included) rather than only for local SQLite.
        Base.metadata.create_all(bind=db_engine)
        log.info("Database schema created/verified (create_all)")
    except Exception as exc:
        log.warning("Schema create skipped: %s", exc)
    try:
        seed_neo4j()
    except Exception as exc:
        log.warning("Neo4j startup seed skipped: %s", exc)
    if settings.APP_ENV not in ("demo", "development"):
        return
    try:
        from app.db.seed import seed_db

        seed_db()
    except Exception as exc:
        log.warning("SQL startup seed skipped: %s", exc)


@asynccontextmanager  # FIXED: S3
async def lifespan(app: FastAPI):  # FIXED: S3
    import asyncio  # FIXED: S3

    loop = asyncio.get_event_loop()  # FIXED: S3
    loop.run_in_executor(None, _startup_seed_and_graph)  # FIXED: S3
    yield  # FIXED: S3


app = FastAPI(  # FIXED: S3
    title="Compliance-Aware Stablecoin Settlement Orchestration",  # FIXED: S3
    version="1.0.0",  # FIXED: S3
    lifespan=lifespan,  # FIXED: S3
)  # FIXED: S3
app.state.limiter = limiter  # FIXED: S3
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # FIXED: S3
app.add_middleware(SlowAPIMiddleware)  # FIXED: S3

app.add_middleware(  # FIXED: S2
    CORSMiddleware,  # FIXED: S2
    allow_origins=settings.cors_allowed_origins_list,  # FIXED: S2
    allow_credentials=True,  # FIXED: S2
    allow_methods=["*"],  # FIXED: S2
    allow_headers=["*"],  # FIXED: S2
)  # FIXED: S2
app.add_middleware(RequestLoggerMiddleware)  # FIXED: S3
app.add_middleware(RateLimiterMiddleware)  # FIXED: S3


def _health_payload() -> dict:
    """Liveness + dependency probes (no secrets)."""
    import logging
    from sqlalchemy import text

    from app.db.database import engine
    from app.db.redis_client import get_redis

    log = logging.getLogger(__name__)
    checks: dict = {}
    status = "ok"

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception as exc:
        log.warning("Health DB check failed: %s", exc)
        checks["database"] = False
        status = "degraded"

    try:
        r = get_redis()
        if r is not None:
            r.ping()
            checks["redis"] = True
        else:
            checks["redis"] = False
    except Exception as exc:
        log.warning("Health Redis check failed: %s", exc)
        checks["redis"] = False

    return {"status": status, "version": "1.0.0", "checks": checks}


@app.get("/health")  # FIXED: S3
def health_check():  # FIXED: S3
    return _health_payload()  # FIXED: S3


@app.get("/api/v1/health")  # FIXED: PHASE10
def api_v1_health():  # FIXED: PHASE10
    return _health_payload()  # FIXED: PHASE10


app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])  # FIXED: S3
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])  # FIXED: S3
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])  # FIXED: S3
app.include_router(decisions.router, prefix="/api/v1/decisions", tags=["decisions"])  # FIXED: S3
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["approvals"])  # FIXED: S3
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])  # FIXED: S3
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])  # FIXED: S3
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])  # FIXED: S3
app.include_router(policy.router, prefix="/api/v1/policy", tags=["policy"])  # FIXED: S3
app.include_router(revalidation.router, prefix="/api/v1/revalidation", tags=["revalidation"])  # FIXED: S3
app.include_router(execution.router, prefix="/api/v1/execution", tags=["execution"])  # FIXED: S3
app.include_router(wallet.router, prefix="/api/v1/wallet", tags=["wallet"])  # FIXED: S3
app.include_router(privacy.router, prefix="/api/v1/privacy", tags=["privacy"])  # FIXED: S3
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["monitoring"])  # FIXED: S3
app.include_router(obfuscation.router, prefix="/api/v1/obfuscation", tags=["obfuscation"])
app.include_router(mixer_signals.router, prefix="/api/v1/mixer-signals", tags=["mixer-signals"])
app.include_router(policy_engine.router, prefix="/api/v1/policy-engine", tags=["policy-engine"])
