from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.checkin import Checkin
from app.models.enums import ACCOUNTED_STATES, AlertSource, Channel, CheckinState, MessageDirection, Severity
from app.models.event import Event
from app.models.household import Household
from app.models.message import Message
from app.models.user import User
from app.models.zone import Zone
from app.services.checkins import compute_priority, next_action_at
from app.services.messaging import send_and_record, unit_cost

# Default wording per severity; an operator can override it per alert
ALERT_TEMPLATES = {
    Severity.WARNING: "MLINZI FLOOD WARNING for {zone}: heavy rain expected. Prepare to move to high ground. Reply 1 if SAFE, 2 if you NEED HELP.",
    Severity.EVACUATE: "MLINZI EVACUATE NOW: flooding expected in {zone}. Move to high ground immediately. Reply 1 if SAFE, 2 if you NEED HELP.",
}


# Households whose location falls inside a zone (the PostGIS targeting query)
def households_in_zone(db: Session, zone: Zone) -> List[Household]:
    return (
        db.query(Household)
        .filter(func.ST_Intersects(Household.geom, zone.geom))
        .order_by(Household.id.asc())
        .all()
    )


# Issue an alert: create a check-in per household in the zone, then send the SMS.
# Check-ins are committed before sending, so a failed send is retried by escalation.
def create_alert(
    db: Session,
    *,
    zone_id: int,
    severity: Severity,
    source: AlertSource = AlertSource.MANUAL,
    message: Optional[str] = None,
    issued_by: Optional[User] = None,
) -> Alert:
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise LookupError("Zone not found")
    households = households_in_zone(db, zone)
    if not households:
        raise ValueError("No registered households in this zone")

    alert = Alert(
        zone_id=zone.id,
        severity=severity,
        source=source,
        message=message or ALERT_TEMPLATES[severity].format(zone=zone.name),
        issued_by_id=issued_by.id if issued_by else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(alert)
    db.flush()

    checkins = [
        Checkin(
            alert_id=alert.id,
            household_id=household.id,
            state=CheckinState.SENT,
            attempts=1,
            priority=compute_priority(CheckinState.SENT, household.vulnerable, zone.risk_level),
            next_action_at=next_action_at(severity, CheckinState.SENT, alert.created_at),
        )
        for household in households
    ]
    db.add_all(checkins)
    db.flush()
    db.add_all(Event(checkin_id=c.id, from_state=None, to_state=CheckinState.SENT, note="Alert sent") for c in checkins)
    db.commit()

    send_and_record(db, [(h.phone, h.channel) for h in households], alert.message, alert_id=alert.id)
    db.commit()
    db.refresh(alert)
    return alert


# Counts per state, % accounted for and messaging cost for one alert
def get_alert_summary(db: Session, alert: Alert) -> dict:
    by_state: Dict[str, int] = {state.value: 0 for state in CheckinState}
    rows = (
        db.query(Checkin.state, func.count(Checkin.id))
        .filter(Checkin.alert_id == alert.id)
        .group_by(Checkin.state)
        .all()
    )
    for state, count in rows:
        by_state[state.value] = count

    total = sum(by_state.values())
    accounted = sum(by_state[s.value] for s in ACCOUNTED_STATES)
    messages_by_channel: Dict[str, int] = {channel.value: 0 for channel in Channel}
    rows = (
        db.query(Message.channel, func.count(Message.id))
        .filter(Message.alert_id == alert.id, Message.direction == MessageDirection.OUTBOUND)
        .group_by(Message.channel)
        .all()
    )
    for channel, count in rows:
        messages_by_channel[channel.value] = count
    messages_sent = sum(messages_by_channel.values())
    message_cost = round(sum(count * unit_cost(Channel(ch)) for ch, count in messages_by_channel.items()), 2)
    zone = db.get(Zone, alert.zone_id)

    return {
        "id": alert.id,
        "zone_id": alert.zone_id,
        "zone_name": zone.name,
        "severity": alert.severity,
        "source": alert.source,
        "message": alert.message,
        "created_at": alert.created_at,
        "total": total,
        "accounted": accounted,
        "accounted_percent": round(100 * accounted / total, 1) if total else 0.0,
        "by_state": by_state,
        "messages_sent": messages_sent,
        "messages_by_channel": messages_by_channel,
        "message_cost_kes": message_cost,
        "cost_per_accounted_kes": round(message_cost / accounted, 2) if accounted else None,
    }


# Most recent alerts first
def list_alerts(db: Session, limit: int = 10) -> List[Alert]:
    return db.query(Alert).order_by(Alert.id.desc()).limit(limit).all()
