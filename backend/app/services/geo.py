import json
from typing import List, Optional, Tuple

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.checkin import Checkin
from app.models.household import Household
from app.models.zone import Zone


# Zones with their GeoJSON outline and how many households fall inside each
def get_zones_with_counts(db: Session, zone_id: Optional[int] = None) -> List[Tuple[Zone, dict, int]]:
    query = (
        db.query(Zone, func.ST_AsGeoJSON(Zone.geom), func.count(Household.id))
        .outerjoin(Household, func.ST_Intersects(Household.geom, Zone.geom))
    )
    if zone_id is not None:
        query = query.filter(Zone.id == zone_id)
    rows = query.group_by(Zone.id).order_by(Zone.id.asc()).all()
    return [(zone, json.loads(geometry), count) for zone, geometry, count in rows]


# Households with their GeoJSON point, the zone they fall in and, for an alert, their check-in state.
# The same ST_Intersects join is what alert targeting uses.
def get_households(
    db: Session, zone_id: Optional[int] = None, alert_id: Optional[int] = None,
) -> List[Tuple[Household, dict, Optional[int], Optional[str]]]:
    query = (
        db.query(Household, func.ST_AsGeoJSON(Household.geom), Zone.id, Checkin.state)
        .outerjoin(Zone, func.ST_Intersects(Household.geom, Zone.geom))
        .outerjoin(Checkin, and_(Checkin.household_id == Household.id, Checkin.alert_id == alert_id))
    )
    if zone_id is not None:
        query = query.filter(Zone.id == zone_id)
    rows = query.order_by(Household.id.asc()).all()
    return [
        (household, json.loads(geometry), zid, state.value if state else None)
        for household, geometry, zid, state in rows
    ]
