from typing import Any, Dict, Generic, List, Literal, Optional, TypeVar

from pydantic import BaseModel

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
