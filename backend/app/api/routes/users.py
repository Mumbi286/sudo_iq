from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse
from app.services.users import create_user


router = APIRouter(prefix="/users", tags=["users"])


# List staff accounts (admin only)
@router.get("", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> List[User]:
    del admin_user  # dependency enforces admin role
    return db.query(User).order_by(User.id.asc()).all()


# Create an operator, responder or admin account (admin only)
@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
def add_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
) -> User:
    del admin_user  # dependency enforces admin role
    try:
        return create_user(
            db, name=payload.name, email=payload.email, password=payload.password,
            role=payload.role, phone=payload.phone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
