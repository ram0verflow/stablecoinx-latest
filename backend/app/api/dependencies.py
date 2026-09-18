from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.core.config import settings
from app.core.security import verify_token
from app.db.database import get_db
from app.models.users import User, UserRole


def _oauth_token_url() -> str:
    base = (settings.BACKEND_URL or settings.FRONTEND_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/api/v1/auth/login"
    return "/api/v1/auth/login"


oauth2_scheme = OAuth2PasswordBearer(tokenUrl=_oauth_token_url())

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
        
    user_id_str: str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception
        
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def require_roles(allowed_roles: List[str]):
    """
    Dependency factory for role-based access control.
    Works correctly whether role is a str enum or plain str.
    """
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        )
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "Insufficient permissions",
                    "required_roles": allowed_roles,
                    "your_role": user_role,
                },
            )
        return current_user
    return role_checker


def require_role(roles: List[str]):
    """Backward-compatible alias."""
    return require_roles(roles)
