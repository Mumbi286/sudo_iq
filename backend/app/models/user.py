from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, Integer, String, func

from app.db.session import Base
from app.models.enums import UserRole


# User model: staff who log in (admins, operators, responders). Households are not users.
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    phone = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.OPERATOR)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
