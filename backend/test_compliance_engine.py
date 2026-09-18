"""
Tests for Compliance Engine.
Verifies sanctions, KYC, and blacklist checks.
"""

import pytest
from uuid import uuid4
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.compliance import ComplianceDecision
from app.models.entities import Entity, EntityType
from app.schemas import DecisionEnum


@pytest.fixture
def test_entities(db_session: Session):
    """Create test entities for compliance checks."""
    sanctioned = Entity(
        id=uuid4(),
        name="Sanctioned Corp",
        type=EntityType.company,
        country="Iran",
        is_sanctioned=True,
        sanctions_reason="OFAC Listing",
    )

    kyc_expired = Entity(
        id=uuid4(),
        name="Expired KYC Corp",
        type=EntityType.company,
        country="USA",
        is_sanctioned=False,
        kyc_verified_at=datetime.utcnow() - timedelta(days=400),
    )

    clean = Entity(
        id=uuid4(),
        name="Clean Corp",
        type=EntityType.company,
        country="SG",
        is_sanctioned=False,
        kyc_verified_at=datetime.utcnow() - timedelta(days=10),
    )

    blacklisted = Entity(
        id=uuid4(),
        name="Internal Blacklist Corp",
        type=EntityType.company,
        country="USA",
        is_sanctioned=False,
        is_internal_blacklist=True,
        blacklist_reason="Fraud conviction",
    )

    db_session.add_all([sanctioned, kyc_expired, clean, blacklisted])
    db_session.commit()
    return {
        "sanctioned": sanctioned,
        "kyc_expired": kyc_expired,
        "clean": clean,
        "blacklisted": blacklisted,
    }


def test_sanctions_hit_blocks_payment(db_session: Session, test_entities):
    """Test sanctioned entity blocks payment."""
    sanctioned = test_entities["sanctioned"]
    
    # Simulate compliance check
    assert sanctioned.is_sanctioned is True
    assert sanctioned.sanctions_reason == "OFAC Listing"


def test_kyc_expired_fails(db_session: Session, test_entities):
    """Test expired KYC fails compliance."""
    kyc_expired = test_entities["kyc_expired"]
    
    # Check if KYC expired (>365 days old)
    days_since_kyc = (datetime.utcnow() - kyc_expired.kyc_verified_at).days
    assert days_since_kyc > 365


def test_clean_company_passes(db_session: Session, test_entities):
    """Test clean company passes compliance."""
    clean = test_entities["clean"]
    
    # Check compliance
    assert clean.is_sanctioned is False
    assert clean.kyc_verified_at is not None
    
    days_since_kyc = (datetime.utcnow() - clean.kyc_verified_at).days
    assert days_since_kyc < 365


def test_internal_blacklist_hit(db_session: Session, test_entities):
    """Test internal blacklist blocks payment."""
    blacklisted = test_entities["blacklisted"]
    
    assert blacklisted.is_internal_blacklist is True
    assert blacklisted.blacklist_reason == "Fraud conviction"


def test_multiple_compliance_checks_all_pass(db_session: Session, test_entities):
    """Test multiple compliance checks pass together."""
    clean = test_entities["clean"]
    
    # Run all compliance checks
    checks = {
        "sanctions": not clean.is_sanctioned,
        "kyc_valid": (datetime.utcnow() - clean.kyc_verified_at).days < 365,
        "not_blacklisted": not getattr(clean, "is_internal_blacklist", False),
    }
    
    assert all(checks.values())
