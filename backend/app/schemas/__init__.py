from datetime import datetime
from typing import Optional
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


# ── Enums ─────────────────────────────────────────────────────
class UserRoleEnum(str, Enum):
    admin = "admin"
    treasury_officer = "treasury_officer"
    compliance_officer = "compliance_officer"
    auditor = "auditor"
    reviewer = "reviewer"


class PaymentStatusEnum(str, Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    executed = "executed"
    blocked = "blocked"
    revalidation = "revalidation"


class AIDecisionEnum(str, Enum):
    direct_transfer = "direct_transfer"
    alternate_chain = "alternate_chain"
    alternate_token = "alternate_token"
    delay = "delay"
    split = "split"
    review = "review"
    block = "block"


class FinalDecisionEnum(str, Enum):
    approved = "approved"
    rejected = "rejected"
    blocked = "blocked"
    pending_review = "pending_review"


class ApprovalActionEnum(str, Enum):
    approve = "approve"
    reject = "reject"
    escalate = "escalate"


class AlertTypeEnum(str, Enum):
    approved = "approved"
    blocked = "blocked"
    review_needed = "review_needed"
    revalidation_triggered = "revalidation_triggered"


class RevalidationStatusEnum(str, Enum):
    pending = "pending"
    completed = "completed"


# ── User Schemas ──────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: UserRoleEnum = UserRoleEnum.reviewer


class UserLogin(BaseModel):
    email: str
    password: str
    role: Optional[UserRoleEnum] = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRoleEnum
    is_active: bool
    wallet_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Payment Schemas ───────────────────────────────────────────
class PaymentCreate(BaseModel):
    sender_company: str = Field(..., alias="senderCompany")
    receiver_company: str = Field(..., alias="receiverCompany")
    source_country: str = Field(..., alias="sourceCountry")
    destination_country: str = Field(..., alias="destinationCountry")
    source_chain: str = Field(..., alias="sourceChain")
    destination_chain: str = Field(..., alias="destinationChain")
    amount: float
    token: str
    purpose: str
    urgency: str = "Medium"

    model_config = {"populate_by_name": True}


class PaymentResponse(BaseModel):
    id: UUID
    sender_company: str
    receiver_company: str
    source_country: str
    destination_country: str
    source_chain: str
    destination_chain: str
    amount: float
    token: str
    purpose: str
    urgency: str
    status: PaymentStatusEnum
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatusEnum


# ── Compliance Decision Schemas ───────────────────────────────
class ComplianceDecisionResponse(BaseModel):
    id: UUID
    payment_id: UUID
    country_policy_result: Optional[dict] = None
    wallet_risk_result: Optional[dict] = None
    issuer_risk_result: Optional[dict] = None
    chain_governance_result: Optional[dict] = None
    liquidity_result: Optional[dict] = None
    ai_decision: Optional[AIDecisionEnum] = None
    ai_reasoning: Optional[str] = None
    fhe_check_result: Optional[dict] = None
    zk_proof_reference: Optional[str] = None
    policy_version: Optional[str] = None
    final_decision: FinalDecisionEnum
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Approval Schemas ──────────────────────────────────────────
class ApprovalCreate(BaseModel):
    action: ApprovalActionEnum
    notes: Optional[str] = None


class ApprovalResponse(BaseModel):
    id: UUID
    payment_id: UUID
    reviewer_id: UUID
    action: ApprovalActionEnum
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Audit Schemas ─────────────────────────────────────────────
class AuditRecordResponse(BaseModel):
    id: UUID
    payment_id: UUID
    decision_id: Optional[UUID] = None
    tx_hash: Optional[str] = None
    on_chain_proof_hash: Optional[str] = None
    report_path: Optional[str] = None
    zk_proof_reference: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Alert Schemas ─────────────────────────────────────────────
class AlertResponse(BaseModel):
    id: UUID
    payment_id: Optional[UUID] = None
    alert_type: AlertTypeEnum
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertMarkRead(BaseModel):
    is_read: bool = True


# ── Policy Schemas ────────────────────────────────────────────
class PolicyRuleResponse(BaseModel):
    id: UUID
    source_country: str
    destination_country: str
    is_allowed: bool
    requires_kyc: bool
    requires_travel_rule: bool
    reporting_threshold: float
    kyc_expiry_days: int
    notes: Optional[str] = None
    version_hash: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Revalidation Schemas ─────────────────────────────────────
class RevalidationTrigger(BaseModel):
    payment_id: Optional[str] = None


class RevalidationResponse(BaseModel):
    id: UUID
    payment_id: UUID
    trigger_reason: str
    original_decision: str
    new_risk_score: Optional[float] = None
    new_decision: Optional[str] = None
    status: RevalidationStatusEnum
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Generic ──────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    version: str


class MessageResponse(BaseModel):
    message: str
