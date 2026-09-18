from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Any
from uuid import UUID

from app.db.database import get_db
from app.models.payment_intents import PaymentIntent
from app.models.compliance_decisions import ComplianceDecision
from app.api.dependencies import get_current_user
from app.models.users import User
from app.services.ai.ai_health_service import get_active_ai_engine, check_ollama_health, check_groq_health
from app.core.config import settings
from app.api.v1.endpoints.payments import process_payment_background

router = APIRouter()

@router.get("/health")
def get_health() -> Any:
    ollama_ok, ollama_latency = check_ollama_health()
    groq_ok, groq_latency = check_groq_health()
    engine = get_active_ai_engine()
    return {
        "ollama_active": ollama_ok,
        "groq_active": groq_ok,
        "active_engine": engine,
        "ollama_model": settings.OLLAMA_MODEL.strip(),
        "groq_model": settings.GROQ_MODEL.strip(),
        "ollama_latency_ms": ollama_latency,
        "groq_latency_ms": groq_latency,
    }

@router.post("/analyze/{payment_id}")
def analyze_payment(
    payment_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    payment = db.query(PaymentIntent).filter(PaymentIntent.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    background_tasks.add_task(process_payment_background, payment.id)
    return {"message": "AI analysis triggered successfully"}

@router.get("/decision/{payment_id}")
def get_decision(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    decision = db.query(ComplianceDecision).filter(ComplianceDecision.payment_id == payment_id).order_by(ComplianceDecision.created_at.desc()).first()
    if not decision:
        raise HTTPException(status_code=404, detail="No AI decision found for this payment")
        
    return {
        "decision": decision.ai_decision,
        "confidence": decision.ai_confidence,
        "reasoning": decision.ai_reasoning,
        "flags": decision.ai_flags,
        "alternatives": decision.ai_alternatives,
        "engine_used": decision.ai_engine_used,
        "prompt_tokens": decision.ai_prompt_tokens,
        "latency_ms": decision.ai_latency_ms,
        "risk_summary": decision.ai_risk_summary
    }
