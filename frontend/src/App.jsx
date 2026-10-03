import {
  useEffect,
  useState
} from "react";

import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  useMap
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const API =
  "http://localhost:4000";


function RiskColor({ score }) {
  if (score >= 75) return "#dc2626";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#facc15";

  return "#22c55e";
}


function RiskLabel({ score }) {
  if (score >= 75) return "SEVERE";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";

  return "OK";
}


function MapCenter({
  latitude,
  longitude
}) {
  const map = useMap();

  useEffect(() => {
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      map.setView(
        [latitude, longitude],
        7
      );
    }
  }, [
    latitude,
    longitude,
    map
  ]);

  return null;
}


function RiskHeatLayer({
  points
}) {
  return (
    <>
      {points.map(
        (point, index) => {
          const [
            lat,
            lon,
            intensity
          ] = point;

          const score =
            Math.round(
              intensity * 100
            );

          return (
            <Circle
              key={index}
              center={[lat, lon]}
              radius={18000}
              pathOptions={{
                stroke: false,
                fillColor:
                  RiskColor(score),
                fillOpacity:
                  0.18
              }}
            />
          );
        }
      )}
    </>
  );
}


function DisasterMarkers({
  events
}) {
  return (
    <>
      {events.map(
        (event) => (
          <CircleMarker
            key={event.id}
            center={[
              event.latitude,
              event.longitude
            ]}
            radius={9}
            pathOptions={{
              color:
                event.alertLevel ===
                "red"
                  ? "#dc2626"
                  : event.alertLevel ===
                    "orange"
                  ? "#f97316"
                  : "#eab308",

              fillOpacity: 0.9
            }}
          >
            <Popup>
              <strong>
                {event.name}
              </strong>

              <br />

              Type:{" "}
              {event.type}

              <br />

              Alert:{" "}
              {event.alertLevel}

              <br />

              Distance:{" "}
              {event.distanceKm} km

              {event.country && (
                <>
                  <br />
                  Country:{" "}
                  {event.country}
                </>
              )}
            </Popup>
          </CircleMarker>
        )
      )}
    </>
  );
}


