from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from app.models.payment_intents import PaymentIntent, PaymentStatus

def check_daily_spend_limit(db: Session, sender_company: str, amount: float) -> dict:
    today = datetime.now(timezone.utc).date()
    
    # Query sum of all approved/executed payments by sender today
    # Note: we filter by created_at date for simplicity
    total_spent = db.query(func.sum(PaymentIntent.amount)).filter(
        PaymentIntent.sender_company == sender_company,
        PaymentIntent.status.in_([PaymentStatus.approved, PaymentStatus.executed]),
        func.date(PaymentIntent.created_at) == today
    ).scalar() or 0.0
    
    total_spent = float(total_spent)
    daily_limit = 500000.0
    remaining_limit = max(0.0, daily_limit - total_spent)
    
    return {
        "is_within_limit": (total_spent + amount) <= daily_limit,
        "remaining_limit": remaining_limit,
        "daily_limit": daily_limit,
        "total_spent_today": total_spent
    }

def check_dual_approval_required(amount: float) -> bool:
    return amount > 100000.0

def check_vendor_approved(receiver_company: str) -> dict:
    approved_vendors = [
        "TechNova Solutions", "Global Logistics Inc", "Apex Marketing",
        "Prime Materials", "Quantum Computing Corp", "CloudSync Systems",
        "Alpha Omega Consulting", "Pinnacle Designs", "NextGen Software",
        "Elevate Services", "Nexus Distribution", "Vanguard Security",
        "Orbit Technologies", "Horizon Healthcare", "Summit Financial",
        "Crestwood Manufacturing", "Starlight Media", "Echo Communications",
        "Radiant Energy", "Velocity Transport"
    ]
    
    is_approved = receiver_company in approved_vendors
    
    return {
        "is_approved": is_approved,
        "vendor_status": "approved" if is_approved else "unregistered"
    }

def check_department_budget(purpose: str, amount: float) -> dict:
    purpose_lower = purpose.lower()
    
    if "payroll" in purpose_lower:
        budget = 200000.0
    elif "supplier" in purpose_lower:
        budget = 300000.0
    elif "treasury" in purpose_lower:
        budget = float('inf')
    else:
        budget = 100000.0  # default budget for unknown purposes
        
    return {
        "within_budget": amount <= budget,
        "remaining_budget": max(0.0, budget - amount) if budget != float('inf') else "Unlimited"
    }

def check_payroll_batch_cap(amount: float) -> dict:
    payroll_cap = 50000.0
    return {
        "is_within_cap": amount <= payroll_cap,
        "batch_cap": payroll_cap
    }

def check_treasury_controls(db: Session, payment: PaymentIntent) -> dict:
    amount = float(payment.amount)
    
    daily_spend = check_daily_spend_limit(db, payment.sender_company, amount)
    dual_approval = check_dual_approval_required(amount)
    vendor_approval = check_vendor_approved(payment.receiver_company)
    dept_budget = check_department_budget(payment.purpose, amount)
    
    payroll_cap_ok = True
    if "payroll" in payment.purpose.lower():
        payroll_cap_ok = check_payroll_batch_cap(amount)["is_within_cap"]
        
    return {
        "daily_limit_ok": daily_spend["is_within_limit"],
        "daily_limit_details": daily_spend,
        "dual_approval_required": dual_approval,
        "vendor_approved": vendor_approval["is_approved"],
        "vendor_details": vendor_approval,
        "department_budget_ok": dept_budget["within_budget"],
        "department_budget_details": dept_budget,
        "payroll_cap_ok": payroll_cap_ok
    }
