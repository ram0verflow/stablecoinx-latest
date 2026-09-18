import json
import hashlib
from sqlalchemy.orm import Session
from app.models.policy_rules import PolicyRule
from app.db.redis_client import get_redis

def _get_all_policy_rules(db: Session):
    redis_client = get_redis()
    if redis_client:
        try:
            cached = redis_client.get("policy_rules_cache")
            if cached:
                return json.loads(cached)
        except Exception as e:
            print(f"Redis get error: {e}")

    rules = db.query(PolicyRule).all()
    rules_dict = [
        {
            "source_country": r.source_country,
            "destination_country": r.destination_country,
            "is_allowed": r.is_allowed,
            "requires_kyc": r.requires_kyc,
            "requires_travel_rule": r.requires_travel_rule,
            "reporting_threshold": float(r.reporting_threshold),
            "kyc_expiry_days": r.kyc_expiry_days,
            "notes": r.notes,
            "version_hash": r.version_hash
        }
        for r in rules
    ]
    
    if redis_client:
        try:
            redis_client.set("policy_rules_cache", json.dumps(rules_dict), ex=300)  # 5 minutes TTL
        except Exception as e:
            print(f"Redis set error: {e}")
            
    return rules_dict

def get_current_policy_version(db: Session) -> str:
    rules = _get_all_policy_rules(db)
    if not rules:
        return hashlib.sha256(b"empty_policy").hexdigest()
    
    # Hash all rules concatenated
    rules_str = json.dumps(rules, sort_keys=True)
    return hashlib.sha256(rules_str.encode()).hexdigest()

def check_corridor(
    db: Session,
    source_country: str,
    destination_country: str,
    amount: float = 0.0,
    purpose: str = "",
) -> dict:
    static_cache_key = f"policy:static:{source_country}:{destination_country}"
    redis_client = get_redis()
    static_result = None
    if redis_client:
        try:
            cached = redis_client.get(static_cache_key)
            if cached:
                static_result = json.loads(cached)
        except Exception as e:
            print(f"Redis cache error: {e}")
    if not static_result:
        rule = db.query(PolicyRule).filter(
            PolicyRule.source_country == source_country,
            PolicyRule.destination_country == destination_country
        ).first()
        if not rule:
            static_result = {
                "is_allowed": False,
                "requires_kyc": True,
                "requires_travel_rule": False,
                "reporting_threshold": 10000.0,
                "notes": "No policy rule found — defaulting to blocked",
                "policy_version": "default"
            }
        else:
            static_result = {
                "is_allowed": rule.is_allowed,
                "requires_kyc": rule.requires_kyc,
                "requires_travel_rule": rule.requires_travel_rule,
                "reporting_threshold": float(rule.reporting_threshold or 10000),
                "notes": rule.notes or "",
                "policy_version": rule.version_hash or "v1"
            }
        if redis_client:
            try:
                redis_client.setex(static_cache_key, 300, json.dumps(static_result))
            except Exception as e:
                print(f"Redis set error: {e}")
    reporting_threshold = static_result.get("reporting_threshold", 10000)
    flagged_for_reporting = amount > reporting_threshold
    payroll_within_cap = True
    if purpose and purpose.lower() == "payroll":
        payroll_cap = check_payroll_constraints(amount, destination_country).get("max_allowed", 50000.0)
        payroll_within_cap = amount <= payroll_cap
    return {
        **static_result,
        "amount": amount,
        "flagged_for_reporting": flagged_for_reporting,
        "exceeds_reporting_threshold": flagged_for_reporting,
        "payroll_within_cap": payroll_within_cap,
        "sanctions_restricted": not static_result["is_allowed"],
    }

def check_payroll_constraints(amount: float, destination_country: str) -> dict:
    # In a real system, these would be in the policy_rules table or a separate constraints table.
    # For now, we use a slightly more robust way than a hardcoded dict in the function.
    MAX_PAYROLL_CAP = 50000.0
    constraints = {
        "UAE": 25000.0,
        "India": 10000.0,
        "SG": 30000.0,
        "UK": 40000.0
    }
    max_allowed = constraints.get(destination_country, MAX_PAYROLL_CAP)
    return {
        "is_within_limit": amount <= max_allowed,
        "max_allowed": max_allowed,
        "destination_country": destination_country
    }
