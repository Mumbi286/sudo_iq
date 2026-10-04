from geoalchemy2 import Geometry
from sqlalchemy import Column, Index, Integer, String

from app.db.session import Base


# Zone model: an area that can be put under a flood alert
class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    # 1 = low, 3 = high; feeds the rescue priority score
    risk_level = Column(Integer, nullable=False, default=1)
    geom = Column(Geometry("POLYGON", srid=4326, spatial_index=False), nullable=False)

    __table_args__ = (Index("ix_zones_geom", "geom", postgresql_using="gist"),)
