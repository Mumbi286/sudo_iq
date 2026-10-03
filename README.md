# FloodAlert Kenya

A 5-hour hackathon starter for a hyperlocal flood alert system in Kenya, designed around the recent Nairobi flooding risk and the incoming El Niño rains.

## Problem

Flooding alerts often arrive too late, and local residents are the first to notice changes on the ground. This system turns resident reports into a fast, clustered, AI-assisted verification loop that helps responders identify flood hotspots earlier.

## Core loop

1. Resident reports flooding from SMS, WhatsApp, USSD, or social media.
2. The backend clusters nearby reports and scores confidence.
3. Weather and rainfall signals are checked against the report.
4. Verified alerts are pushed to nearby subscribers or responders.
5. The map shows report pins by status: unverified, verified, or rejected.

## Architecture

- Backend: Express.js API
- Frontend: React + Leaflet
- Data: in-memory demo store for hackathon speed
- AI/verification: rule-based confidence scoring with weather and report corroboration
- Weather: Open-Meteo

## Demo endpoints

- POST /api/reports - submit a resident flood report
- GET /api/reports - list recent reports
- POST /api/verify/:reportId - manually verify or reject a report
- GET /api/dashboard - return weather + flood + disaster context for a location
- GET /api/global-weather - global weather grid for the map
- GET /api/alerts - list generated alerts

## Quick start

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run start
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Then open the frontend in the browser and use the map and report form.

## Try the live report feed

After restarting the backend and starting the frontend, run this in another terminal:

```bash
cd backend
node seed-feed.js
```

The dashboard polls new reports every 5 seconds and refreshes the weather-backed risk score every 30 seconds. The score includes reports from the last hour within 5 km of the selected map location, capped at six reports for the report contribution. The default map location matches the Mathare demo feed.

## Social media and user data handling

For the hackathon demo, use minimal, consented, pseudonymized data only.

Recommended fields:

- timestamp
- latitude / longitude
- short text message
- source platform (WhatsApp, SMS, X)
- pseudonymous reporter ID (for example `user_17`)
- optional photo URL only if consent is explicit

Avoid storing by default:

- raw phone numbers
- usernames / social handles
- full profile metadata
- unrestricted photo files

Recommended policy:

- get explicit consent before storing location or media
- store only the minimum needed for verification
- separate raw personal data from operational data
- hash / pseudonymize reporter identities
- retain data only for a short, controlled TTL
- anonymize or delete old report records

This is enough for the demo while keeping the design privacy-aware and more production-ready.

## Verification logic

Each report is scored using signals such as:

- corroboration from nearby reports within roughly 500m
- weather match from rainfall signals in the area
- likely flood text or image indicator
- reporter trust score based on prior confirmed reports

The logic intentionally explains the confidence score so judges or responders can see why it was marked verified or unverified.

## Demo pitch flow

1. A resident reports flooding from a phone.
2. The map shows it as unverified.
3. More nearby reports arrive.
4. The score crosses the verification threshold.
5. The report becomes verified and a nearby alert is sent.
6. Responders see the flood hotspot on the map.

## Future extensions

- Supabase/Postgres with PostGIS
- Africa's Talking SMS / USSD integration
- Twilio WhatsApp sandbox integration
- AI vision check for flood imagery
- county government / NGO alert distribution
- admin review dashboard

## License

This starter is intended for hackathon use and demonstration purposes.
