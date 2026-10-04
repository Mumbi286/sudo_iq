from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_operator
from app.db.session import get_db
from app.models.user import User
from app.models.zone import Zone
from app.schemas.geo import Feature, FeatureCollection, HouseholdCreate, HouseholdProperties
from app.services.geo import get_households
from app.services.households import create_household


router = APIRouter(prefix="/households", tags=["households"])


# List households as GeoJSON; with alert_id, each carries its check-in state for that alert
@router.get("", response_model=FeatureCollection[HouseholdProperties])
def list_households(
    zone_id: Optional[int] = None,
    alert_id: Optional[int] = None,
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
                    channel=household.channel.value,
                    state=state,
                ),
            )
            for household, geometry, zid, state in get_households(db, zone_id, alert_id)
        ]
    )


# Register a household by phone inside a zone (operator or admin), e.g. a judge's real number
@router.post("", status_code=status.HTTP_201_CREATED, response_model=HouseholdProperties)
def add_household(
    payload: HouseholdCreate,
    db: Session = Depends(get_db),
    operator: User = Depends(require_operator),
) -> HouseholdProperties:
    del operator  # dependency enforces role
    zone = db.get(Zone, payload.zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    try:
        household = create_household(
            db, phone=payload.phone, zone=zone, channel=payload.channel,
            members=payload.members, vulnerable=payload.vulnerable, head_name=payload.head_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    db.commit()
    return HouseholdProperties(
        id=household.id, head_name=household.head_name, members=household.members,
        vulnerable=household.vulnerable, zone_id=zone.id, channel=household.channel.value,
    )
