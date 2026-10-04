from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_operator
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alerts import AlertCreate, AlertSummary
from app.services.alerts import create_alert, get_alert_summary, list_alerts


router = APIRouter(prefix="/alerts", tags=["alerts"])


# Issue an alert to every household in a zone (operator or admin)
@router.post("", status_code=status.HTTP_201_CREATED, response_model=AlertSummary)
def issue_alert(
    payload: AlertCreate,
    db: Session = Depends(get_db),
    operator: User = Depends(require_operator),
) -> dict:
    try:
        alert = create_alert(
            db, zone_id=payload.zone_id, severity=payload.severity, message=payload.message, issued_by=operator,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return get_alert_summary(db, alert)


# Recent alerts with their live summary, newest first
@router.get("", response_model=List[AlertSummary])
def recent_alerts(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
) -> List[dict]:
    return [get_alert_summary(db, alert) for alert in list_alerts(db, limit)]


# One alert's summary: counts per state, % accounted for, SMS cost
@router.get("/{alert_id}/summary", response_model=AlertSummary)
def alert_summary(alert_id: int, db: Session = Depends(get_db)) -> dict:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return get_alert_summary(db, alert)
