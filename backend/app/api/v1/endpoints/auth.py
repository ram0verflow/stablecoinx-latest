from fastapi import APIRouter, Depends, HTTPException, Query, Request  # FIXED: C2
from sqlalchemy.orm import Session  # FIXED: C2
from typing import Any, List  # FIXED: C2
from uuid import UUID  # FIXED: C2

from app.db.database import get_db  # FIXED: C2
from app.schemas import (  # FIXED: C2
    AdminAssignableRole,  # FIXED: C2
    UserCreate,  # FIXED: C2
    UserLogin,  # FIXED: C2
    TokenResponse,  # FIXED: C2
    UserResponse,  # FIXED: C2
    UserListResponse,  # FIXED: C2
    UserRoleUpdate,  # FIXED: C2
)
from app.models.users import User, UserRole  # FIXED: C2
from app.core.security import get_password_hash, verify_password, create_access_token  # FIXED: C2
from app.api.dependencies import get_current_user, require_roles  # FIXED: C2
from app.core.rate_limit import limiter  # FIXED: S3

router = APIRouter()  # FIXED: C2

_ROLE_PATCH_MAP = {  # FIXED: C2
    AdminAssignableRole.viewer: UserRole.viewer,  # FIXED: C2
    AdminAssignableRole.compliance_officer: UserRole.compliance_officer,  # FIXED: C2
    AdminAssignableRole.treasury: UserRole.treasury_officer,  # FIXED: C2
    AdminAssignableRole.admin: UserRole.admin,  # FIXED: C2
}  # FIXED: C2


@router.post("/register", response_model=TokenResponse)  # FIXED: C2
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> Any:  # FIXED: C2
    user = db.query(User).filter(User.email == user_in.email).first()  # FIXED: C2
    if user:  # FIXED: C2
        raise HTTPException(  # FIXED: C2
            status_code=400,  # FIXED: C2
            detail="The user with this email already exists in the system.",  # FIXED: C2
        )  # FIXED: C2
    user = User(  # FIXED: C2
        email=user_in.email,  # FIXED: C2
        hashed_password=get_password_hash(user_in.password),  # FIXED: C2
        full_name=user_in.full_name,  # FIXED: C2
        role=UserRole.viewer,  # FIXED: C2
    )  # FIXED: C2
    db.add(user)  # FIXED: C2
    db.commit()  # FIXED: C2
    db.refresh(user)  # FIXED: C2

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})  # FIXED: C2
    return {"access_token": access_token, "token_type": "bearer", "user": user}  # FIXED: C2


@router.post("/login", response_model=TokenResponse)  # FIXED: S3
@limiter.limit("10/minute")  # FIXED: S3
def login(  # FIXED: S3
    request: Request,  # FIXED: S3
    user_in: UserLogin,  # FIXED: S3
    db: Session = Depends(get_db),  # FIXED: S3
) -> Any:  # FIXED: S3
    user = db.query(User).filter(User.email == user_in.email).first()  # FIXED: C2
    if not user or not verify_password(user_in.password, user.hashed_password):  # FIXED: C2
        raise HTTPException(status_code=400, detail="Incorrect email or password")  # FIXED: C2
    elif not user.is_active:  # FIXED: C2
        raise HTTPException(status_code=400, detail="Inactive user")  # FIXED: C2

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})  # FIXED: C2
    return {"access_token": access_token, "token_type": "bearer", "user": user}  # FIXED: C2


@router.get("/roles")
async def get_available_roles():
    """Return all available roles for login UX."""
    from app.models.users import UserRole
    return {
        "roles": [
            {
                "value": role.value,
                "label": role.value.replace("_", " ").title()
            }
            for role in UserRole if role.value != "viewer"
        ]
    }


from pydantic import BaseModel  # FIXED: C2


class PreferenceUpdate(BaseModel):  # FIXED: C2
    ai_preference: str  # FIXED: C2


@router.get("/me", response_model=UserResponse)  # FIXED: C2
def read_user_me(current_user: User = Depends(get_current_user)) -> Any:  # FIXED: C2
    return current_user  # FIXED: C2


@router.patch("/me/preference")  # FIXED: C2
def update_preference(  # FIXED: C2
    pref: PreferenceUpdate,  # FIXED: C2
    db: Session = Depends(get_db),  # FIXED: C2
    current_user: User = Depends(get_current_user),  # FIXED: C2
) -> Any:  # FIXED: C2
    current_user.ai_preference = pref.ai_preference  # FIXED: C2
    db.commit()  # FIXED: C2
    return {"status": "success", "ai_preference": current_user.ai_preference}  # FIXED: C2


@router.get("/users", response_model=List[UserListResponse])  # FIXED: H1
def list_users(  # FIXED: H1
    skip: int = Query(0, ge=0),  # FIXED: H1
    limit: int = Query(50, ge=1, le=200),  # FIXED: H1
    db: Session = Depends(get_db),  # FIXED: H1
    current_user: User = Depends(require_roles(["admin"])),  # FIXED: H1
) -> Any:  # FIXED: H1
    return db.query(User).order_by(User.created_at.desc()).offset(skip).limit(limit).all()  # FIXED: H1


@router.patch("/users/{user_id}/role", response_model=UserResponse)  # FIXED: C2
def update_user_role(  # FIXED: C2
    user_id: UUID,  # FIXED: C2
    role_in: UserRoleUpdate,  # FIXED: C2
    db: Session = Depends(get_db),  # FIXED: C2
    current_user: User = Depends(require_roles(["admin"])),  # FIXED: C2
) -> Any:  # FIXED: C2
    user = db.query(User).filter(User.id == user_id).first()  # FIXED: C2
    if not user:  # FIXED: C2
        raise HTTPException(status_code=404, detail="User not found")  # FIXED: C2
    user.role = _ROLE_PATCH_MAP[role_in.role]  # FIXED: C2
    db.add(user)  # FIXED: C2
    db.commit()  # FIXED: C2
    db.refresh(user)  # FIXED: C2
    return user  # FIXED: C2
