from sqlalchemy import BigInteger, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, Text, func

from app.db.session import Base
from app.models.enums import CheckinState


# Event model: append-only audit log of check-in state changes; also feeds the dashboard
class Event(Base):
    __tablename__ = "events"
    id = Column(BigInteger, primary_key=True, index=True)
    checkin_id = Column(Integer, ForeignKey("checkins.id"), nullable=False, index=True)
    from_state = Column(SAEnum(CheckinState, name="checkin_state", create_type=False), nullable=True)
    to_state = Column(SAEnum(CheckinState, name="checkin_state", create_type=False), nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
