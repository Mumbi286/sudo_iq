from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, Enum as SAEnum, Index, Integer, String, func

from app.db.session import Base
from app.models.enums import Channel


# Household model: one registered phone, one location.
# Zone membership is not stored; it is computed with ST_Intersects.
class Household(Base):
    __tablename__ = "households"
    id = Column(Integer, primary_key=True, index=True)
    head_name = Column(String, nullable=True)
    phone = Column(String, nullable=False, unique=True)
    # Preferred channel: the one the household last used to talk to us
    channel = Column(SAEnum(Channel, name="channel"), nullable=False, default=Channel.SMS, server_default=Channel.SMS.value)
    members = Column(Integer, nullable=False, default=1)
    # Elderly, disabled or infant members; raises rescue priority
    vulnerable = Column(Integer, nullable=False, default=0)
    geom = Column(Geometry("POINT", srid=4326, spatial_index=False), nullable=False)
    consent_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (Index("ix_households_geom", "geom", postgresql_using="gist"),)
