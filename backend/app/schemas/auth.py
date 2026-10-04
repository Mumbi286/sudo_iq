from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import UserRole

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


# User Create Schema (admin creates staff accounts)
class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(pattern=EMAIL_PATTERN)
    phone: Optional[str] = None
    password: str = Field(min_length=8)
    role: UserRole = UserRole.OPERATOR


# User Response Schema
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: Optional[str]
    role: UserRole
    is_active: bool
    created_at: datetime


# Token Response Schema
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
