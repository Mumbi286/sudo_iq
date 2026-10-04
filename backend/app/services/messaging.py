"""Outbound messaging behind one interface per channel (SMS, WhatsApp).
Each household is reached on its preferred channel; every message is recorded,
so the demo never depends on the network and new providers plug in without touching callers."""
import logging
import uuid
from collections import defaultdict
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import Channel, MessageDirection
from app.models.message import Message

logger = logging.getLogger(__name__)

# Africa's Talking accepts many recipients per request; keep batches modest
SMS_BATCH_SIZE = 100


class MessagingProvider:
    channel: Channel = Channel.SMS
    name = "base"

    # Send one text to many phones; returns phone -> provider message id (None if that phone failed)
    def send(self, phones: List[str], text: str) -> Dict[str, Optional[str]]:
        raise NotImplementedError


# Logs instead of sending; ids look like real provider ids
class SimulatedProvider(MessagingProvider):
    name = "simulated"

    def __init__(self, channel: Channel) -> None:
        self.channel = channel

    def send(self, phones: List[str], text: str) -> Dict[str, Optional[str]]:
        logger.info("[simulated %s] to %d phone(s): %s", self.channel.value, len(phones), text)
        return {phone: f"sim-{uuid.uuid4()}" for phone in phones}


# Africa's Talking SMS: sandbox (simulator) or live (real Kenyan numbers), depending on AT_USERNAME/AT_API_KEY
class AfricasTalkingSmsProvider(MessagingProvider):
    channel = Channel.SMS
    name = "africastalking"

    def __init__(self) -> None:
        import africastalking

        africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
        self._sms = africastalking.SMS

    def send(self, phones: List[str], text: str) -> Dict[str, Optional[str]]:
        sent: Dict[str, Optional[str]] = {}
        kwargs = {"sender_id": settings.AT_SENDER_ID} if settings.AT_SENDER_ID else {}
        for start in range(0, len(phones), SMS_BATCH_SIZE):
            batch = phones[start:start + SMS_BATCH_SIZE]
            response = self._sms.send(text, batch, **kwargs)
            for recipient in response.get("SMSMessageData", {}).get("Recipients", []):
                message_id = recipient.get("messageId")
                ok = recipient.get("status") == "Success" and message_id not in (None, "None")
                if not ok:
                    logger.warning("SMS to %s failed: %s", recipient.get("number"), recipient.get("status"))
                sent[recipient["number"]] = message_id if ok else None
        return sent


# Twilio WhatsApp: the free sandbox works with real numbers that have sent "join <code>"
class TwilioWhatsAppProvider(MessagingProvider):
    channel = Channel.WHATSAPP
    name = "twilio"

    def __init__(self) -> None:
        from twilio.rest import Client

        self._client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    def send(self, phones: List[str], text: str) -> Dict[str, Optional[str]]:
        sent: Dict[str, Optional[str]] = {}
        for phone in phones:
            # One bad number (e.g. not joined to the sandbox) must not stop the others
            try:
                message = self._client.messages.create(
                    from_=f"whatsapp:{settings.TWILIO_WHATSAPP_FROM}", to=f"whatsapp:{phone}", body=text,
                )
                sent[phone] = message.sid
            except Exception:
                logger.exception("WhatsApp send failed for %s", phone)
                sent[phone] = None
        return sent


# The provider configured in .env for a channel
@lru_cache
def get_provider(channel: Channel) -> MessagingProvider:
    if channel == Channel.SMS and settings.SMS_PROVIDER == "africastalking":
        return AfricasTalkingSmsProvider()
    if channel == Channel.WHATSAPP and settings.WHATSAPP_PROVIDER == "twilio":
        return TwilioWhatsAppProvider()
    return SimulatedProvider(channel)


# Unit cost of one outbound message on a channel (for cost per alert)
def unit_cost(channel: Channel) -> float:
    return settings.WHATSAPP_UNIT_COST_KES if channel == Channel.WHATSAPP else settings.SMS_UNIT_COST_KES


# Send `text` to each (phone, channel) and record every message.
# A failed send is logged, not raised: the escalation engine will retry.
def send_and_record(
    db: Session, recipients: Iterable[Tuple[str, Channel]], text: str, alert_id: Optional[int] = None,
) -> int:
    by_channel: Dict[Channel, List[str]] = defaultdict(list)
    for phone, channel in recipients:
        by_channel[channel].append(phone)

    recorded = 0
    for channel, phones in by_channel.items():
        try:
            sent = get_provider(channel).send(phones, text)
        except Exception:
            logger.exception("%s send failed for %d phone(s)", channel.value, len(phones))
            continue
        for phone in phones:
            # Failed sends were logged by the provider; recording them would inflate cost per alert
            if sent.get(phone) is None:
                continue
            db.add(Message(
                provider_msg_id=sent[phone],
                direction=MessageDirection.OUTBOUND,
                channel=channel,
                phone=phone,
                body=text,
                alert_id=alert_id,
            ))
            recorded += 1
    return recorded
