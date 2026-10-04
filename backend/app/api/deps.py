from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.services.security import decode_access_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# Get the current user from the bearer token
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user = db.get(User, int(payload["sub"]))
    except (ValueError, KeyError, TypeError) as exc:
        raise credentials_exc from exc

    if user is None or not user.is_active:
        raise credentials_exc
    return user


# Require the current user to have one of the given roles
def require_roles(*roles: UserRole) -> Callable[..., User]:
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in roles)}",
            )
        return current_user

    return checker


# Who can issue alerts and manage zones
require_operator = require_roles(UserRole.ADMIN, UserRole.OPERATOR)
# Who can manage staff accounts
require_admin = require_roles(UserRole.ADMIN)
