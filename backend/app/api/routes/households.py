from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.geo import Feature, FeatureCollection, HouseholdProperties
from app.services.geo import get_households


router = APIRouter(prefix="/households", tags=["households"])


# List households as GeoJSON
@router.get("", response_model=FeatureCollection[HouseholdProperties])
def list_households(
    zone_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> FeatureCollection[HouseholdProperties]:
    return FeatureCollection[HouseholdProperties](
        features=[
            Feature[HouseholdProperties](
                geometry=geometry,
                properties=HouseholdProperties(
                    id=household.id,
                    head_name=household.head_name,
                    members=household.members,
                    vulnerable=household.vulnerable,
                    zone_id=zid,
                ),
            )
            for household, geometry, zid in get_households(db, zone_id)
        ]
    )
