from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, EmailStr, Field, root_validator, validator


# ── Enums ─────────────────────────────────────────────────────
class UserRoleEnum(str, Enum):
    admin = "admin"
    treasury_officer = "treasury_officer"
    compliance_officer = "compliance_officer"
    auditor = "auditor"
    reviewer = "reviewer"
    viewer = "viewer"


class AdminAssignableRole(str, Enum):  # FIXED: C2
    viewer = "viewer"  # FIXED: C2
    compliance_officer = "compliance_officer"  # FIXED: C2
    treasury = "treasury"  # FIXED: C2
    admin = "admin"  # FIXED: C2


class PaymentStatusEnum(str, Enum):
    pending = "pending"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    executed = "executed"
    failed = "failed"
    blocked = "blocked"
    revalidation = "revalidation"


class AIDecisionEnum(str, Enum):
    direct_transfer = "direct_transfer"
    alternate_chain = "alternate_chain"
    alternate_token = "alternate_token"
    delay_transfer = "delay_transfer"
    split_payment = "split_payment"
    manual_review = "manual_review"
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
    settlement_executed = "settlement_executed"
    settlement_failed = "settlement_failed"


class RevalidationStatusEnum(str, Enum):
    pending = "pending"
    completed = "completed"


# ── User Schemas ──────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    # FIXED: C2
    # Role is assigned server-side at registration.


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: UserRoleEnum
    is_active: bool
    wallet_address: Optional[str] = None
    ai_preference: Optional[str] = "ollama"
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    id: UUID
    email: str
    role: UserRoleEnum
    created_at: datetime
    is_active: bool  # FIXED: H1

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: AdminAssignableRole  # FIXED: C2


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
    amount: float = Field(..., gt=0, le=10_000_000)
    token: str
    purpose: str
    urgency: str = "Medium"
    receiver_wallet: str = Field(..., alias="receiverWallet", min_length=26, max_length=42)
    sender_wallet: Optional[str] = Field(None, alias="senderWallet")

    # Counterparty intelligence — optional at creation time. Payments that
    # don't set these fall back to receiver_company/receiver_wallet with a
    # clearly labeled "counterparty wallet not configured" state rather than
    # pretending sender/receiver framing is the same thing.
    counterparty_name: Optional[str] = Field(None, alias="counterpartyName")
    counterparty_type: Optional[str] = Field(None, alias="counterpartyType")
    counterparty_wallet_address: Optional[str] = Field(None, alias="counterpartyWalletAddress")
    counterparty_chain: Optional[str] = Field(None, alias="counterpartyChain")
    counterparty_kyb_status: Optional[str] = Field(None, alias="counterpartyKybStatus")
    counterparty_kyb_provider: Optional[str] = Field(None, alias="counterpartyKybProvider")
    counterparty_attestation_id: Optional[str] = Field(None, alias="counterpartyAttestationId")
    route_type: Optional[str] = Field(None, alias="routeType")
    route_provider: Optional[str] = Field(None, alias="routeProvider")
    source_wallet_visibility: Optional[str] = Field(None, alias="sourceWalletVisibility")
    destination_tx_visibility: Optional[str] = Field(None, alias="destinationTxVisibility")
    origin_tx_visibility: Optional[str] = Field(None, alias="originTxVisibility")
    route_trace_completeness: Optional[str] = Field(None, alias="routeTraceCompleteness")
    route_provenance_confidence: Optional[str] = Field(None, alias="routeProvenanceConfidence")
    route_evidence_notes: Optional[str] = Field(None, alias="routeEvidenceNotes")

    @root_validator(skip_on_failure=True)
    def validate_wallet_formats(cls, values: dict) -> dict:
        import re

        evm_re = re.compile(r"^0x[a-fA-F0-9]{40}$")
        tron_re = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")

        def _check(wallet: Optional[str], chain: str, field_name: str) -> Optional[str]:
            if wallet is None:
                return None
            wallet = wallet.strip()
            is_tron_chain = (chain or "").strip().lower() in {"tron", "trx"}
            pattern = tron_re if is_tron_chain else evm_re
            if not pattern.fullmatch(wallet):
                expected = "a Tron address (T + 33 base58 chars)" if is_tron_chain else "an Ethereum address (0x + 40 hex chars)"
                raise ValueError(f"{field_name} must be {expected} for chain '{chain}'")
            return wallet

        values["receiver_wallet"] = _check(values.get("receiver_wallet"), values.get("destination_chain", ""), "receiver_wallet")
        values["sender_wallet"] = _check(values.get("sender_wallet"), values.get("source_chain", ""), "sender_wallet")
        return values

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
    sender_wallet: Optional[str] = None
    receiver_wallet: Optional[str] = None
    intent_hash: Optional[str] = None
    executed_at: Optional[datetime] = None
    revert_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    compliance_decision: Optional[Dict[str, Any]] = None
    pipeline_stages: Optional[Dict[str, Dict[str, Any]]] = None

    model_config = {"from_attributes": True}


class PaymentStatusUpdate(BaseModel):
    status: PaymentStatusEnum


# ── Compliance Decision Schemas ───────────────────────────────
class ComplianceDecisionResponse(BaseModel):
    id: UUID
    payment_id: UUID
    country_policy_result: Optional[dict] = None
    treasury_controls_result: Optional[dict] = None
    compliance_result: Optional[dict] = None
    wallet_risk_result: Optional[dict] = None
    issuer_risk_result: Optional[dict] = None
    chain_governance_result: Optional[dict] = None
    liquidity_result: Optional[dict] = None
    ai_decision: Optional[AIDecisionEnum] = None
    ai_reasoning: Optional[str] = None
    ai_confidence: Optional[str] = None
    ai_flags: Optional[list] = None
    ai_alternatives: Optional[list] = None
    ai_engine_used: Optional[str] = None
    ai_latency_ms: Optional[str] = None
    ai_risk_summary: Optional[str] = None
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
    trigger_type: str = "sanctions"
    corridors: Optional[List[str]] = []
    wallets: Optional[List[str]] = []
    token: Optional[str] = None
    risk_level: Optional[str] = "high"

    @validator("trigger_type")
    def validate_trigger_type(cls, v):
        valid = ["sanctions", "policy", "wallet", "issuer", "all"]
        if v not in valid:
            raise ValueError(f"trigger_type must be one of {valid}")
        return v


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


# ── Monitoring Schemas ────────────────────────────────────────
class CorridorStats(BaseModel):
    corridor: str
    count: int
    block_rate: float


class RpcStatus(BaseModel):
    base_sepolia: bool
    polygon_amoy: bool


class MonitoringStats(BaseModel):
    total_payments: int
    approved_today: int
    blocked_today: int
    pending_review: int
    avg_ai_latency_ms: float
    tx_success_rate: float
    top_corridors: List[Dict[str, Any]]
    ai_engine_status: str
    rpc_status: Dict[str, bool]
    neo4j_status: bool
    redis_status: bool
    compliance_provider: Optional[Dict[str, Any]] = None
    wallet_intelligence: Optional[Dict[str, Any]] = None
