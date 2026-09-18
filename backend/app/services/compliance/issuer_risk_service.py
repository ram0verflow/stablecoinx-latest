import json
import logging
from typing import Optional

import redis
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.issuer_profiles import IssuerProfile

logger = logging.getLogger(__name__)

try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    redis_client = None
    logger.warning("Failed to connect to Redis: %s", e)

def get_issuer_risk(db: Session, token: str) -> dict:
    token_upper = token.upper()
    cache_key = f"issuer_risk_{token_upper}"
    
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning("Redis get error: %s", e)
            
    # FIXED: M5
    profile = (
        db.query(IssuerProfile)
        .filter(
            IssuerProfile.is_active.is_(True),
            or_(
                IssuerProfile.issuer_id == token_upper,
                IssuerProfile.token == token_upper,
            ),
        )
        .first()
    )
    if not profile:
        result = {
            "token": token_upper,
            "issuer": "Unknown",
            "issuer_freeze_risk": "high",
            "depeg_risk_score": 1.0,
            "redemption_trust": "low",
            "liquidity_depth": "low",
            "regulatory_comfort": "low",
            "recommendation": "avoid",
            "score": 0.0,
            "risk_level": "critical",
        }
    else:
        result = {
            "token": profile.token,
            "issuer": profile.issuer,
            "issuer_freeze_risk": profile.issuer_freeze_risk,
            "depeg_risk_score": profile.depeg_risk_score,
            "redemption_trust": profile.redemption_trust,
            "liquidity_depth": profile.liquidity_depth,
            "regulatory_comfort": profile.regulatory_comfort,
            "recommendation": profile.recommendation,
            "score": profile.score,
            "risk_level": profile.risk_level,
        }
        
    if redis_client:
        try:
            redis_client.set(cache_key, json.dumps(result), ex=1800)  # 30 mins TTL
        except Exception as e:
            logger.warning("Redis set error: %s", e)
        
    return result


def _active_issuer_profile_for_token(db: Session, token: str) -> Optional[IssuerProfile]:
    token_norm = (token or "").strip().upper()
    if not token_norm:
        return None
    return (
        db.query(IssuerProfile)
        .filter(
            IssuerProfile.is_active.is_(True),
            or_(
                IssuerProfile.issuer_id == token_norm,
                IssuerProfile.token == token_norm,
            ),
        )
        .first()
    )


def compare_tokens(db: Session, token_a: str, token_b: str) -> dict:
    """Compare two tokens (symbol or issuer_id) using persisted issuer profiles."""
    prof_a = _active_issuer_profile_for_token(db, token_a)
    prof_b = _active_issuer_profile_for_token(db, token_b)
    if not prof_a:
        raise ValueError(f"IssuerProfile not found for {token_a}")
    if not prof_b:
        raise ValueError(f"IssuerProfile not found for {token_b}")

    def _payload(p: IssuerProfile) -> dict:
        return {
            "issuer_id": p.issuer_id,
            "risk_score": float(p.score),
            "jurisdiction": p.jurisdiction,
            "is_sanctioned": bool(p.is_sanctioned),
        }

    out_a = _payload(prof_a)
    out_b = _payload(prof_b)
    ra, rb = out_a["risk_score"], out_b["risk_score"]
    if ra > rb + 1e-9:
        higher = "token_a"
    elif rb > ra + 1e-9:
        higher = "token_b"
    else:
        higher = "equal"

    if out_a["is_sanctioned"] or out_b["is_sanctioned"]:
        recommendation = "reject"
    elif out_a["risk_score"] > 0.7 or out_b["risk_score"] > 0.7:
        recommendation = "manual_review"
    else:
        recommendation = "proceed"

    return {
        "token_a": out_a,
        "token_b": out_b,
        "higher_risk": higher,
        "recommendation": recommendation,
    }
