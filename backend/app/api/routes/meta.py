from fastapi import APIRouter

from app.core.config import settings
from app.models.enums import CLOSED_STATES, Channel, CheckinState, Severity
from app.schemas.meta import MetaResponse, WhatsAppJoin


router = APIRouter(prefix="/meta", tags=["meta"])


# Expose enums and runtime settings so the UI is driven by the backend
@router.get("", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        app_name="Mlinzi",
        simulation=settings.SIMULATION,
        sms_provider=settings.SMS_PROVIDER,
        whatsapp_provider=settings.WHATSAPP_PROVIDER,
        whatsapp=WhatsAppJoin(
            enabled=settings.WHATSAPP_PROVIDER == "twilio" and bool(settings.TWILIO_SANDBOX_JOIN_CODE),
            number=settings.TWILIO_WHATSAPP_FROM,
            join_code=settings.TWILIO_SANDBOX_JOIN_CODE,
        ),
        channels=[c.value for c in Channel],
        severities=[s.value for s in Severity],
        checkin_states=[s.value for s in CheckinState],
        closed_states=[s.value for s in CLOSED_STATES],
    )
