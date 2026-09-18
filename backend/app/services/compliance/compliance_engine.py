import hashlib
from datetime import datetime, timedelta, timezone
from app.models.payment_intents import PaymentIntent

SANCTIONED_ENTITIES = [
    "tehran trade co",
    "pyongyang exports",
    "moscow shell corp",
    "northern capital llc",
    "crimea holdings",
    "minsk trade partners",
    "havana commodities",
    "damascus finance group",
    "tripoli assets ltd",
    "caracas global trade",
    "tehran metals corp",
    "iran petrochemical co",
    "russia defense exports",
    "belarus state trade",
    "north korea mining"
]

SANCTIONED_WALLETS = [
    "0xdead111111111111111111111111111111111111",
    "0xdead222222222222222222222222222222222222",
    "0xdead333333333333333333333333333333333333",
    "0xdead444444444444444444444444444444444444",
    "0xdead555555555555555555555555555555555555",
    "0xba00000000000000000000000000000000000001",
    "0xba00000000000000000000000000000000000002",
    "0xfade000000000000000000000000000000000001",
    "0xfade000000000000000000000000000000000002",
    "0xcafe000000000000000000000000000000000001",
]

INTERNAL_BLACKLIST = [
    "blacklisted corp",
    "fraud entity inc",
    "shell company xyz",
    "offshore dummy ltd",
    "anonymous holdings"
]

def check_sanctions(company_name: str, wallet_address: str = "") -> dict:
    company_lower = company_name.lower()
    
    # Fuzzy match on company name (contains check)
    for entity in SANCTIONED_ENTITIES:
        if entity.lower() in company_lower or company_lower in entity.lower():
            return {"hit": True, "sanctions_hit": True, "matched_entity": entity, "type": "company"}
            
    # Exact match on wallet address
    if wallet_address:
        if wallet_address.lower() in [w.lower() for w in SANCTIONED_WALLETS]:
            return {"hit": True, "sanctions_hit": True, "matched_entity": wallet_address, "type": "wallet"}
            
    return {"hit": False, "sanctions_hit": False, "matched_entity": None, "type": None}

def check_kyc_status(company_name: str) -> dict:
    company_lower = company_name.lower()
    
    if "verified" in company_lower:
        status = "verified"
        days_until_expiry = 365
    else:
        # Deterministic hash to get 80% pass rate
        hash_val = int(hashlib.md5(company_name.encode()).hexdigest(), 16)
        if hash_val % 100 < 80:
            status = "verified"
            # Random days between 1 and 365 based on hash
            days_until_expiry = (hash_val % 365) + 1
        else:
            status = "missing"
            days_until_expiry = 0
            
    expiry_date = datetime.now(timezone.utc) + timedelta(days=days_until_expiry)
    
    return {
        "kyc_status": status,
        "expiry_date": expiry_date.isoformat(),
        "days_until_expiry": days_until_expiry
    }

def check_internal_blacklist(company_name: str) -> bool:
    company_lower = company_name.lower()
    return any(b.lower() in company_lower for b in INTERNAL_BLACKLIST)

def run_compliance_checks(payment: PaymentIntent) -> dict:
    # Check sender
    sender_sanctions = check_sanctions(payment.sender_company)
    sender_blacklist = check_internal_blacklist(payment.sender_company)
    sender_kyc = check_kyc_status(payment.sender_company)
    
    # Check receiver
    receiver_sanctions = check_sanctions(payment.receiver_company)
    receiver_blacklist = check_internal_blacklist(payment.receiver_company)
    receiver_kyc = check_kyc_status(payment.receiver_company)
    
    sanctions_hit = sender_sanctions["hit"] or receiver_sanctions["hit"]
    blacklist_hit = sender_blacklist or receiver_blacklist
    
    kyc_missing = sender_kyc["kyc_status"] != "verified" or receiver_kyc["kyc_status"] != "verified"
    expired_docs = sender_kyc["days_until_expiry"] <= 0 or receiver_kyc["days_until_expiry"] <= 0
    
    overall = "fail" if (sanctions_hit or blacklist_hit or kyc_missing or expired_docs) else "pass"
    
    return {
        "kyc_status": "verified" if not kyc_missing else "missing",
        "kyb_status": "verified" if not kyc_missing else "missing",
        "sanctions_hit": sanctions_hit,
        "sanctions_details": {
            "sender": sender_sanctions,
            "receiver": receiver_sanctions
        },
        "internal_blacklist_hit": blacklist_hit,
        "expired_docs": expired_docs,
        "kyc_details": {
            "sender": sender_kyc,
            "receiver": receiver_kyc
        },
        "overall": overall
    }
