from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.api.v1.endpoints import auth, payments, decisions, approvals, audit, alerts, policy, revalidation, wallet, ai, privacy, execution, monitoring
from app.middleware import RateLimiterMiddleware, RequestLoggerMiddleware
from app.services.compliance.wallet_graph_service import seed_neo4j

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed Neo4j in a background thread so startup is never blocked
    import asyncio
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, seed_neo4j)
    yield

app = FastAPI(
    title="Compliance-Aware Stablecoin Settlement Orchestration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggerMiddleware)
app.add_middleware(RateLimiterMiddleware)

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(payments.router, prefix="/api/v1/payments", tags=["payments"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])
app.include_router(decisions.router, prefix="/api/v1/decisions", tags=["decisions"])
app.include_router(approvals.router, prefix="/api/v1/approvals", tags=["approvals"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
app.include_router(policy.router, prefix="/api/v1/policy", tags=["policy"])
app.include_router(revalidation.router, prefix="/api/v1/revalidation", tags=["revalidation"])
app.include_router(execution.router, prefix="/api/v1/execution", tags=["execution"])
app.include_router(wallet.router, prefix="/api/v1/wallet", tags=["wallet"])
app.include_router(privacy.router, prefix="/api/v1/privacy", tags=["privacy"])
app.include_router(monitoring.router, prefix="/api/v1/monitoring", tags=["monitoring"])
