import json
import redis
from web3 import Web3
from app.core.config import settings

try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    redis_client = None
    print(f"Failed to connect to Redis: {e}")

ALLOWED_CHAINS = ["base_sepolia", "polygon_amoy"]
BLOCKED_BRIDGES = ["TornadoCash bridge", "unknown_bridge_1"]

def normalize_chain_name(chain: str) -> str:
    return chain.lower().replace(" ", "_")

def check_chain_allowed(chain: str) -> bool:
    return normalize_chain_name(chain) in ALLOWED_CHAINS

def get_bridge_trust_score(source_chain: str, dest_chain: str) -> float:
    src = normalize_chain_name(source_chain)
    dst = normalize_chain_name(dest_chain)
    
    if src == dst:
        return 1.0
        
    if (src == "base_sepolia" and dst == "polygon_amoy") or (src == "polygon_amoy" and dst == "base_sepolia"):
        return 0.82
        
    return 0.2

def get_gas_estimate(chain: str) -> float:
    chain_norm = normalize_chain_name(chain)
    cache_key = f"gas_estimate_{chain_norm}"
    
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return float(cached)
        except Exception as e:
            print(f"Redis get error: {e}")
            
    try:
        if chain_norm == "base_sepolia":
            w3 = Web3(Web3.HTTPProvider(settings.BASE_SEPOLIA_RPC_URL))
        elif chain_norm == "polygon_amoy":
            w3 = Web3(Web3.HTTPProvider(settings.POLYGON_AMOY_RPC_URL))
        else:
            w3 = None
            
        if w3 and w3.is_connected():
            gas_price_wei = w3.eth.gas_price
            gas_price_gwei = float(w3.from_wei(gas_price_wei, 'gwei'))
        else:
            gas_price_gwei = 0.5  # Default fallback
    except Exception as e:
        print(f"RPC error getting gas for {chain}: {e}")
        gas_price_gwei = 0.5
        
    if redis_client:
        try:
            redis_client.set(cache_key, str(gas_price_gwei), ex=120)  # 2 mins TTL
        except Exception as e:
            print(f"Redis set error: {e}")
        
    return gas_price_gwei

def check_finality(chain: str) -> int:
    chain_norm = normalize_chain_name(chain)
    if chain_norm == "base_sepolia":
        return 12
    elif chain_norm == "polygon_amoy":
        return 128
    return 300

def check_regulator_comfort(chain: str) -> str:
    chain_norm = normalize_chain_name(chain)
    if chain_norm == "base_sepolia":
        return "high"
    elif chain_norm == "polygon_amoy":
        return "medium"
    return "low"

def check_chain(source_chain: str, destination_chain: str) -> dict:
    is_allowed = check_chain_allowed(source_chain) and check_chain_allowed(destination_chain)
    bridge_trust = get_bridge_trust_score(source_chain, destination_chain)
    gas_est = get_gas_estimate(source_chain)
    finality_s = max(check_finality(source_chain), check_finality(destination_chain))
    
    src_comfort = check_regulator_comfort(source_chain)
    dst_comfort = check_regulator_comfort(destination_chain)
    comfort = "low"
    if src_comfort == "high" and dst_comfort == "high":
        comfort = "high"
    elif src_comfort in ["high", "medium"] and dst_comfort in ["high", "medium"]:
        comfort = "medium"
        
    return {
        "is_allowed": is_allowed,
        "bridge_trust_score": bridge_trust,
        "gas_estimate_gwei": gas_est,
        "finality_seconds": finality_s,
        "regulator_comfort": comfort,
        "blocked_bridges": BLOCKED_BRIDGES
    }
