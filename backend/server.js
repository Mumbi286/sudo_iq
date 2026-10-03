import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";
const FLOOD_API = "https://flood-api.open-meteo.com/v1/flood";
const GDACS_API =
  "https://www.gdacs.org/gdacsapi/api/Events/geteventlist/search";

const reports = [];
const alerts = [];
const reporterTrust = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashReporter(reporterId) {
  const raw = String(reporterId || "anonymous").trim();
  return raw.length > 4 ? `user_${raw.slice(-4)}` : `user_${raw || "anon"}`;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchRainSignal(lat, lon) {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("current", ["rain", "precipitation"].join(","));
  url.searchParams.set("hourly", ["precipitation_probability"].join(","));

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        rain: 0,
        probability: 0,
        match: false
      };
    }

    const data = await response.json();
    const rain = Number(data?.current?.rain ?? 0);
    const precipitationProbability = Number(
      data?.hourly?.precipitation_probability?.[0] ?? 0
    );

    return {
      rain,
      probability: precipitationProbability,
      match: rain >= 2 || precipitationProbability >= 60
    };
  } catch {
    return {
      rain: 0,
      probability: 0,
      match: false
    };
  }
}

function getPhotoCheck(text = "") {
  const normalized = String(text).toLowerCase();

  if (/(flood|overflow|waterlogged|road.*water|stagnant|underwater|blocked drain)/i.test(normalized)) {
    return "likely_flood";
  }

  if (/(stock|placeholder|example|banner|ad)/i.test(normalized)) {
    return "not_flood";
  }

  return "unknown";
}

function calculateReportScore(report, nearbyReports, weatherSignal) {
  const corroborationScore = Math.min(0.38, nearbyReports.length * 0.14);
  const weatherScore = weatherSignal.match ? 0.25 : 0.05;
  const photoScore =
    report.photoCheck === "likely_flood"
      ? 0.18
      : report.photoCheck === "unknown"
        ? 0.08
        : 0;
  const trust = clamp(reporterTrust.get(report.reporterId) ?? 0.55, 0.1, 1);
  const reporterScore = trust * 0.19;

  const total = clamp(
    corroborationScore + weatherScore + photoScore + reporterScore,
    0,
    1
  );

  return {
    score: Math.round(total * 100),
    corroborationScore,
    weatherScore,
    photoScore,
    reporterScore,
    factors: [
      `${nearbyReports.length} nearby reports within 500m`,
      weatherSignal.match ? "rainfall signal matches the report" : "rainfall signal is weak",
      `reporter trust ${trust.toFixed(2)}`,
      report.photoCheck === "likely_flood" ? "image/text appears to show flooding" : "image check inconclusive"
    ]
  };
}

function calculateRisk({
  rain24h = 0,
  rainProbability = 0,
  maxRainHourly = 0,
  riverDischarge = 0,
  nearbyDisasters = 0,
  redAlerts = 0,
  orangeAlerts = 0,
  nearbyReports = 0
}) {
  let score = 0;

  score += clamp(rain24h / 150, 0, 1) * 25;
  score += clamp(rainProbability / 100, 0, 1) * 12;
  score += clamp(maxRainHourly / 50, 0, 1) * 15;
  score += clamp(riverDischarge / 1000, 0, 1) * 15;
  score += clamp(nearbyDisasters / 10, 0, 1) * 10;
  score += clamp(redAlerts * 5 + orangeAlerts * 2, 0, 13);
  score += clamp(nearbyReports / 6, 0, 1) * 18;

  score = Math.round(clamp(score, 0, 100));

  let category = "OK";
  if (score >= 75) category = "SEVERE";
  else if (score >= 50) category = "HIGH";
  else if (score >= 25) category = "MODERATE";

  return { score, percentage: score, category };
}

function normalizeReport(input) {
  const lat = Number(input?.lat);
  const lon = Number(input?.lon);
  const text = String(input?.text || input?.message || "").trim();

  return {
    id: input?.id || crypto.randomUUID(),
    reporterId: hashReporter(input?.reporterId || "anonymous"),
    source: input?.source || "social_media",
    platform: input?.platform || "unknown",
    lat,
    lon,
    text: text.slice(0, 240),
    photoUrl: String(input?.photoUrl || "").trim(),
    consent: Boolean(input?.consent ?? true),
    createdAt: new Date().toISOString(),
    status: input?.status || "unverified",
    photoCheck: input?.photoCheck || "unknown",
    weatherMatch: Boolean(input?.weatherMatch ?? false),
    ai: input?.ai || null
  };
}

