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

// GDACS API
const GDACS_API =
  "https://www.gdacs.org/gdacsapi/api/Events/geteventlist/search";

/*
 * Clamp utility
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/*
 * Calculate a simple dashboard risk indicator.

 * IMPORTANT:
 * This is NOT an official warning system.
 */
function calculateRisk({
  rain24h = 0,
  rainProbability = 0,
  maxRainHourly = 0,
  riverDischarge = 0,
  nearbyDisasters = 0,
  redAlerts = 0,
  orangeAlerts = 0
}) {
  let score = 0;

  // Rain contribution
  score += clamp(rain24h / 150, 0, 1) * 30;

  // Probability of precipitation
  score += clamp(rainProbability / 100, 0, 1) * 15;

  // Peak hourly rain
  score += clamp(maxRainHourly / 50, 0, 1) * 20;

  // Flood/river signal
  score += clamp(riverDischarge / 1000, 0, 1) * 20;

  // Nearby disasters
  score += clamp(nearbyDisasters / 10, 0, 1) * 10;

  // Higher-severity GDACS alerts
  score += clamp(redAlerts * 5 + orangeAlerts * 2, 0, 15);

  score = Math.round(clamp(score, 0, 100));

  let category = "OK";

  if (score >= 75) {
    category = "SEVERE";
  } else if (score >= 50) {
    category = "HIGH";
  } else if (score >= 25) {
    category = "MODERATE";
  }

  return {
    score,
    percentage: score,
    category
  };
}

/*
 * GET WEATHER + FLOOD + DISASTER DATA
 *
 * Example:
 * /api/dashboard?lat=-1.2921&lon=36.8219
 */
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

    /*
     * Open-Meteo weather
     */
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

    /*
     * Flood API / GloFAS
     */
    const floodUrl = new URL(FLOOD_API);

    floodUrl.searchParams.set("latitude", lat);
    floodUrl.searchParams.set("longitude", lon);

    floodUrl.searchParams.set(
      "daily",
      "river_discharge,river_discharge_max"
    );

    floodUrl.searchParams.set("forecast_days", "7");

    /*
     * GDACS
     *
     * We query recent events and then perform a local distance
     * calculation because GDACS event geometry can vary by event.
     */
    const gdacsUrl = new URL(GDACS_API);

    gdacsUrl.searchParams.set(
      "fromdate",
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    );

    gdacsUrl.searchParams.set(
      "todate",
      new Date().toISOString().slice(0, 10)
    );

    gdacsUrl.searchParams.set("pagesize", "100");

    const [weatherResponse, floodResponse, gdacsResponse] =
      await Promise.allSettled([
        fetch(weatherUrl),
        fetch(floodUrl),
        fetch(gdacsUrl)
      ]);

    /*
     * Weather
     */
    let weather = null;

    if (weatherResponse.status === "fulfilled") {
      if (weatherResponse.value.ok) {
        weather = await weatherResponse.value.json();
      }
    }

    /*
     * Flood
     */
    let flood = null;

    if (floodResponse.status === "fulfilled") {
      if (floodResponse.value.ok) {
        flood = await floodResponse.value.json();
      }
    }

    /*
     * GDACS
     */
    let gdacsEvents = [];

    if (gdacsResponse.status === "fulfilled") {
      if (gdacsResponse.value.ok) {
        const data = await gdacsResponse.value.json();

        /*
         * GDACS API schemas can evolve.
         * Handle several common shapes.
         */
        gdacsEvents =
          data?.features ||
          data?.items ||
          data?.events ||
          data?.data ||
          [];
      }
    }

    /*
     * Extract rainfall statistics
     */
    const dailyRain =
      weather?.daily?.rain_sum?.filter(
        (value) => Number.isFinite(value)
      ) || [];

    const precipitation =
      weather?.hourly?.precipitation?.filter(
        (value) => Number.isFinite(value)
      ) || [];

    const precipitationProbability =
      weather?.hourly?.precipitation_probability?.filter(
        (value) => Number.isFinite(value)
      ) || [];

    const rain24h = dailyRain[0] || 0;

    const maxRainHourly =
      precipitation.length > 0
        ? Math.max(...precipitation.slice(0, 24))
        : 0;

    const maxRainProbability =
      precipitationProbability.length > 0
        ? Math.max(...precipitationProbability.slice(0, 24))
        : 0;

    /*
     * Flood statistics
     */
    const discharge =
      flood?.daily?.river_discharge?.filter(
        (value) => Number.isFinite(value)
      ) || [];

    const currentRiverDischarge = discharge[0] || 0;

    /*
     * Normalize disaster objects.
     */
    const disasters = gdacsEvents
      .map((event) => {
        const properties = event?.properties || event;

        let eventLat = null;
        let eventLon = null;

        if (event?.geometry?.coordinates) {
          const coordinates = event.geometry.coordinates;

          if (Array.isArray(coordinates)) {
            eventLon = Number(coordinates[0]);
            eventLat = Number(coordinates[1]);
          }
        }

        eventLat =
          eventLat ??
          Number(
            properties.latitude ??
              properties.lat ??
              properties.Latitude
          );

        eventLon =
          eventLon ??
          Number(
            properties.longitude ??
              properties.lon ??
              properties.Longitude
          );

        return {
          id:
            properties.eventid ||
            properties.eventId ||
            properties.id ||
            crypto.randomUUID(),

          type:
            properties.eventtype ||
            properties.eventType ||
            properties.type ||
            "UNKNOWN",

          name:
            properties.name ||
            properties.eventname ||
            properties.eventName ||
            "Unnamed event",

          alertLevel:
            properties.alertlevel ||
            properties.alertLevel ||
            "unknown",

          latitude: Number.isFinite(eventLat)
            ? eventLat
            : null,

          longitude: Number.isFinite(eventLon)
            ? eventLon
            : null,

          country:
            properties.country ||
            properties.countryname ||
            null,

          fromDate:
            properties.fromdate ||
            properties.fromDate ||
            null,

          toDate:
            properties.todate ||
            properties.toDate ||
            null
        };
      })
      .filter((event) => {
        return (
          Number.isFinite(event.latitude) &&
          Number.isFinite(event.longitude)
        );
      });

    /*
     * Haversine distance
     */
    function distanceKm(lat1, lon1, lat2, lon2) {
      const R = 6371;

      const dLat =
        ((lat2 - lat1) * Math.PI) / 180;

      const dLon =
        ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;

      return (
        2 *
        R *
        Math.atan2(
          Math.sqrt(a),
          Math.sqrt(1 - a)
        )
      );
    }

    /*
     * Events within 500km of selected location.
     */
    const nearbyEvents = disasters
      .map((event) => ({
        ...event,
        distanceKm: Number(
          distanceKm(
            lat,
            lon,
            event.latitude,
            event.longitude
          ).toFixed(1)
        )
      }))
      .filter((event) => event.distanceKm <= 500)
      .sort(
        (a, b) =>
          a.distanceKm - b.distanceKm
      );

    const redAlerts = nearbyEvents.filter(
      (event) =>
        String(event.alertLevel).toLowerCase() ===
        "red"
    ).length;

    const orangeAlerts = nearbyEvents.filter(
      (event) =>
        String(event.alertLevel).toLowerCase() ===
        "orange"
    ).length;

    /*
     * Risk calculation
     */
    const risk = calculateRisk({
      rain24h,
      rainProbability: maxRainProbability,
      maxRainHourly,
      riverDischarge: currentRiverDischarge,
      nearbyDisasters: nearbyEvents.length,
      redAlerts,
      orangeAlerts
    });

    /*
     * Generate heat points around selected area.
     *
     * These are interpolation points based on the selected
     * weather/flood/disaster signal. They are NOT observations
     * at each point.
     */
    const heatPoints = [];

    for (let y = -5; y <= 5; y++) {
      for (let x = -5; x <= 5; x++) {
        const pointLat = lat + y * 0.15;
        const pointLon = lon + x * 0.15;

        const distance =
          Math.sqrt(x * x + y * y);

        const falloff = clamp(
          1 - distance / 8,
          0,
          1
        );

        const pointRisk = Math.round(
          clamp(
            risk.score * (0.65 + falloff * 0.35),
            0,
            100
          )
        );

        heatPoints.push([
          pointLat,
          pointLon,
          pointRisk / 100
        ]);
      }
    }

    res.json({
      timestamp: new Date().toISOString(),

      location: {
        latitude: lat,
        longitude: lon
      },

      current: weather?.current || null,

      weather: {
        timezone: weather?.timezone || null,
        daily: weather?.daily || null,
        hourly: weather?.hourly || null
      },

      flood: {
        daily: flood?.daily || null
      },

      disasters: {
        totalGlobalRecent: disasters.length,
        nearby: nearbyEvents,
        nearbyCount: nearbyEvents.length,
        redAlerts,
        orangeAlerts
      },

      summary: {
        rain24hMm: Number(rain24h.toFixed(1)),
        maxHourlyRainMm: Number(
          maxRainHourly.toFixed(1)
        ),
        maxRainProbability: Math.round(
          maxRainProbability
        ),
        riverDischargeM3s: Number(
          currentRiverDischarge.toFixed(1)
        ),
        nearbyDisasters: nearbyEvents.length
      },

      risk,

      heatPoints
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to retrieve disaster/weather data."
    });
  }
});


