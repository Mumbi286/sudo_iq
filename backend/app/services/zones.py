import json
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.zone import Zone


# Find a zone by name, ignoring case and surrounding spaces
def find_zone_by_name(db: Session, name: str) -> Optional[Zone]:
    return db.query(Zone).filter(func.lower(Zone.name) == name.strip().lower()).first()


# Validate a GeoJSON geometry as a usable zone outline; raises ValueError if not
def validate_zone_geometry(db: Session, geometry: dict) -> None:
    if geometry.get("type") != "Polygon":
        raise ValueError("Zone geometry must be a GeoJSON Polygon")
    is_valid = db.scalar(select(func.ST_IsValid(func.ST_GeomFromGeoJSON(json.dumps(geometry)))))
    if not is_valid:
        raise ValueError("Zone polygon is not valid (self-intersecting or not closed)")


# Create a zone from a GeoJSON polygon; raises ValueError on a duplicate name or bad geometry
def create_zone(db: Session, *, name: str, risk_level: int, geometry: dict) -> Zone:
    if find_zone_by_name(db, name) is not None:
        raise ValueError(f"A zone named {name!r} already exists")
    validate_zone_geometry(db, geometry)

    zone = Zone(
        name=name.strip(),
        risk_level=risk_level,
        geom=func.ST_SetSRID(func.ST_GeomFromGeoJSON(json.dumps(geometry)), 4326),
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


# Create every zone in a GeoJSON FeatureCollection; returns (created, skipped-with-reason)
def import_zones(db: Session, feature_collection: dict) -> Tuple[List[Zone], List[str]]:
    created: List[Zone] = []
    skipped: List[str] = []
    for feature in feature_collection.get("features", []):
        props = feature.get("properties") or {}
        name = props.get("name") or "unnamed"
        try:
            created.append(create_zone(
                db, name=name, risk_level=int(props.get("risk_level", 1)), geometry=feature.get("geometry") or {},
            ))
        except ValueError as exc:
            db.rollback()
            skipped.append(f"{name}: {exc}")
    return created, skipped


# Change a zone's name or risk level
def update_zone(db: Session, zone: Zone, *, name: Optional[str] = None, risk_level: Optional[int] = None) -> Zone:
    if name is not None and name.strip().lower() != zone.name.lower():
        if find_zone_by_name(db, name) is not None:
            raise ValueError(f"A zone named {name!r} already exists")
        zone.name = name.strip()
    if risk_level is not None:
        zone.risk_level = risk_level
    db.commit()
    db.refresh(zone)
    return zone