function createAlert(report, score) {
  const alert = {
    id: crypto.randomUUID(),
    reportId: report.id,
    title: "Flood verified near you",
    message: `Flooding reported in ${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}. Confidence ${score}%`,
    createdAt: new Date().toISOString(),
    status: "sent",
    region: `${report.lat.toFixed(4)}, ${report.lon.toFixed(4)}`
  };

  alerts.unshift(alert);
  return alert;
}

app.get("/api/dashboard", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      return res.status(400).json({
        error: "Valid lat and lon query parameters are required."
      });
    }

    const weatherUrl = new URL(OPEN_METEO);
    weatherUrl.searchParams.set("latitude", lat);
    weatherUrl.searchParams.set("longitude", lon);
    weatherUrl.searchParams.set("timezone", "auto");
    weatherUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "rain",
        "showers",
        "weather_code",
        "wind_speed_10m",
        "wind_gusts_10m"
      ].join(",")
    );
    weatherUrl.searchParams.set(
      "hourly",
      [
        "precipitation_probability",
        "precipitation",
        "rain",
        "showers",
        "wind_speed_10m",
        "wind_gusts_10m"
      ].join(",")
    );
    weatherUrl.searchParams.set(
      "daily",
      [
        "precipitation_sum",
        "rain_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max"
      ].join(",")
    );
    weatherUrl.searchParams.set("forecast_days", "7");

    const floodUrl = new URL(FLOOD_API);
    floodUrl.searchParams.set("latitude", lat);
    floodUrl.searchParams.set("longitude", lon);
    floodUrl.searchParams.set(
      "daily",
      "river_discharge,river_discharge_max"
    );
    floodUrl.searchParams.set("forecast_days", "7");

    const gdacsUrl = new URL(GDACS_API);
    gdacsUrl.searchParams.set(
      "fromdate",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    );
    gdacsUrl.searchParams.set("todate", new Date().toISOString().slice(0, 10));
    gdacsUrl.searchParams.set("pagesize", "100");

    const [weatherResponse, floodResponse, gdacsResponse] =
      await Promise.allSettled([fetch(weatherUrl), fetch(floodUrl), fetch(gdacsUrl)]);

    let weather = null;
    if (weatherResponse.status === "fulfilled" && weatherResponse.value.ok) {
      weather = await weatherResponse.value.json();
    }

    let flood = null;
    if (floodResponse.status === "fulfilled" && floodResponse.value.ok) {
      flood = await floodResponse.value.json();
    }

    let gdacsEvents = [];
    if (gdacsResponse.status === "fulfilled" && gdacsResponse.value.ok) {
      const data = await gdacsResponse.value.json();
      gdacsEvents = data?.features || data?.items || data?.events || data?.data || [];
    }

    const dailyRain = weather?.daily?.rain_sum?.filter((value) => Number.isFinite(value)) || [];
    const precipitation = weather?.hourly?.precipitation?.filter((value) => Number.isFinite(value)) || [];
    const precipitationProbability = weather?.hourly?.precipitation_probability?.filter((value) => Number.isFinite(value)) || [];

    const rain24h = dailyRain[0] || 0;
    const maxRainHourly = precipitation.length > 0 ? Math.max(...precipitation.slice(0, 24)) : 0;
    const maxRainProbability = precipitationProbability.length > 0 ? Math.max(...precipitationProbability.slice(0, 24)) : 0;

    const discharge = flood?.daily?.river_discharge?.filter((value) => Number.isFinite(value)) || [];
    const currentRiverDischarge = discharge[0] || 0;

    const disasters = gdacsEvents
      .map((event) => {
        const properties = event?.properties || event;
        let eventLat = null;
        let eventLon = null;

        if (event?.geometry?.coordinates && Array.isArray(event.geometry.coordinates)) {
          eventLon = Number(event.geometry.coordinates[0]);
          eventLat = Number(event.geometry.coordinates[1]);
        }

        eventLat = eventLat ?? Number(properties.latitude ?? properties.lat ?? properties.Latitude);
        eventLon = eventLon ?? Number(properties.longitude ?? properties.lon ?? properties.Longitude);

        return {
          id: properties.eventid || properties.eventId || properties.id || crypto.randomUUID(),
          type: properties.eventtype || properties.eventType || properties.type || "UNKNOWN",
          name: properties.name || properties.eventname || properties.eventName || "Unnamed event",
          alertLevel: properties.alertlevel || properties.alertLevel || "unknown",
          latitude: Number.isFinite(eventLat) ? eventLat : null,
          longitude: Number.isFinite(eventLon) ? eventLon : null,
          country: properties.country || properties.countryname || null,
          fromDate: properties.fromdate || properties.fromDate || null,
          toDate: properties.todate || properties.toDate || null
        };
      })
      .filter((event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude));

    const nearbyEvents = disasters
      .map((event) => ({
        ...event,
        distanceKm: Number(distanceKm(lat, lon, event.latitude, event.longitude).toFixed(1))
      }))
      .filter((event) => event.distanceKm <= 500)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const redAlerts = nearbyEvents.filter((event) => String(event.alertLevel).toLowerCase() === "red").length;
    const orangeAlerts = nearbyEvents.filter((event) => String(event.alertLevel).toLowerCase() === "orange").length;

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const nearbyReportCount = reports.filter(
      (report) =>
        new Date(report.createdAt).getTime() >= oneHourAgo &&
        distanceKm(lat, lon, report.lat, report.lon) <= 5
    ).length;

    const risk = calculateRisk({
      rain24h,
      rainProbability: maxRainProbability,
      maxRainHourly,
      riverDischarge: currentRiverDischarge,
      nearbyDisasters: nearbyEvents.length,
      redAlerts,
      orangeAlerts,
      nearbyReports: nearbyReportCount
    });

    const heatPoints = [];
    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        const pointLat = lat + y * 0.15;
        const pointLon = lon + x * 0.15;
        const distance = Math.sqrt(x * x + y * y);
        const falloff = clamp(1 - distance / 8, 0, 1);
        const pointRisk = Math.round(clamp(risk.score * (0.65 + falloff * 0.35), 0, 100));
        heatPoints.push([pointLat, pointLon, pointRisk / 100]);
      }
    }

    res.json({
      timestamp: new Date().toISOString(),
      location: { latitude: lat, longitude: lon },
      current: weather?.current || null,
      weather: { timezone: weather?.timezone || null, daily: weather?.daily || null, hourly: weather?.hourly || null },
      flood: { daily: flood?.daily || null },
      disasters: { totalGlobalRecent: disasters.length, nearby: nearbyEvents, nearbyCount: nearbyEvents.length, redAlerts, orangeAlerts },
      summary: {
        rain24hMm: Number(rain24h.toFixed(1)),
        maxHourlyRainMm: Number(maxRainHourly.toFixed(1)),
        maxRainProbability: Math.round(maxRainProbability),
        riverDischargeM3s: Number(currentRiverDischarge.toFixed(1)),
        nearbyDisasters: nearbyEvents.length,
        nearbyReports: nearbyReportCount
      },
      risk,
      heatPoints,
      reports: reports.slice(0, 30)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve disaster/weather data." });
  }
});

