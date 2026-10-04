from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel, Field

from app.models.enums import Channel

P = TypeVar("P")


# GeoJSON Feature: Leaflet reads this format directly
class Feature(BaseModel, Generic[P]):
    type: Literal["Feature"] = "Feature"
    geometry: Dict[str, Any]
    properties: P


# GeoJSON FeatureCollection
class FeatureCollection(BaseModel, Generic[P]):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: List[Feature[P]]


# Zone map properties
class ZoneProperties(BaseModel):
    id: int
    name: str
    risk_level: int
    households: int


# Household map properties; phone is deliberately left out of the map payload
class HouseholdProperties(BaseModel):
    id: int
    head_name: Optional[str]
    members: int
    vulnerable: int
    zone_id: Optional[int]
    channel: str
    # Check-in state for the requested alert, if any
    state: Optional[str] = None


# Household Create Schema: an operator registers a phone (e.g. a judge's real number)
class HouseholdCreate(BaseModel):
    phone: str = Field(min_length=9, description="07XXXXXXXX, 2547XXXXXXXX or +2547XXXXXXXX")
    zone_id: int
    channel: Channel = Channel.SMS
    members: int = Field(default=1, ge=1, le=50)
    vulnerable: int = Field(default=0, ge=0, le=50)
    head_name: Optional[str] = None


# Zone Create Schema: a GeoJSON polygon drawn or uploaded by an operator
class ZoneCreate(BaseModel):
    name: str = Field(min_length=1)
    risk_level: int = Field(default=1, ge=1, le=3)
    geometry: Dict[str, Any]


# Zone Update Schema
class ZoneUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    risk_level: Optional[int] = Field(default=None, ge=1, le=3)


# Zone Import Result Schema
class ZoneImportResult(BaseModel):
    created: List[str]
    skipped: List[str]
