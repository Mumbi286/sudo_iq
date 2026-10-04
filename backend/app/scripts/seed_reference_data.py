"""Seed zones and demo households from a GeoJSON file.

Run from backend/ after migrations:
    python -m app.scripts.seed_reference_data                       # Budalang'i demo
    python -m app.scripts.seed_reference_data path/to/zones.geojson # any other area

Each feature is one zone: a Polygon geometry with properties
`name`, `risk_level` (1-3) and `households` (how many demo households to generate).
Adding a new county is a data change, not a code change. Zones can also be added
at runtime through POST /zones and POST /zones/import.

Also creates the first admin account from FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD
in .env. Every other staff account is created through POST /users.

Safe to re-run: existing zones, households and users are left as they are.
"""
import json
import random
import sys
from pathlib import Path

from geoalchemy2 import WKTElement
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.enums import UserRole
from app.models.household import Household
from app.models.zone import Zone
from app.services.users import create_user, get_user_by_email
from app.services.zones import create_zone, find_zone_by_name

DEFAULT_ZONES_FILE = Path(__file__).parent / "data" / "budalangi.geojson"

FIRST_NAMES = ["Wanjala", "Nekesa", "Barasa", "Nafula", "Wafula", "Atieno", "Ouma",
               "Namalwa", "Okumu", "Auma", "Wekesa", "Nasimiyu", "Odhiambo", "Akinyi"]
LAST_NAMES = ["Ojiambo", "Wandera", "Mangeni", "Oduori", "Juma", "Ochieng",
              "Egesa", "Bwire", "Opiyo", "Mukoya"]


# load zone features from a GeoJSON file
def load_zone_features(path: Path) -> list:
    data = json.loads(path.read_text())
    features = data.get("features", [])
    for feature in features:
        if feature["geometry"]["type"] != "Polygon":
            raise ValueError(f"Zone {feature['properties'].get('name')!r} must be a Polygon")
    return features


# check if a point is inside a polygon ring (ray casting)
def point_in_ring(lon: float, lat: float, ring: list) -> bool:
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


# pick a random point inside a polygon by sampling its bounding box
def random_point_in_polygon(rng: random.Random, ring: list) -> tuple:
    lons = [lon for lon, _ in ring]
    lats = [lat for _, lat in ring]
    while True:
        lon, lat = rng.uniform(min(lons), max(lons)), rng.uniform(min(lats), max(lats))
        if point_in_ring(lon, lat, ring):
            return lon, lat


# create zone (through the same service the API uses)
def get_or_create_zone(db: Session, *, name: str, risk_level: int, geometry: dict) -> Zone:
    zone = find_zone_by_name(db, name)
    if zone is not None:
        return zone
    return create_zone(db, name=name, risk_level=risk_level, geometry=geometry)


# create the first admin from .env, so someone can log in and create the other accounts
def ensure_first_admin(db: Session) -> None:
    if not settings.FIRST_ADMIN_EMAIL or not settings.FIRST_ADMIN_PASSWORD:
        print("FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD not set: no admin created.")
        return
    if get_user_by_email(db, settings.FIRST_ADMIN_EMAIL) is not None:
        print(f"Admin {settings.FIRST_ADMIN_EMAIL} already exists.")
        return
    create_user(
        db, name="Admin", email=settings.FIRST_ADMIN_EMAIL,
        password=settings.FIRST_ADMIN_PASSWORD, role=UserRole.ADMIN,
    )
    print(f"Admin created: {settings.FIRST_ADMIN_EMAIL}")


# create households scattered inside a zone
def ensure_households(db: Session, *, rng: random.Random, ring: list, count: int, phone_start: int) -> int:
    created = 0
    for seq in range(phone_start, phone_start + count):
        # Draw the random values even when skipping, so re-runs stay identical
        head_name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        members = rng.randint(1, 8)
        # roughly a third of households have elderly, disabled or infant members
        vulnerable = rng.randint(1, min(members, 3)) if rng.random() < 0.35 else 0
        lon, lat = random_point_in_polygon(rng, ring)

        phone = f"+254700{seq:06d}"
        if db.query(Household.id).filter(Household.phone == phone).first() is not None:
            continue
        db.add(Household(
            head_name=head_name,
            phone=phone,
            members=members,
            vulnerable=vulnerable,
            geom=WKTElement(f"POINT({lon} {lat})", srid=4326),
        ))
        created += 1
    db.commit()
    return created


# seed the reference data for the database
def seed_reference_data(zones_file: Path = DEFAULT_ZONES_FILE) -> None:
    db = SessionLocal()
    rng = random.Random(42)  # same data every run, so the demo is repeatable
    try:
        ensure_first_admin(db)
        phone_start = 1
        for feature in load_zone_features(zones_file):
            props = feature["properties"]
            count = int(props.get("households", 0))
            get_or_create_zone(
                db,
                name=props["name"],
                risk_level=int(props.get("risk_level", 1)),
                geometry=feature["geometry"],
            )
            created = ensure_households(
                db, rng=rng, ring=feature["geometry"]["coordinates"][0], count=count, phone_start=phone_start,
            )
            phone_start += count
            print(f"{props['name']}: {created} new households ({count} expected)")

        print("Reference data seeded successfully.")
        print(f"Zones: {db.query(Zone).count()}, households: {db.query(Household).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_reference_data(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ZONES_FILE)
