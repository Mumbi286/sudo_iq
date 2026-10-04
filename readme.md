# Mlinzi: flash-flood alerts that account for every household

> *Mlinzi* (Swahili): guardian, protector.

**Flash floods give hours, sometimes minutes, of notice.** A generic area SMS reaches phones, but not outcomes. Responders have no live picture of who is safe, who needs help, and where.

**Mlinzi closes that loop.** It sends a geo-targeted alert to every registered household in a flood zone over **SMS or WhatsApp**, asks each one to reply **1 = safe / 2 = need help**, and shows responders a **live map** of who is accounted for, who needs help, and who to reach first.

> We don't measure messages sent. We measure **people accounted for**.

---

## Contents
- [Try it with your own phone](#try-it-with-your-own-phone)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Going live with real phones](#going-live-with-real-phones)
- [Configuration](#configuration)
- [API](#api)
- [Project structure](#project-structure)
- [Security & privacy](#security--privacy)
- [Business model](#business-model)
- [Roadmap](#roadmap)

---

## Try it with your own phone

During the demo, the dashboard shows a **"Try it on your phone"** QR code.

1. **Scan the QR code** (or open WhatsApp) and send `join <code>` to the Mlinzi WhatsApp number.
2. Send **`JIUNGE Nzoia Riverbank`** (*jiunge* = "join"). You're registered as a household in that flood zone, and a green-ringed dot appears on the map.
3. The operator issues an **EVACUATE** alert. **Your phone receives it on WhatsApp within seconds.**
4. Reply **`2`** (or `HELP` / `MSAADA`). On the big screen your dot turns **red**, jumps to the top of the rescue priority, and the **"% accounted for"** bar moves.

No WhatsApp? The operator can register your number for **SMS** from the dashboard (Africa's Talking live), and you'll receive the alert as a text message.

---

## What it does

| Problem | Mlinzi |
|---|---|
| Alerts are one-way | **Two-way**: every household must end in a known state (`SAFE`, `NEEDS_HELP`, ...) |
| Silence is ambiguous | **Escalation state machine**: no reply → resend → call → unreachable → responder queue (timers stored; engine in progress) |
| No live picture | **Operations map** with households coloured by state, "% accounted for", live activity feed |
| Help is duplicated or missed | **Priority score** (needs help > unreachable, + vulnerable members, + zone risk); responder claims are next on the roadmap |
| Feature phones and smartphones | **SMS and WhatsApp**: each household is reached on the channel it last used |
| Onboarding new areas is slow | Zones are **GeoJSON**: upload a county's flood zones via the API, no code change |
| No proof afterwards | Append-only **event log**, plus **cost per alert** and **cost per household accounted** |



## Architecture

```mermaid
flowchart LR
    subgraph Residents
        FP[Feature phone<br/>SMS]
        SP[Smartphone<br/>WhatsApp]
    end
    subgraph Providers
        AT[Africa's Talking<br/>SMS]
        TW[Twilio<br/>WhatsApp]
    end
    subgraph Mlinzi
        API[FastAPI<br/>REST + webhooks]
        SVC[Services<br/>alerts · inbound · checkins<br/>messaging · zones]
        DB[(PostgreSQL + PostGIS<br/>zones · households · alerts<br/>checkins · messages · events · users)]
        TICK[Escalation tick<br/>FOR UPDATE SKIP LOCKED]
    end
    UI[React operations dashboard<br/>Leaflet + Tailwind]

    UI -- issue alert / login --> API
    UI -- poll map, summary, feed --> API
    API --> SVC --> DB
    TICK -. "due check-ins (Phase 3)" .-> DB
    SVC -- outbound --> AT --> FP
    SVC -- outbound --> TW --> SP
    FP -- reply 1/2 --> AT -- webhook --> API
    SP -- reply 1/2 --> TW -- signed webhook --> API
```

### Key design decisions

| Decision | Why |
|---|---|
| **Escalation timers live in Postgres** (`checkins.next_action_at` + partial index), not in a task queue | Timers survive restarts, can be audited and cancelled (a reply just changes the state), and `FOR UPDATE SKIP LOCKED` lets several workers share the work without coordinating |
| **Every state change goes through one function** (`services/checkins.transition`) | It writes the audit event and recomputes priority and the next timer in one place, for SMS, WhatsApp or responder actions alike |
| **Messaging provider interface** per channel | Real or simulated providers swap via `.env`; a new channel (USSD, voice, cell broadcast) plugs in without touching callers |
| **Check-ins are committed before messages are sent** | A provider outage doesn't lose the alert; escalation retries |
| **Zone membership is computed, not stored** | Households are points and zones are polygons; `ST_Intersects` answers "who is in danger" even when zones are redrawn |
| **Data-driven UI** | Zones, severities, states, channels and the WhatsApp join code come from the API (`/meta`, `/zones`); the map frames itself on the data |

### Household state machine

```mermaid
stateDiagram-v2
    [*] --> SENT: alert issued
    SENT --> SAFE: reply 1
    SENT --> NEEDS_HELP: reply 2
    SENT --> RESENT: no reply (T1)
    RESENT --> CALLING: no reply (T2)
    CALLING --> UNREACHABLE: no reply (T3)
    RESENT --> SAFE: reply 1
    RESENT --> NEEDS_HELP: reply 2
    CALLING --> SAFE: reply 1
    CALLING --> NEEDS_HELP: reply 2
    UNREACHABLE --> SAFE: late reply 1
    UNREACHABLE --> NEEDS_HELP: late reply 2
    SAFE --> NEEDS_HELP: reply 2 later
    NEEDS_HELP --> ASSIGNED: responder claims
    UNREACHABLE --> ASSIGNED: responder claims
    ASSIGNED --> RESCUED
    RESCUED --> [*]
    SAFE --> [*]
```

Timers per severity are configurable (`ESCALATION_MINUTES_EVACUATE=5,10,20`, `ESCALATION_MINUTES_WARNING=15,30,60`). In simulation mode they run in seconds (`10,20,30`), so a full flood plays out on stage.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Leaflet / react-leaflet, keyless Esri + OSM tiles |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2, Alembic |
| Database | PostgreSQL 16 + PostGIS 3.4 (Docker) |
| Messaging | Africa's Talking (SMS), Twilio (WhatsApp), simulated providers for offline demos |
| Auth | JWT (PyJWT) + bcrypt, role-based access |
| Weather (planned) | Open-Meteo forecast and flood APIs (free, keyless) |

---

## Getting started

### Prerequisites
- Docker (for PostGIS)
- Python 3.12
- Node.js 20+

### 1. Database
```bash
docker compose up -d          # PostGIS on localhost:5433
```

### 2. Backend
```bash
cd backend
python3.12 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set JWT_SECRET_KEY and FIRST_ADMIN_* (see Configuration)

python -m alembic upgrade head                 # create tables
python -m app.scripts.seed_reference_data      # Budalang'i demo zones, 200 households, first admin
python -m uvicorn app.main:app --reload        # http://127.0.0.1:8000/docs
```
> Use `python -m ...` so the virtualenv's Python is used even if another Python is first on your PATH.

Seed another area from any GeoJSON file of Polygon zones:
```bash
python -m app.scripts.seed_reference_data path/to/zones.geojson
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173
```

Sign in with the `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` from `backend/.env`, pick a zone, and click **Issue alert**.

### Simulate a household reply without a phone
Open `http://127.0.0.1:8000/docs` → `POST /webhooks/sms` → *Try it out* with `from=+254700000001` and `text=2`.

---

## Deployment

| Part | Host | Notes |
|---|---|---|
| Database | **Neon** (free Postgres) | PostGIS is enabled automatically by the first migration run |
| API | **Render** (Docker, free) | [`render.yaml`](render.yaml) + [`backend/Dockerfile`](backend/Dockerfile): migrate → seed (idempotent) → serve |
| Frontend | **Vercel** | Root directory `frontend`, Vite preset, `VITE_API_URL` = the Render URL |

Render's free plan sleeps after ~15 minutes idle; open `/health` a minute before a demo to wake it.
Once deployed, the API's public URL is also the webhook URL for Africa's Talking: `https://<render-url>/webhooks/sms`.

## Going live with real phones

Webhooks need a public HTTPS URL: the deployed Render URL, or during local development a free Cloudflare tunnel (no account needed):
```bash
cloudflared tunnel --url http://localhost:8000
# → https://<random>.trycloudflare.com   (use this as PUBLIC_BASE_URL)
```

### WhatsApp (two-way, real numbers, free sandbox)
1. Create a free account at [twilio.com](https://www.twilio.com/try-twilio).
2. Console → **Messaging → Try it out → Send a WhatsApp message**. Note the sandbox number and the `join <code>` words.
3. **Sandbox settings** → *When a message comes in*: `https://<tunnel>/webhooks/whatsapp` (POST).
4. In `backend/.env`:
   ```
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_WHATSAPP_FROM=+14155238886
   TWILIO_SANDBOX_JOIN_CODE=<the two words after "join">
   PUBLIC_BASE_URL=https://<tunnel>
   ```
5. `pip install twilio`, then restart the API. The dashboard now shows the **Try it on your phone** QR code.

Sandbox note: each phone must send `join <code>` once, and the sandbox session lasts 72 hours. Production uses an approved WhatsApp Business sender and message templates.

### SMS (Africa's Talking)
- **Sandbox** (free): messages appear in the [AT simulator](https://developers.africastalking.com/simulator), not on real phones. Set `SMS_PROVIDER=africastalking`, `AT_USERNAME=sandbox`, `AT_API_KEY=<sandbox key>`, and point the sandbox SMS callback to `https://<tunnel>/webhooks/sms`.
- **Live**: real SMS to Kenyan numbers after activating and topping up a live app (`AT_USERNAME=<app username>`, live API key). Two-way SMS replies need a shortcode, which takes days to approve. Until then, WhatsApp provides the two-way channel.

---

## Configuration

All backend settings live in `backend/.env` (see [`backend/.env.example`](backend/.env.example)).

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | `postgresql+psycopg://postgres:mlinzi@localhost:5433/mlinzi` |
| `JWT_SECRET_KEY` | — | Sign tokens: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD` | — | First admin, created by the seed script |
| `SMS_PROVIDER` | `simulated` | `simulated` or `africastalking` |
| `WHATSAPP_PROVIDER` | `simulated` | `simulated` or `twilio` |
| `TWILIO_*`, `PUBLIC_BASE_URL` | — | WhatsApp credentials, sandbox join code, public URL for signature checks |
| `SIMULATION` | `true` | Escalation timers in seconds (`SIMULATION_ESCALATION_SECONDS`) |
| `ESCALATION_MINUTES_EVACUATE` / `_WARNING` | `5,10,20` / `15,30,60` | Minutes to resend, call, mark unreachable |
| `SMS_UNIT_COST_KES` / `WHATSAPP_UNIT_COST_KES` | `1.0` | Cost per alert figures |
| `CORS_ALLOW_ORIGINS` | Vite dev ports | Browser origins allowed to call the API |

Frontend (`frontend/.env`): `VITE_API_URL`, `VITE_POLL_MS` (default 3000), `VITE_BASEMAP` (`dark` / `satellite` / `streets`).

---

## API

Interactive docs: **`/docs`** (Swagger UI).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Email + password → bearer token |
| GET | `/auth/me` | any staff | Current user |
| GET / POST | `/users` | admin | List / create staff (operators, responders) |
| GET | `/meta` | — | Enums, providers, WhatsApp join info (drives the UI) |
| GET | `/zones` | — | Zones as GeoJSON with household counts |
| POST | `/zones` | operator | Create a zone from a GeoJSON Polygon |
| POST | `/zones/import` | operator | Import a GeoJSON FeatureCollection of zones |
| PATCH | `/zones/{id}` | operator | Rename / change risk level |
| GET | `/households?zone_id=&alert_id=` | — | Households as GeoJSON (no phone numbers), with state for an alert |
| POST | `/households` | operator | Register a phone in a zone (SMS or WhatsApp) |
| POST | `/alerts` | operator | Issue an alert to a zone |
| GET | `/alerts` | — | Recent alerts with live summary |
| GET | `/alerts/{id}/summary` | — | Counts per state, % accounted, messages and cost |
| GET | `/events?alert_id=` | — | Live activity feed |
| POST | `/webhooks/sms` | provider | Africa's Talking inbound SMS |
| POST | `/webhooks/whatsapp` | Twilio signature | Twilio inbound WhatsApp |
| GET | `/health` | — | API + database health (503 if the DB is down) |

---

## Project structure

```
.
├── docker-compose.yml            # PostGIS (local)
├── render.yaml                   # Render blueprint for the API
├── docs/business-model.md        # problem-solution fit, revenue, partners, unit economics
├── backend/
│   ├── alembic/                  # migrations (PostGIS-aware autogenerate)
│   └── app/
│       ├── main.py               # FastAPI app, CORS, health check
│       ├── core/config.py        # typed settings from .env
│       ├── db/                   # engine, session, Base, model registry
│       ├── models/               # zone, household, alert, checkin, message, event, user, enums
│       ├── schemas/              # pydantic request/response models
│       ├── services/             # alerts, inbound, checkins (state machine), messaging, zones,
│       │                         # households, geo, events, users, security, phones
│       ├── api/routes/           # auth, users, meta, zones, households, alerts, events, webhooks
│       └── scripts/              # seed_reference_data.py + data/*.geojson
└── frontend/
    └── src/
        ├── components/map/       # MapView, FitToZones, MapLegend, BasemapSwitcher
        ├── components/panel/     # GlassPanel, AccountedBar, ActivityFeed, CommandCard, TryItCard, ...
        ├── hooks/                # usePolling, useDashboardData, useAuth
        └── lib/                  # api client, basemaps, theme, stats, feed
```

---

## Security & privacy

- **Consent**: a household opts in by sending `JIUNGE`; `consent_at` is recorded.
- **Minimal data**: phone, household size, vulnerable count, location. **Phone numbers are never sent to the map.**
- **Webhook integrity**: Twilio requests are signature-checked; duplicate provider deliveries are ignored (`provider_msg_id` is unique).
- **Access control**: JWT with roles. Only operators issue alerts or change zones, and only admins manage staff.
- Designed with the **Kenya Data Protection Act 2019** in mind: purpose limitation, aggregation before sharing, local hosting.

---

## Business model

Households never pay. Counties and NDMA pay a subscription for accountable response. Telcos earn on messaging and M-Pesa relief payouts. Insurers and banks pay for consented, verified-impact data. Humanitarian agencies pay per activation for anticipatory action.

Full write-up, including unit economics (≈ KES 2 per household per alert), partners and go-to-market: **[docs/business-model.md](docs/business-model.md)**.

---

## Roadmap

- [x] PostGIS zones and households, GeoJSON onboarding
- [x] Alerts over SMS and WhatsApp, two-way replies, self-registration
- [x] Staff accounts with roles, live operations dashboard, cost per alert
- [ ] **Escalation engine**: resend → voice call → unreachable on timers
- [ ] Responder queue: claim → rescued, no double dispatch
- [ ] WebSocket push instead of polling
- [ ] Open-Meteo rain + river discharge → recommended alert, operator confirms
- [ ] USSD menu, voice calls (Africa's Talking), cell broadcast at scale
- [ ] M-Pesa (Daraja B2C) relief payouts to verified affected households
- [ ] Multi-county tenancy, offline-first responder app
