from typing import Optional

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.enums import Channel
from app.schemas.alerts import InboundResult
from app.services.inbound import handle_inbound_message


router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Empty TwiML: we reply through the API (so replies are recorded), not in the webhook response
EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'


# Africa's Talking inbound SMS callback (form-encoded: from, text, id, ...).
# Also usable from /docs to simulate a household replying.
@router.post("/sms", response_model=InboundResult)
def inbound_sms(
    from_: str = Form(alias="from", description="Sender phone, e.g. +254700000001"),
    text: str = Form(description="Message body, e.g. 1, 2 or JIUNGE Port Victoria"),
    id: Optional[str] = Form(default=None, description="Provider message id (deduplicates retries)"),
    db: Session = Depends(get_db),
) -> dict:
    return handle_inbound_message(db, phone=from_, text=text, channel=Channel.SMS, provider_msg_id=id)


# Reject requests that were not signed by Twilio (anyone could otherwise fake a household reply)
async def verify_twilio_signature(request: Request) -> None:
    if not settings.TWILIO_VALIDATE_SIGNATURE or settings.WHATSAPP_PROVIDER != "twilio":
        return
    from twilio.request_validator import RequestValidator

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}{request.url.path}" if settings.PUBLIC_BASE_URL else str(request.url)
    form = await request.form()
    signature = request.headers.get("X-Twilio-Signature", "")
    if not RequestValidator(settings.TWILIO_AUTH_TOKEN).validate(url, dict(form), signature):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid Twilio signature")


# Twilio WhatsApp inbound callback (form-encoded: From=whatsapp:+254..., Body, MessageSid)
@router.post("/whatsapp", dependencies=[Depends(verify_twilio_signature)])
def inbound_whatsapp(
    From: str = Form(description="whatsapp:+2547XXXXXXXX"),
    Body: str = Form(default=""),
    MessageSid: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
) -> Response:
    handle_inbound_message(db, phone=From, text=Body, channel=Channel.WHATSAPP, provider_msg_id=MessageSid)
    return Response(content=EMPTY_TWIML, media_type="application/xml")
