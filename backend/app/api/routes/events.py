from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.alerts import EventResponse
from app.services.events import list_events


router = APIRouter(prefix="/events", tags=["events"])


# Live activity feed: household state changes, newest first
@router.get("", response_model=List[EventResponse])
def recent_events(
    alert_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=200),
    include_initial: bool = False,
    db: Session = Depends(get_db),
) -> List[dict]:
    return list_events(db, alert_id=alert_id, limit=limit, include_initial=include_initial)
