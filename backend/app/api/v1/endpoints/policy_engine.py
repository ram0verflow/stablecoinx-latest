"""
Multi-tenant policy engine API: teams, each with one YAML policy ruleset
that can be saved, deployed (pushed to n8n — see
services/policy_engine/n8n_deploy.py) and evaluated against a real
payment. See services/policy_engine/dsl.py for the YAML schema.
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_roles
from app.db.database import get_db
from app.models.payment_intents import PaymentIntent
from app.models.team_policies import TeamPolicy
from app.models.teams import Team
from app.models.users import User
from app.services.policy_engine.dsl import PolicyParseError, parse_policy_yaml
from app.services.policy_engine.evaluator import evaluate_policy
from app.services.policy_engine.n8n_deploy import deploy_policy_to_n8n

router = APIRouter()

_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

_EXAMPLE_POLICY_YAML = """team: your-team
version: 1
rules:
  - name: block-sanctioned-corridor
    description: Block payments into sanctioned jurisdictions
    priority: 100
    when:
      destination_country: [Iran, "North Korea", Russia]
    action: block

  - name: enhanced-review-large-transfer
    description: Escalate large transfers for manual review
    priority: 50
    when:
      amount_gt: 100000
    action: enhanced_review

  - name: flag-tron-settlement
    description: Flag any payment settling on Tron for extra scrutiny
    priority: 10
    when:
      chain_in: [Tron]
    action: enhanced_review
"""


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100)


class TeamResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str

    model_config = {"from_attributes": True}


class PolicySaveRequest(BaseModel):
    yaml_text: str


class PolicyResponse(BaseModel):
    team_id: uuid.UUID
    yaml_text: str
    version: int
    rule_count: int
    is_deployed: bool
    deployed_at: Optional[str] = None
    n8n_deploy_status: Optional[str] = None
    n8n_deploy_detail: Optional[str] = None


class EvaluateRequest(BaseModel):
    payment_id: Optional[uuid.UUID] = None
    payment: Optional[Dict[str, Any]] = None


def _team_or_404(db: Session, team_id: uuid.UUID) -> Team:
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


def _policy_response(team: Team, policy: Optional[TeamPolicy]) -> PolicyResponse:
    if not policy:
        return PolicyResponse(
            team_id=team.id, yaml_text=_EXAMPLE_POLICY_YAML, version=0, rule_count=0,
            is_deployed=False, deployed_at=None, n8n_deploy_status=None, n8n_deploy_detail=None,
        )
    try:
        rule_count = len(parse_policy_yaml(policy.yaml_text)["rules"])
    except PolicyParseError:
        rule_count = 0
    return PolicyResponse(
        team_id=team.id, yaml_text=policy.yaml_text, version=policy.version, rule_count=rule_count,
        is_deployed=policy.is_deployed,
        deployed_at=policy.deployed_at.isoformat() if policy.deployed_at else None,
        n8n_deploy_status=policy.n8n_deploy_status, n8n_deploy_detail=policy.n8n_deploy_detail,
    )


@router.get("/teams", response_model=List[TeamResponse])
def list_teams(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Team).order_by(Team.created_at).all()


@router.post("/teams", response_model=TeamResponse)
def create_team(
    body: TeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
):
    slug = body.slug.strip().lower()
    if not _SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="slug must be lowercase alphanumeric with single hyphens (e.g. 'acme-corp')")
    if db.query(Team).filter(Team.slug == slug).first():
        raise HTTPException(status_code=409, detail=f"Team slug '{slug}' already exists")
    team = Team(name=body.name.strip(), slug=slug)
    db.add(team)
    db.commit()
    db.refresh(team)
    return team


@router.get("/teams/{team_id}/policy", response_model=PolicyResponse)
def get_team_policy(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    policy = db.query(TeamPolicy).filter(TeamPolicy.team_id == team_id).first()
    return _policy_response(team, policy)


@router.put("/teams/{team_id}/policy", response_model=PolicyResponse)
def save_team_policy(
    team_id: uuid.UUID,
    body: PolicySaveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "compliance_officer"])),
):
    team = _team_or_404(db, team_id)
    try:
        parsed = parse_policy_yaml(body.yaml_text)
    except PolicyParseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    policy = db.query(TeamPolicy).filter(TeamPolicy.team_id == team_id).first()
    if policy:
        policy.yaml_text = body.yaml_text
        policy.version += 1
        policy.is_deployed = False
        policy.n8n_deploy_status = None
        policy.n8n_deploy_detail = None
    else:
        policy = TeamPolicy(team_id=team_id, yaml_text=body.yaml_text, version=1)
        db.add(policy)
    db.commit()
    db.refresh(policy)
    return _policy_response(team, policy)


@router.post("/teams/{team_id}/policy/deploy", response_model=PolicyResponse)
def deploy_team_policy(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "compliance_officer"])),
):
    from datetime import datetime, timezone

    team = _team_or_404(db, team_id)
    policy = db.query(TeamPolicy).filter(TeamPolicy.team_id == team_id).first()
    if not policy:
        raise HTTPException(status_code=400, detail="No policy saved for this team yet")

    try:
        parsed = parse_policy_yaml(policy.yaml_text)
    except PolicyParseError as exc:
        raise HTTPException(status_code=400, detail=f"Saved policy is invalid, fix it before deploying: {exc}")

    result = deploy_policy_to_n8n(team.name, team.slug, parsed["rules"])
    policy.is_deployed = result["status"] == "sent"
    policy.deployed_at = datetime.now(timezone.utc) if policy.is_deployed else policy.deployed_at
    policy.n8n_deploy_status = result["status"]
    policy.n8n_deploy_detail = result["detail"]
    db.commit()
    db.refresh(policy)
    return _policy_response(team, policy)


@router.post("/teams/{team_id}/policy/evaluate")
def evaluate_team_policy(
    team_id: uuid.UUID,
    body: EvaluateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    policy = db.query(TeamPolicy).filter(TeamPolicy.team_id == team_id).first()
    if not policy:
        raise HTTPException(status_code=400, detail="No policy saved for this team yet")

    try:
        parsed = parse_policy_yaml(policy.yaml_text)
    except PolicyParseError as exc:
        raise HTTPException(status_code=400, detail=f"Saved policy is invalid: {exc}")

    if body.payment_id:
        payment = db.query(PaymentIntent).filter(PaymentIntent.id == body.payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        payment_dict = {
            "source_country": payment.source_country,
            "destination_country": payment.destination_country,
            "source_chain": payment.source_chain,
            "destination_chain": payment.destination_chain,
            "amount": float(payment.amount),
            "token": payment.token,
            "purpose": payment.purpose,
            "urgency": payment.urgency,
        }
    elif body.payment is not None:
        payment_dict = body.payment
    else:
        raise HTTPException(status_code=400, detail="Provide either payment_id or payment")

    result = evaluate_policy(parsed["rules"], payment_dict)
    result["payment"] = payment_dict
    return result