/*
 * Global weather endpoint.
 *
 * Used to populate a world map with weather cells.
 *
 * Example:
 * /api/global-weather
 */
app.get("/api/global-weather", async (req, res) => {
  try {
    /*
     * A coarse global grid.
     *
     * Increase resolution later if needed.
     */
    const locations = [];

    for (let lat = -60; lat <= 75; lat += 15) {
      for (let lon = -180; lon < 180; lon += 15) {
        locations.push({
          lat,
          lon
        });
      }
    }

    const results = [];

    /*
     * Don't hammer the weather provider.
     * Process a few locations concurrently.
     */
    const batchSize = 10;

    for (
      let i = 0;
      i < locations.length;
      i += batchSize
    ) {
      const batch = locations.slice(
        i,
        i + batchSize
      );

      const batchResults =
        await Promise.all(
          batch.map(async ({ lat, lon }) => {
            const url = new URL(OPEN_METEO);

            url.searchParams.set(
              "latitude",
              lat
            );

            url.searchParams.set(
              "longitude",
              lon
            );

            url.searchParams.set(
              "current",
              [
                "temperature_2m",
                "precipitation",
                "rain",
                "wind_speed_10m",
                "weather_code"
              ].join(",")
            );

            try {
              const response =
                await fetch(url);

              if (!response.ok) {
                return null;
              }

              const data =
                await response.json();

              return {
                lat,
                lon,
                temperature:
                  data.current
                    ?.temperature_2m ?? null,

                precipitation:
                  data.current
                    ?.precipitation ?? 0,

                rain:
                  data.current?.rain ?? 0,

                wind:
                  data.current
                    ?.wind_speed_10m ?? 0,

                weatherCode:
                  data.current
                    ?.weather_code ?? null
              };
            } catch {
              return null;
            }
          })
        );

      results.push(
        ...batchResults.filter(Boolean)
      );
    }

    res.json({
      timestamp: new Date().toISOString(),
      points: results
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to load global weather."
    });
  }
});


app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});


app.listen(PORT, () => {
  console.log(
    `Disaster API running on http://localhost:${PORT}`
  );
});
