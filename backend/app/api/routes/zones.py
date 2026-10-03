from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.geo import Feature, FeatureCollection, ZoneProperties
from app.services.geo import get_zones_with_counts


router = APIRouter(prefix="/zones", tags=["zones"])


# List all zones as GeoJSON for the map
@router.get("", response_model=FeatureCollection[ZoneProperties])
def list_zones(db: Session = Depends(get_db)) -> FeatureCollection[ZoneProperties]:
    return FeatureCollection[ZoneProperties](
        features=[
            Feature[ZoneProperties](
                geometry=geometry,
                properties=ZoneProperties(
                    id=zone.id,
                    name=zone.name,
                    risk_level=zone.risk_level,
                    households=count,
                ),
            )
            for zone, geometry, count in get_zones_with_counts(db)
        ]
    )
