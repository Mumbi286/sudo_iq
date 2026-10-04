from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func

from app.db.session import Base
from app.models.enums import Channel, MessageDirection


# Message model: every SMS / WhatsApp message sent or received; also the basis for cost per alert
class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    # Unique so a webhook delivered twice is only processed once
    provider_msg_id = Column(String, nullable=True, unique=True)
    direction = Column(SAEnum(MessageDirection, name="message_direction"), nullable=False)
    channel = Column(SAEnum(Channel, name="channel"), nullable=False, default=Channel.SMS, server_default=Channel.SMS.value)
    phone = Column(String, nullable=False, index=True)
    body = Column(Text, nullable=True)
    # The alert this message belongs to, if any
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
