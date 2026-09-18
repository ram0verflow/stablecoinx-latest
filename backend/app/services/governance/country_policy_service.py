import json
import hashlib
import redis
from sqlalchemy.orm import Session
from app.models.policy_rules import PolicyRule
from app.core.config import settings

# Initialize sync redis client for caching
try:
    redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=0.5, socket_timeout=0.5)
except Exception as e:
    redis_client = None
    print(f"Failed to connect to Redis: {e}")

def _get_all_policy_rules(db: Session):
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
    rules = _get_all_policy_rules(db)
    
    # Find specific rule
    rule = next(
        (r for r in rules if r["source_country"] == source_country and r["destination_country"] == destination_country),
        None
    )
    
    # Check restrictions (sanctions blocked countries)
    sanctions_blocked_countries = ["Russia", "Iran", "North Korea", "Syria", "Cuba", "Belarus"]
    sanctions_restricted = source_country in sanctions_blocked_countries or destination_country in sanctions_blocked_countries
    
    if not rule:
        result = {
            "is_allowed": False,
            "allowed": False,
            "requires_kyc": True,
            "requires_travel_rule": True,
            "reporting_threshold": 0.0,
            "sanctions_restricted": sanctions_restricted,
            "flagged_for_reporting": False,
            "exceeds_reporting_threshold": False,
            "notes": "No policy rule found. Blocked by default.",
            "policy_version": get_current_policy_version(db)
        }
        if purpose.lower() == "payroll":
            payroll_check = check_payroll_constraints(amount, destination_country)
            result["payroll_within_cap"] = payroll_check["is_within_limit"]
        return result

    is_allowed = rule["is_allowed"] and not sanctions_restricted
    flagged_for_reporting = amount > rule["reporting_threshold"]

    result = {
        "is_allowed": is_allowed,
        "allowed": is_allowed,
        "requires_kyc": rule["requires_kyc"],
        "requires_travel_rule": rule["requires_travel_rule"],
        "reporting_threshold": rule["reporting_threshold"],
        "sanctions_restricted": sanctions_restricted,
        "flagged_for_reporting": flagged_for_reporting,
        "exceeds_reporting_threshold": flagged_for_reporting,
        "notes": rule["notes"],
        "policy_version": get_current_policy_version(db)
    }
    if purpose.lower() == "payroll":
        payroll_check = check_payroll_constraints(amount, destination_country)
        result["payroll_within_cap"] = payroll_check["is_within_limit"]
    return result

def check_payroll_constraints(amount: float, destination_country: str) -> dict:
    constraints = {
        "UAE": 25000.0,
        "India": 10000.0
    }
    max_payroll = constraints.get(destination_country, 50000.0)
    return {
        "is_within_limit": amount <= max_payroll,
        "max_allowed": max_payroll,
        "destination_country": destination_country
    }

def check_supplier_restrictions(destination_country: str, purpose: str) -> dict:
    restricted_corridors = ["Russia", "Iran", "North Korea", "Belarus"]
    if purpose.lower() == "supplier" and destination_country in restricted_corridors:
        return {
            "is_allowed": False,
            "reason": f"Supplier payments to {destination_country} are restricted."
        }
    return {
        "is_allowed": True,
        "reason": ""
    }
