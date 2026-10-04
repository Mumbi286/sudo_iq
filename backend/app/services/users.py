from typing import Optional

from sqlalchemy.orm import Session

from app.models.enums import UserRole
from app.models.user import User
from app.services.security import hash_password, verify_password


# Find a user by email (case-insensitive)
def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.strip().lower()).first()


# Return the user if the email and password match an active account
def authenticate(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        return None
    return user


# Create a staff account; raises ValueError if the email is taken
def create_user(
    db: Session, *, name: str, email: str, password: str, role: UserRole, phone: Optional[str] = None,
) -> User:
    if get_user_by_email(db, email) is not None:
        raise ValueError("A user with this email already exists")
    user = User(
        name=name,
        email=email.strip().lower(),
        phone=phone,
        password_hash=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
