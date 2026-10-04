from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.enums import Channel
from app.models.household import Household
from app.models.zone import Zone
from app.services.phones import normalize_phone


# Find a household by phone (any format: 0712..., 254712..., +254712..., whatsapp:+254...)
def get_household_by_phone(db: Session, phone: str) -> Optional[Household]:
    return db.query(Household).filter(Household.phone == normalize_phone(phone)).first()


# Register a household inside a zone; without GPS it gets a random point within the zone.
# Raises ValueError if the phone is already registered. Does not commit.
def create_household(
    db: Session,
    *,
    phone: str,
    zone: Zone,
    channel: Channel = Channel.SMS,
    members: int = 1,
    vulnerable: int = 0,
    head_name: Optional[str] = None,
) -> Household:
    phone = normalize_phone(phone)
    if get_household_by_phone(db, phone) is not None:
        raise ValueError("This phone is already registered")
    household = Household(
        head_name=head_name,
        phone=phone,
        channel=channel,
        members=members,
        vulnerable=vulnerable,
        geom=func.ST_GeometryN(func.ST_GeneratePoints(zone.geom, 1), 1),
    )
    db.add(household)
    db.flush()
    return household
