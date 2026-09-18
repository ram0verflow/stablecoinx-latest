import json
import redis
from app.core.config import settings

try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    redis_client = None
    print(f"Failed to connect to Redis: {e}")

def get_issuer_risk(token: str) -> dict:
    token_upper = token.upper()
    cache_key = f"issuer_risk_{token_upper}"
    
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis get error: {e}")
            
    if token_upper == "USDC":
        result = {
            "token": "USDC",
            "issuer": "Circle",
            "issuer_freeze_risk": "low",
            "depeg_risk_score": 0.01,
            "redemption_trust": "high",
            "liquidity_depth": "deep",
            "regulatory_comfort": "high",
            "recommendation": "preferred",
            "score": 0.95
        }
    elif token_upper == "USDT":
        result = {
            "token": "USDT",
            "issuer": "Tether",
            "issuer_freeze_risk": "medium",
            "depeg_risk_score": 0.03,
            "redemption_trust": "medium",
            "liquidity_depth": "deep",
            "regulatory_comfort": "medium",
            "recommendation": "acceptable",
            "score": 0.78
        }
    else:
        result = {
            "token": token_upper,
            "issuer": "Unknown",
            "issuer_freeze_risk": "high",
            "depeg_risk_score": 0.1,
            "redemption_trust": "low",
            "liquidity_depth": "shallow",
            "regulatory_comfort": "low",
            "recommendation": "avoid",
            "score": 0.20
        }
        
    if redis_client:
        try:
            redis_client.set(cache_key, json.dumps(result), ex=1800)  # 30 mins TTL
        except Exception as e:
            print(f"Redis set error: {e}")
        
    return result

def compare_tokens(tokens_list: list) -> list:
    results = [get_issuer_risk(t) for t in tokens_list]
    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results
