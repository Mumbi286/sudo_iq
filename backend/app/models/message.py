from sqlalchemy import Column, DateTime, Enum as SAEnum, Integer, String, Text, func

from app.db.session import Base
from app.models.enums import MessageDirection


# Message model: every SMS sent or received
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    # Unique so a webhook delivered twice is only processed once
    provider_msg_id = Column(String, nullable=True, unique=True)
    direction = Column(SAEnum(MessageDirection, name="message_direction"), nullable=False)
    phone = Column(String, nullable=False, index=True)
    body = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
