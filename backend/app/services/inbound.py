"""Inbound messages (SMS or WhatsApp): replies to alerts (1 = safe, 2 = help)
and self-registration (JIUNGE <area> [household size]). Replies go back on the channel the message came in on."""
from typing import List, Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.checkin import Checkin
from app.models.enums import Channel, CheckinState, MessageDirection
from app.models.household import Household
from app.models.message import Message
from app.models.zone import Zone
from app.services.checkins import transition
from app.services.households import create_household
from app.services.messaging import send_and_record
from app.services.phones import normalize_phone
from app.services.zones import find_zone_by_name

# Accepted reply words (English and Swahili) per state
REPLY_KEYWORDS = {
    CheckinState.SAFE: {"1", "SAFE", "SALAMA"},
    CheckinState.NEEDS_HELP: {"2", "HELP", "MSAADA", "SAIDIA"},
}
REGISTER_KEYWORDS = {"JIUNGE", "REGISTER", "REG", "JOIN"}

# Check-ins a reply can still change
REPLYABLE_STATES = (
    CheckinState.SENT, CheckinState.RESENT, CheckinState.CALLING, CheckinState.UNREACHABLE,
    CheckinState.SAFE, CheckinState.NEEDS_HELP,
)

ACK_MESSAGES = {
    CheckinState.SAFE: "Asante. You are marked SAFE. Reply 2 at any time if you need help.",
    CheckinState.NEEDS_HELP: "Help request received. Responders have been notified. Stay on high ground and keep your phone on.",
}


def _result(status: str, detail: str, reply: Optional[str] = None, checkin: Optional[Checkin] = None) -> dict:
    return {
        "status": status,
        "detail": detail,
        "reply": reply,
        "checkin_id": checkin.id if checkin else None,
        "state": checkin.state if checkin else None,
    }


# The newest check-in a reply from this household can still change
def _latest_open_checkin(db: Session, household_id: int) -> Optional[Checkin]:
    return (
        db.query(Checkin)
        .filter(Checkin.household_id == household_id, Checkin.state.in_(REPLYABLE_STATES))
        .order_by(Checkin.alert_id.desc())
        .first()
    )


def _zone_names(db: Session) -> List[str]:
    return [name for (name,) in db.query(Zone.name).order_by(Zone.name).all()]


# JIUNGE <area> [household size]: sending the keyword is the consent
def register_household(db: Session, phone: str, channel: Channel, words: List[str]) -> dict:
    household = db.query(Household).filter(Household.phone == phone).first()
    if household is not None:
        household.channel = channel
        return _result("already_registered", "Phone already registered", "You are already registered with Mlinzi.")

    members = 1
    if words and words[-1].isdigit():
        members = max(1, int(words.pop()))
    zone = find_zone_by_name(db, " ".join(words)) if words else None
    if zone is None:
        names = _zone_names(db)
        return _result(
            "unknown_zone", "Zone not found",
            f"Send JIUNGE followed by your area, e.g. JIUNGE {names[0] if names else '<area>'}. Areas: {', '.join(names)}",
        )

    create_household(db, phone=phone, zone=zone, channel=channel, members=members)
    return _result(
        "registered", f"Registered in {zone.name}",
        f"Karibu Mlinzi! You are registered in {zone.name} and will receive flood alerts here. "
        "When an alert comes, reply 1 if SAFE or 2 if you NEED HELP.",
    )


# Reply 1/2 to the household's latest alert
def apply_reply(db: Session, household: Household, to_state: CheckinState, text: str) -> dict:
    checkin = _latest_open_checkin(db, household.id)
    if checkin is None:
        return _result("no_active_alert", "No open alert for this household", "There is no active flood alert for you right now. Stay safe.")
    if checkin.state == to_state:
        return _result("unchanged", f"Already {to_state.value}", checkin=checkin)

    transition(db, checkin, to_state, note=f"{household.channel.value} reply: {text.strip()[:40]}")
    return _result("updated", f"Marked {to_state.value}", ACK_MESSAGES[to_state], checkin=checkin)


# Entry point for the webhooks: dedupe, store, interpret, reply on the same channel
def handle_inbound_message(
    db: Session, *, phone: str, text: str, channel: Channel = Channel.SMS, provider_msg_id: Optional[str] = None,
) -> dict:
    phone = normalize_phone(phone)
    if provider_msg_id and db.query(Message.id).filter(Message.provider_msg_id == provider_msg_id).first():
        return _result("duplicate", "Message already processed")

    db.add(Message(provider_msg_id=provider_msg_id, direction=MessageDirection.INBOUND, channel=channel, phone=phone, body=text))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return _result("duplicate", "Message already processed")

    words = text.strip().split()
    keyword = words[0].upper() if words else ""
    household = db.query(Household).filter(Household.phone == phone).first()

    if keyword in REGISTER_KEYWORDS:
        result = register_household(db, phone, channel, words[1:])
    elif household is None:
        result = _result("unknown_sender", "Phone not registered", "Welcome to Mlinzi flood alerts. Send JIUNGE <your area> to register.")
    else:
        # Reach the household on whichever channel it last used
        household.channel = channel
        to_state = next((state for state, keys in REPLY_KEYWORDS.items() if keyword in keys), None)
        if to_state is None:
            result = _result("unrecognised", "Unrecognised message", "Reply 1 if you are SAFE or 2 if you NEED HELP.")
        else:
            result = apply_reply(db, household, to_state, text)
    db.commit()

    if result["reply"]:
        alert_id = db.get(Checkin, result["checkin_id"]).alert_id if result["checkin_id"] else None
        send_and_record(db, [(phone, channel)], result["reply"], alert_id=alert_id)
        db.commit()
    return result
