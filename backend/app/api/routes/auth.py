from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserResponse
from app.services.security import create_access_token
from app.services.users import authenticate


router = APIRouter(prefix="/auth", tags=["auth"])


# Log in with email (as `username`) and password; returns a bearer token
@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate(db, form.username, form.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        user=UserResponse.model_validate(user),
    )


# The logged-in user
@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
