"""The household state machine: every state change goes through `transition`,
which also writes the audit event and recalculates priority and the next timer."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.checkin import Checkin
from app.models.enums import CheckinState, Severity
from app.models.event import Event
from app.models.household import Household
from app.models.zone import Zone

# Base urgency per state; vulnerability and zone risk are added on top
STATE_PRIORITY = {
    CheckinState.NEEDS_HELP: 100,
    CheckinState.UNREACHABLE: 70,
    CheckinState.CALLING: 40,
    CheckinState.RESENT: 30,
    CheckinState.SENT: 20,
    CheckinState.ASSIGNED: 10,
}

# States that still wait on a timer (silence escalates); the rest wait on people
TIMED_STATES = (CheckinState.SENT, CheckinState.RESENT, CheckinState.CALLING)


# Rescue priority: who should a responder reach first
def compute_priority(state: CheckinState, vulnerable: int, zone_risk: int) -> int:
    base = STATE_PRIORITY.get(state)
    if base is None:
        return 0
    return base + 20 * vulnerable + 10 * zone_risk


# When the timer for the next escalation step should fire, or None if no timer applies
def next_action_at(severity: Severity, state: CheckinState, alert_created_at: datetime) -> Optional[datetime]:
    if state not in TIMED_STATES:
        return None
    resend, call, unreachable = settings.escalation_seconds(severity.value)
    delay = {CheckinState.SENT: resend, CheckinState.RESENT: call, CheckinState.CALLING: unreachable}[state]
    return alert_created_at + timedelta(seconds=delay)


# Move a check-in to a new state, with an audit event, new priority and new timer
def transition(db: Session, checkin: Checkin, to_state: CheckinState, note: Optional[str] = None) -> Event:
    alert = db.get(Alert, checkin.alert_id)
    household = db.get(Household, checkin.household_id)
    zone = db.get(Zone, alert.zone_id)

    event = Event(checkin_id=checkin.id, from_state=checkin.state, to_state=to_state, note=note)
    db.add(event)

    checkin.state = to_state
    checkin.priority = compute_priority(to_state, household.vulnerable, zone.risk_level)
    checkin.next_action_at = next_action_at(alert.severity, to_state, alert.created_at or datetime.now(timezone.utc))
    return event
