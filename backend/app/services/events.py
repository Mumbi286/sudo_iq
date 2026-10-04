from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.checkin import Checkin
from app.models.event import Event
from app.models.household import Household
from app.models.zone import Zone


# Latest state changes for the activity feed, newest first.
# The initial "Alert sent" events are skipped by default: the alert itself represents them.
def list_events(
    db: Session, *, alert_id: Optional[int] = None, limit: int = 50, include_initial: bool = False,
) -> List[dict]:
    query = (
        db.query(Event, Checkin, Household, Zone)
        .join(Checkin, Event.checkin_id == Checkin.id)
        .join(Household, Checkin.household_id == Household.id)
        .join(Alert, Checkin.alert_id == Alert.id)
        .join(Zone, Alert.zone_id == Zone.id)
    )
    if alert_id is not None:
        query = query.filter(Checkin.alert_id == alert_id)
    if not include_initial:
        query = query.filter(Event.from_state.isnot(None))
    rows = query.order_by(Event.id.desc()).limit(limit).all()

    return [
        {
            "id": event.id,
            "alert_id": checkin.alert_id,
            "checkin_id": checkin.id,
            "household_id": household.id,
            "household_name": household.head_name,
            "zone_name": zone.name,
            "from_state": event.from_state,
            "to_state": event.to_state,
            "note": event.note,
            "created_at": event.created_at,
        }
        for event, checkin, household, zone in rows
    ]
