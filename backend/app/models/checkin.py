from sqlalchemy import (
    Column, DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, UniqueConstraint, func, text,
)

from app.db.session import Base
from app.models.enums import CheckinState


# Checkin model: the status of one household for one alert.
# next_action_at is the escalation timer; it lives here, not in a task queue.
class Checkin(Base):
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=False)
    state = Column(SAEnum(CheckinState, name="checkin_state"), nullable=False, default=CheckinState.SENT)
    attempts = Column(Integer, nullable=False, default=1)
    priority = Column(Integer, nullable=False, default=0)
    next_action_at = Column(DateTime(timezone=True), nullable=True)
    assigned_to = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("alert_id", "household_id", name="uq_checkins_alert_household"),
        # The escalation tick only ever scans open check-ins
        Index(
            "ix_checkins_due",
            "next_action_at",
            postgresql_where=text("state NOT IN ('SAFE', 'RESCUED', 'CLOSED')"),
        ),
    )
