from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import require_operator
from app.db.session import get_db
from app.models.user import User
from app.models.zone import Zone
from app.schemas.geo import Feature, FeatureCollection, ZoneCreate, ZoneImportResult, ZoneProperties, ZoneUpdate
from app.services.geo import get_zones_with_counts
from app.services.zones import create_zone, import_zones, update_zone


router = APIRouter(prefix="/zones", tags=["zones"])


def _zone_feature(db: Session, zone_id: int) -> Feature[ZoneProperties]:
    zone, geometry, count = get_zones_with_counts(db, zone_id)[0]
    return Feature[ZoneProperties](
        geometry=geometry,
        properties=ZoneProperties(id=zone.id, name=zone.name, risk_level=zone.risk_level, households=count),
    )


# List all zones as GeoJSON for the map
@router.get("", response_model=FeatureCollection[ZoneProperties])
def list_zones(db: Session = Depends(get_db)) -> FeatureCollection[ZoneProperties]:
    return FeatureCollection[ZoneProperties](
        features=[
            Feature[ZoneProperties](
                geometry=geometry,
                properties=ZoneProperties(
                    id=zone.id,
                    name=zone.name,
                    risk_level=zone.risk_level,
                    households=count,
                ),
            )
            for zone, geometry, count in get_zones_with_counts(db)
        ]
    )


# Create one zone from a GeoJSON polygon (operator or admin)
@router.post("", status_code=status.HTTP_201_CREATED, response_model=Feature[ZoneProperties])
def add_zone(
    payload: ZoneCreate,
    db: Session = Depends(get_db),
    operator: User = Depends(require_operator),
) -> Feature[ZoneProperties]:
    del operator  # dependency enforces role
    try:
        zone = create_zone(db, name=payload.name, risk_level=payload.risk_level, geometry=payload.geometry)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return _zone_feature(db, zone.id)


# Onboard an area by uploading a GeoJSON FeatureCollection of zones (operator or admin)
@router.post("/import", response_model=ZoneImportResult)
def import_zone_collection(
    payload: FeatureCollection[dict],
    db: Session = Depends(get_db),
    operator: User = Depends(require_operator),
) -> ZoneImportResult:
    del operator  # dependency enforces role
    created, skipped = import_zones(db, payload.model_dump())
    return ZoneImportResult(created=[zone.name for zone in created], skipped=skipped)


# Rename a zone or change its risk level (operator or admin)
@router.patch("/{zone_id}", response_model=Feature[ZoneProperties])
def edit_zone(
    zone_id: int,
    payload: ZoneUpdate,
    db: Session = Depends(get_db),
    operator: User = Depends(require_operator),
) -> Feature[ZoneProperties]:
    del operator  # dependency enforces role
    zone = db.get(Zone, zone_id)
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    try:
        update_zone(db, zone, name=payload.name, risk_level=payload.risk_level)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _zone_feature(db, zone.id)
