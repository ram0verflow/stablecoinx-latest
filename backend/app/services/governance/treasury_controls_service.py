from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone
from app.models.payment_intents import PaymentIntent, PaymentStatus
from app.models.treasury_controls import ApprovedVendor, TreasuryDepartmentBudget  # FIXED: M5
from app.models.treasury_policy import TreasuryPolicy  # FIXED: M5
from app.core.config import settings

def check_daily_spend_limit(db: Session, sender_company: str, amount: float) -> dict:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    
    # Query sum of all approved/executed payments by sender today
    # Note: we filter by created_at date for simplicity
    total_spent = db.query(func.sum(PaymentIntent.amount)).filter(
        PaymentIntent.sender_company == sender_company,
        PaymentIntent.status.in_([PaymentStatus.approved, PaymentStatus.executed]),
        PaymentIntent.created_at >= today_start
    ).scalar() or 0.0
    
    total_spent = float(total_spent)
    daily_limit = float(settings.TREASURY_DAILY_LIMIT)  # FIXED: M5
    remaining_limit = max(0.0, daily_limit - total_spent)
    
    return {
        "is_within_limit": (total_spent + amount) <= daily_limit,
        "remaining_limit": remaining_limit,
        "daily_limit": daily_limit,
        "total_spent_today": total_spent
    }

def check_dual_approval_required(amount: float) -> bool:
    return amount > 100000.0

def check_vendor_approved(db: Session, receiver_company: str) -> dict:
    name_lower = receiver_company.lower().strip()
    is_approved = False
    vendor = (
        db.query(ApprovedVendor)
        .filter(
            ApprovedVendor.is_active.is_(True),
            func.lower(ApprovedVendor.vendor_name) == name_lower,
        )
        .first()
    )
    if vendor:
        is_approved = True

    return {
        "is_approved": is_approved,
        "vendor_status": "approved" if is_approved else "unregistered",
        "vendor_name": receiver_company,
        "requires_additional_review": not is_approved,
    }

def check_department_budget(db: Session, purpose: str, amount: float) -> dict:
    purpose_lower = purpose.lower()  # FIXED: M5
    policies = db.query(TreasuryPolicy).filter(TreasuryPolicy.is_active.is_(True)).all()  # FIXED: M5
    budget = float(settings.TREASURY_DAILY_LIMIT)  # FIXED: M5
    matched = None  # FIXED: M5
    for row in policies:  # FIXED: M5
        dept = (row.department or "").lower()  # FIXED: M5
        if dept and (dept in purpose_lower or purpose_lower in dept):  # FIXED: M5
            matched = row  # FIXED: M5
            break  # FIXED: M5
    if matched is not None:  # FIXED: M5
        budget = float(matched.budget_limit)  # FIXED: M5
    elif policies:  # FIXED: M5
        budget = float(max(float(p.budget_limit) for p in policies))  # FIXED: M5
    else:
        budget_row = (
            db.query(TreasuryDepartmentBudget)
            .filter(
                TreasuryDepartmentBudget.is_active.is_(True),
                TreasuryDepartmentBudget.purpose_key == purpose_lower,
            )
            .first()
        )
        if not budget_row:
            budget_row = (
                db.query(TreasuryDepartmentBudget)
                .filter(
                    TreasuryDepartmentBudget.is_active.is_(True),
                    TreasuryDepartmentBudget.purpose_key == "__default__",
                )
                .first()
            )
        if budget_row:
            budget = float(budget_row.budget_limit)

    return {
        "within_budget": amount <= budget,
        "remaining_budget": max(0.0, budget - amount),
        "budget_limit": budget,
    }

def check_payroll_batch_cap(amount: float) -> dict:
    payroll_cap = float(settings.PAYROLL_BATCH_CAP)
    return {
        "is_within_cap": amount <= payroll_cap,
        "batch_cap": payroll_cap
    }

def check_treasury_controls(db: Session, payment: PaymentIntent) -> dict:
    # FIXED: M5
    amount = float(payment.amount)
    
    daily_spend = check_daily_spend_limit(db, payment.sender_company, amount)
    dual_approval = check_dual_approval_required(amount)
    vendor_approval = check_vendor_approved(db, payment.receiver_company)
    dept_budget = check_department_budget(db, payment.purpose, amount)
    
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
