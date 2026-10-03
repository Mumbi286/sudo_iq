"""Seed demo data for Budalang'i (Busia County).

Run from backend/ after migrations:  python -m app.scripts.seed_reference_data
Safe to re-run: existing zones and households are left as they are.

Zone outlines are simplified rectangles around the Nzoia river mouth,
not official boundaries.
"""
import random

from geoalchemy2 import WKTElement
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.household import Household
from app.models.zone import Zone

# (name, risk_level, (min_lon, min_lat, max_lon, max_lat), household count)
ZONES = [
    ("Nzoia Riverbank", 3, (33.98, 0.08, 34.06, 0.11), 80),
    ("Budalang'i Centre", 2, (34.00, 0.11, 34.05, 0.14), 70),
    ("Port Victoria", 2, (33.94, 0.09, 33.98, 0.13), 50),
]

FIRST_NAMES = ["Wanjala", "Nekesa", "Barasa", "Nafula", "Wafula", "Atieno", "Ouma",
               "Namalwa", "Okumu", "Auma", "Wekesa", "Nasimiyu", "Odhiambo", "Akinyi"]
LAST_NAMES = ["Ojiambo", "Wandera", "Mangeni", "Oduori", "Juma", "Ochieng",
              "Egesa", "Bwire", "Opiyo", "Mukoya"]


def box_polygon(min_lon: float, min_lat: float, max_lon: float, max_lat: float) -> WKTElement:
    return WKTElement(
        f"POLYGON(({min_lon} {min_lat}, {max_lon} {min_lat}, {max_lon} {max_lat}, "
        f"{min_lon} {max_lat}, {min_lon} {min_lat}))",
        srid=4326,
    )


# create zone
def get_or_create_zone(db: Session, *, name: str, risk_level: int, bbox: tuple) -> Zone:
    zone = db.query(Zone).filter(Zone.name == name).first()
    if zone is not None:
        return zone

    zone = Zone(name=name, risk_level=risk_level, geom=box_polygon(*bbox))
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


# create households scattered inside a zone's bounding box
def ensure_households(db: Session, *, rng: random.Random, bbox: tuple, count: int, phone_start: int) -> int:
    min_lon, min_lat, max_lon, max_lat = bbox
    created = 0
    for seq in range(phone_start, phone_start + count):
        # Draw the random values even when skipping, so re-runs stay identical
        head_name = f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}"
        members = rng.randint(1, 8)
        # roughly a third of households have elderly, disabled or infant members
        vulnerable = rng.randint(1, min(members, 3)) if rng.random() < 0.35 else 0
        lon, lat = rng.uniform(min_lon, max_lon), rng.uniform(min_lat, max_lat)

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
def seed_reference_data() -> None:
    db = SessionLocal()
    rng = random.Random(42)  # same data every run, so the demo is repeatable
    try:
        phone_start = 1
        for name, risk_level, bbox, count in ZONES:
            get_or_create_zone(db, name=name, risk_level=risk_level, bbox=bbox)
            created = ensure_households(db, rng=rng, bbox=bbox, count=count, phone_start=phone_start)
            phone_start += count
            print(f"{name}: {created} new households ({count} expected)")

        print("Reference data seeded successfully.")
        print(f"Zones: {db.query(Zone).count()}, households: {db.query(Household).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_reference_data()
