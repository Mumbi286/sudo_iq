from sqlalchemy import Column, DateTime, Enum as SAEnum, ForeignKey, Integer, Text, func

from app.db.session import Base
from app.models.enums import AlertSource, Severity


# Alert model: one warning issued to one zone
class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    severity = Column(SAEnum(Severity, name="severity"), nullable=False)
    source = Column(SAEnum(AlertSource, name="alert_source"), nullable=False, default=AlertSource.MANUAL)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
