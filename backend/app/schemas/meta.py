from typing import List

from pydantic import BaseModel


# How judges / residents can join on WhatsApp (disabled when WhatsApp is simulated)
class WhatsAppJoin(BaseModel):
    enabled: bool
    number: str
    join_code: str


# Runtime facts the frontend needs instead of hard-coding them
class MetaResponse(BaseModel):
    app_name: str
    simulation: bool
    sms_provider: str
    whatsapp_provider: str
    whatsapp: WhatsAppJoin
    channels: List[str]
    severities: List[str]
    checkin_states: List[str]
    closed_states: List[str]