app.get("/api/global-weather", async (req, res) => {
  try {
    const locations = [];
    for (let lat = -60; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 15) {
        locations.push({ lat, lon });
      }
    }

    const results = [];
    const batchSize = 10;

    for (let i = 0; i < locations.length; i += batchSize) {
      const batch = locations.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ({ lat, lon }) => {
          const url = new URL(OPEN_METEO);
          url.searchParams.set("latitude", lat);
          url.searchParams.set("longitude", lon);
          url.searchParams.set(
            "current",
            ["temperature_2m", "precipitation", "rain", "wind_speed_10m", "weather_code"].join(",")
          );

          try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();

            return {
              lat,
              lon,
              temperature: data.current?.temperature_2m ?? null,
              precipitation: data.current?.precipitation ?? 0,
              rain: data.current?.rain ?? 0,
              wind: data.current?.wind_speed_10m ?? 0,
              weatherCode: data.current?.weather_code ?? null
            };
          } catch {
            return null;
          }
        })
      );

      results.push(...batchResults.filter(Boolean));
    }

    res.json({
      timestamp: new Date().toISOString(),
      points: results
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load global weather." });
  }
});

app.get("/api/reports", (req, res) => {
  const sorted = [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({
    generatedAt: new Date().toISOString(),
    reports: sorted.slice(0, 50)
  });
});

app.get("/api/alerts", (req, res) => {
  res.json({
    alerts: alerts.slice(0, 20)
  });
});

app.post("/api/reports", async (req, res) => {
  try {
    const payload = req.body || {};
    const lat = Number(payload.lat);
    const lon = Number(payload.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: "Valid latitude and longitude are required." });
    }

    const sanitized = normalizeReport({
      ...payload,
      reporterId: payload.reporterId || "anonymous",
      lat,
      lon,
      text: payload.text || payload.message || "",
      source: payload.source || "social_media",
      platform: payload.platform || "unknown",
      photoUrl: payload.photoUrl || "",
      consent: payload.consent !== false,
      weatherMatch: false,
      photoCheck: "unknown",
      status: "unverified"
    });

    const nearbyReports = reports.filter((report) => {
      const createdAt = new Date(report.createdAt).getTime();
      const reportAgeMinutes = (Date.now() - createdAt) / (60 * 1000);
      const sameArea = distanceKm(report.lat, report.lon, sanitized.lat, sanitized.lon) <= 0.5;
      return sameArea && reportAgeMinutes <= 30;
    });

    const weatherSignal = await fetchRainSignal(sanitized.lat, sanitized.lon);
    sanitized.weatherMatch = weatherSignal.match;
    sanitized.photoCheck = getPhotoCheck(sanitized.text + " " + sanitized.photoUrl);

    const ai = calculateReportScore(sanitized, nearbyReports, weatherSignal);
    sanitized.ai = {
      ...ai,
      photoCheck: sanitized.photoCheck,
      weatherMatch: weatherSignal.match,
      scoreLabel: ai.score >= 70 ? "verified" : ai.score >= 40 ? "needs review" : "rejected"
    };

    sanitized.status = ai.score >= 70 ? "verified" : "unverified";
    reports.unshift(sanitized);

    const currentTrust = reporterTrust.get(sanitized.reporterId) ?? 0.55;
    if (sanitized.status === "verified") {
      reporterTrust.set(sanitized.reporterId, Math.min(0.98, currentTrust + 0.15));
      createAlert(sanitized, ai.score);
    } else {
      reporterTrust.set(sanitized.reporterId, Math.max(0.1, currentTrust - 0.05));
    }

    res.status(201).json({
      message: sanitized.status === "verified" ? "Report verified and pushed to nearby subscribers." : "Report stored for review.",
      report: sanitized,
      score: ai.score
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create flood report." });
  }
});

app.post("/api/verify/:reportId", (req, res) => {
  try {
    const { reportId } = req.params;
    const status = String(req.body?.status || "verified").toLowerCase();
    const report = reports.find((item) => item.id === reportId);

    if (!report) {
      return res.status(404).json({ error: "Report not found." });
    }

    report.status = ["verified", "rejected", "unverified"].includes(status) ? status : "unverified";

    const currentTrust = reporterTrust.get(report.reporterId) ?? 0.55;
    if (report.status === "verified") {
      reporterTrust.set(report.reporterId, Math.min(0.98, currentTrust + 0.12));
      createAlert(report, report.ai?.score || 75);
    } else if (report.status === "rejected") {
      reporterTrust.set(report.reporterId, Math.max(0.1, currentTrust - 0.2));
    }

    res.json({
      message: `Report ${report.status}.`,
      report
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update report verification." });
  }
});

app.get("/", (req, res) => {
  res.json({
    name: "FloodAlert Kenya API",
    status: "ok",
    dashboard: "Start the frontend with `cd frontend && npm run dev`, then open http://localhost:5173.",
    endpoints: {
      health: "GET /health",
      dashboard: "GET /api/dashboard?lat=-1.2921&lon=36.8219",
      reports: "GET /api/reports",
      submitReport: "POST /api/reports",
      verifyReport: "POST /api/verify/:reportId",
      alerts: "GET /api/alerts"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Disaster API running on http://localhost:${PORT}`);

  reports.push(
    normalizeReport({
      id: "seed-1",
      reporterId: "demo-1",
      source: "social_media",
      platform: "X",
      lat: -1.2861,
      lon: 36.8369,
      text: "Road under water near Mathare, cars stranded.",
      photoUrl: "",
      consent: true,
      createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      status: "verified",
      photoCheck: "likely_flood",
      weatherMatch: true,
      ai: {
        score: 84,
        factors: ["3 nearby reports within 500m", "heavy rain detected", "reporter trust 0.78", "image appears to show flooding"],
        scoreLabel: "verified"
      }
    }),
    normalizeReport({
      id: "seed-2",
      reporterId: "demo-2",
      source: "whatsapp",
      platform: "WhatsApp",
      lat: -1.2867,
      lon: 36.8375,
      text: "Drain overflow at Huruma, people moving goods.",
      photoUrl: "",
      consent: true,
      createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      status: "verified",
      photoCheck: "likely_flood",
      weatherMatch: true,
      ai: {
        score: 81,
        factors: ["2 nearby reports within 500m", "heavy rain detected", "reporter trust 0.72", "image appears to show flooding"],
        scoreLabel: "verified"
      }
    }),
    normalizeReport({
      id: "seed-3",
      reporterId: "demo-3",
      source: "sms",
      platform: "SMS",
      lat: -1.2914,
      lon: 36.8199,
      text: "Kibera section flooded, water reached homes.",
      photoUrl: "",
      consent: true,
      createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      status: "unverified",
      photoCheck: "likely_flood",
      weatherMatch: true,
      ai: {
        score: 67,
        factors: ["1 nearby report within 500m", "rainfall signal matches", "reporter trust 0.61", "image check inconclusive"],
        scoreLabel: "needs review"
      }
    })
  );

  reporterTrust.set("user_1", 0.79);
  reporterTrust.set("user_2", 0.74);
  reporterTrust.set("user_3", 0.61);
});
