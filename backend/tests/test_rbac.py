import pytest
from fastapi import HTTPException

from app.api.dependencies import require_role
from app.models.users import User, UserRole


def test_auditor_cannot_approve():
    checker = require_role(["admin", "treasury_officer"])
    auditor = User(
        email="auditor@test.com",
        hashed_password="x",
        full_name="Auditor",
        role=UserRole.auditor,
        is_active=True,
    )
    with pytest.raises(HTTPException) as exc:
        checker(current_user=auditor)
    assert exc.value.status_code == 403
