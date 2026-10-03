from typing import List

from pydantic import BaseModel


# Runtime facts the frontend needs instead of hard-coding them
class MetaResponse(BaseModel):
    app_name: str
    simulation: bool
    sms_provider: str
    severities: List[str]
    checkin_states: List[str]
    closed_states: List[str]
