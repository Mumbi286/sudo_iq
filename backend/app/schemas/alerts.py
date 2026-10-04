from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field

from app.models.enums import AlertSource, CheckinState, Severity


# Alert Create Schema
class AlertCreate(BaseModel):
    zone_id: int
    severity: Severity = Severity.WARNING
    # Leave empty to use the default wording for the severity
    message: Optional[str] = Field(default=None, max_length=459)  # 3 SMS segments


# Alert Summary Schema: the numbers the dashboard and the business case need
class AlertSummary(BaseModel):
    id: int
    zone_id: int
    zone_name: str
    severity: Severity
    source: AlertSource
    message: str
    created_at: datetime
    total: int
    accounted: int
    accounted_percent: float
    by_state: Dict[str, int]
    messages_sent: int
    messages_by_channel: Dict[str, int]
    message_cost_kes: float
    cost_per_accounted_kes: Optional[float]


# Event Response Schema: one line in the live activity feed
class EventResponse(BaseModel):
    id: int
    alert_id: int
    checkin_id: int
    household_id: int
    household_name: Optional[str]
    zone_name: str
    from_state: Optional[CheckinState]
    to_state: CheckinState
    note: Optional[str]
    created_at: datetime


# Inbound SMS Result Schema: what the webhook did with a message
class InboundResult(BaseModel):
    status: str
    detail: str
    checkin_id: Optional[int] = None
    state: Optional[CheckinState] = None
    reply: Optional[str] = None