function SummaryCard({
  title,
  value,
  unit,
  color
}) {
  return (
    <div className="summary-card">
      <div className="summary-title">
        {title}
      </div>

      <div
        className="summary-value"
        style={{
          color
        }}
      >
        {value}
        {unit && (
          <span className="unit">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}


export default function App() {
  const [
    dashboard,
    setDashboard
  ] = useState(null);

  const [
    globalWeather,
    setGlobalWeather
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(false);

  const [
    error,
    setError
  ] = useState("");

  const [
    latitude,
    setLatitude
  ] = useState(-1.2921);

  const [
    longitude,
    setLongitude
  ] = useState(36.8219);

  /*
   * Query backend.
   */
  async function loadDashboard(
    lat = latitude,
    lon = longitude
  ) {
    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          `${API}/api/dashboard?lat=${lat}&lon=${lon}`
        );

      if (!response.ok) {
        throw new Error(
          "API request failed"
        );
      }

      const data =
        await response.json();

      setDashboard(data);

      setLatitude(lat);
      setLongitude(lon);
    } catch (err) {
      console.error(err);

      setError(
        "Could not retrieve live disaster/weather data."
      );
    } finally {
      setLoading(false);
    }
  }


  /*
   * GPS.
   */
  function useGPS() {
    if (
      !navigator.geolocation
    ) {
      setError(
        "Geolocation is not supported by this browser."
      );

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        loadDashboard(
          position.coords.latitude,
          position.coords.longitude
        );
      },
      () => {
        setError(
          "Location permission was denied."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  }


  /*
   * Initial dashboard.
   */
  useEffect(() => {
    loadDashboard();
  }, []);


  /*
   * Refresh dashboard every 5 minutes.
   */
  useEffect(() => {
    const interval =
      setInterval(
        () => {
          loadDashboard(
            latitude,
            longitude
          );
        },
        5 * 60 * 1000
      );

    return () =>
      clearInterval(interval);
  }, [
    latitude,
    longitude
  ]);


  /*
   * Global weather.
   */
  useEffect(() => {
    async function loadGlobalWeather() {
      try {
        const response =
          await fetch(
            `${API}/api/global-weather`
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        setGlobalWeather(
          data.points || []
        );
      } catch (error) {
        console.error(error);
      }
    }

    loadGlobalWeather();

    const interval =
      setInterval(
        loadGlobalWeather,
        10 * 60 * 1000
      );

    return () =>
      clearInterval(interval);
  }, []);


  const risk =
    dashboard?.risk?.score ?? 0;

  const riskColor =
    RiskColor(risk);


  return (
    <div className="app">
      <header>
        <div>
          <h1>
            Global Disaster Monitor
          </h1>

          <p>
            Weather, rainfall, flood
            and disaster intelligence
          </p>
        </div>

        <div className="header-actions">
          <button
            onClick={useGPS}
            className="gps-button"
          >
            📍 Use my location
          </button>

          <button
            onClick={() =>
              loadDashboard()
            }
          >
            Refresh
          </button>
        </div>
      </header>


      {error && (
        <div className="error">
          {error}
        </div>
      )}


      {/* LOCATION SEARCH */}
      <section className="location-panel">
        <div>
          <label>
            Latitude
          </label>

          <input
            type="number"
            step="0.0001"
            value={latitude}
            onChange={(event) =>
              setLatitude(
                Number(
                  event.target.value
                )
              )
            }
          />
        </div>

        <div>
          <label>
            Longitude
          </label>

          <input
            type="number"
            step="0.0001"
            value={longitude}
            onChange={(event) =>
              setLongitude(
                Number(
                  event.target.value
                )
              )
            }
          />
        </div>

        <button
          onClick={() =>
            loadDashboard(
              latitude,
              longitude
            )
          }
        >
          Query location
        </button>
      </section>


      {/* TOP STATS */}
      <section className="stats">
        <SummaryCard
          title="24h rainfall"
          value={
            dashboard?.summary
              ?.rain24hMm ?? "—"
          }
          unit=" mm"
          color="#38bdf8"
        />

        <SummaryCard
          title="Peak hourly rain"
          value={
            dashboard?.summary
              ?.maxHourlyRainMm ?? "—"
          }
          unit=" mm"
          color="#60a5fa"
        />

        <SummaryCard
          title="Rain probability"
          value={
            dashboard?.summary
              ?.maxRainProbability ?? "—"
          }
          unit="%"
          color="#818cf8"
        />

        <SummaryCard
          title="Nearby disasters"
          value={
            dashboard?.summary
              ?.nearbyDisasters ?? "—"
          }
          color="#fb923c"
        />

        <SummaryCard
          title="River discharge"
          value={
            dashboard?.summary
              ?.riverDischargeM3s ?? "—"
          }
          unit=" m³/s"
          color="#22d3ee"
        />
      </section>


      {/* RISK */}
      <section className="risk-panel">
        <div>
          <div className="section-label">
            LOCAL RISK INDICATOR
          </div>

          <div
            className="risk-number"
            style={{
              color: riskColor
            }}
          >
            {risk}%
          </div>

          <div
            className="risk-category"
            style={{
              color: riskColor
            }}
          >
            {RiskLabel(risk)}
          </div>

          <p>
            Combined indicator based on
            rainfall, precipitation
            probability, river discharge
            and nearby disaster alerts.
          </p>
        </div>

        <div className="risk-bar">
          <div
            className="risk-fill"
            style={{
              width: `${risk}%`,
              background:
                riskColor
            }}
          />
        </div>
      </section>


      {/* MAP */}
      <section className="map-section">
        <div className="map-header">
          <div>
            <h2>
              Live global weather &
              disaster map
            </h2>

            <span>
              Green = lower indicator ·
              Yellow = moderate ·
              Orange = high ·
              Red = severe
            </span>
          </div>

          <div className="live">
            <span />
            LIVE
          </div>
        </div>

        <div className="map">
          <MapContainer
            center={[
              latitude,
              longitude
            ]}
            zoom={3}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution="© OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapCenter
              latitude={latitude}
              longitude={longitude}
            />


            {/* GLOBAL WEATHER CELLS */}
            {globalWeather.map(
              (point, index) => {
                const intensity =
                  Math.min(
                    1,
                    (point.precipitation ||
                      0) / 20
                  );

                const score =
                  intensity * 100;

                return (
                  <Circle
                    key={
                      `weather-${index}`
                    }
                    center={[
                      point.lat,
                      point.lon
                    ]}
                    radius={70000}
                    pathOptions={{
                      stroke: false,
                      fillColor:
                        RiskColor(
                          score
                        ),
                      fillOpacity:
                        0.18
                    }}
                  >
                    <Popup>
                      <strong>
                        Weather cell
                      </strong>

                      <br />

                      Temperature:{" "}
                      {
                        point.temperature
                      }
                      °C

                      <br />

                      Rain:{" "}
                      {
                        point.rain
                      }{" "}
                      mm

                      <br />

                      Wind:{" "}
                      {
                        point.wind
                      }{" "}
                      km/h
                    </Popup>
                  </Circle>
                );
              }
            )}


            {/* LOCAL HEAT MAP */}
            {dashboard && (
              <RiskHeatLayer
                points={
                  dashboard.heatPoints
                }
              />
            )}


            {/* SELECTED LOCATION */}
            <CircleMarker
              center={[
                latitude,
                longitude
              ]}
              radius={12}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor:
                  riskColor,
                fillOpacity: 1
              }}
            >
              <Popup>
                <strong>
                  Selected location
                </strong>

                <br />

                Risk indicator:{" "}
                {risk}%
              </Popup>
            </CircleMarker>


            {/* DISASTERS */}
            {dashboard && (
              <DisasterMarkers
                events={
                  dashboard
                    .disasters
                    .nearby
                }
              />
            )}
          </MapContainer>
        </div>
      </section>


      {/* DISASTER LIST */}
      <section className="events">
        <div className="events-header">
          <h2>
            Nearby disaster alerts
          </h2>

          <span>
            Last 7 days
          </span>
        </div>

        {dashboard?.disasters
          ?.nearby?.length === 0 && (
          <div className="empty">
            No GDACS events detected
            within 500 km of the
            selected location.
          </div>
        )}

        {dashboard?.disasters?.nearby?.map(
          (event) => (
            <div
              className="event"
              key={event.id}
            >
              <div
                className="event-dot"
                style={{
                  background:
                    RiskColor(
                      event.alertLevel ===
                        "red"
                        ? 100
                        : event.alertLevel ===
                          "orange"
                        ? 60
                        : 30
                    )
                }}
              />

              <div className="event-main">
                <strong>
                  {event.name}
                </strong>

                <span>
                  {event.type}
                  {" · "}
                  {event.distanceKm}
                  km away
                </span>
              </div>

              <div className="event-alert">
                {event.alertLevel}
              </div>
            </div>
          )
        )}
      </section>


      <footer>
        Weather/flood data:
        Open-Meteo / GloFAS ·
        Disaster alerts: GDACS.
        This dashboard is an
        informational visualization,
        not an official emergency
        warning service.
      </footer>
    </div>
  );
}
