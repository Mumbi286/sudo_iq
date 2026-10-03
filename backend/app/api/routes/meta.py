from fastapi import APIRouter

from app.core.config import settings
from app.models.enums import CLOSED_STATES, CheckinState, Severity
from app.schemas.meta import MetaResponse


router = APIRouter(prefix="/meta", tags=["meta"])


# Expose enums and runtime settings so the UI is driven by the backend
@router.get("", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        app_name="Mlinzi",
        simulation=settings.SIMULATION,
        sms_provider=settings.SMS_PROVIDER,
        severities=[s.value for s in Severity],
        checkin_states=[s.value for s in CheckinState],
        closed_states=[s.value for s in CLOSED_STATES],
    )
