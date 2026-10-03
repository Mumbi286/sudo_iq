import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://localhost:4000";

function RiskColor(score) {
  if (score >= 75) return "#dc2626";
  if (score >= 50) return "#f97316";
  if (score >= 25) return "#facc15";
  return "#22c55e";
}

function RiskLabel(score) {
  if (score >= 75) return "SEVERE";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "OK";
}

function MapCenter({ latitude, longitude }) {
  const map = useMap();

  useEffect(() => {
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.setView([latitude, longitude], 11);
    }
  }, [latitude, longitude, map]);

  return null;
}

function RiskHeatLayer({ points }) {
  return (
    <>
      {points.map((point, index) => {
        const [lat, lon, intensity] = point;
        const score = Math.round(intensity * 100);

        return (
          <Circle
            key={`heat-${index}`}
            center={[lat, lon]}
            radius={18000}
            pathOptions={{ stroke: false, fillColor: RiskColor(score), fillOpacity: 0.18 }}
          />
        );
      })}
    </>
  );
}

function DisasterMarkers({ events }) {
  return (
    <>
      {events.map((event) => (
        <CircleMarker
          key={event.id}
          center={[event.latitude, event.longitude]}
          radius={9}
          pathOptions={{
            color: event.alertLevel === "red" ? "#dc2626" : event.alertLevel === "orange" ? "#f97316" : "#eab308",
            fillOpacity: 0.9
          }}
        >
          <Popup>
            <strong>{event.name}</strong>
            <br />
            Type: {event.type}
            <br />
            Alert: {event.alertLevel}
            <br />
            Distance: {event.distanceKm} km
            {event.country && (
              <>
                <br />
                Country: {event.country}
              </>
            )}
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
}

function SummaryCard({ title, value, unit, color }) {
  return (
    <div className="summary-card">
      <div className="summary-title">{title}</div>
      <div className="summary-value" style={{ color }}>
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

function ReportMarker({ report }) {
  const statusColor =
    report.status === "verified" ? "#22c55e" : report.status === "unverified" ? "#fbbf24" : "#ef4444";

  return (
    <CircleMarker center={[report.lat, report.lon]} radius={9} pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.9 }}>
      <Popup>
        <strong>{report.source || "Report"}</strong>
        <br />
        Status: {report.status}
        <br />
        Confidence: {report.ai?.score ?? 0}%
        <br />
        {report.text || "Flood report from resident"}
      </Popup>
    </CircleMarker>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState(null);
  const [globalWeather, setGlobalWeather] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [latitude, setLatitude] = useState(-1.2610);
  const [longitude, setLongitude] = useState(36.8560);
  const [newReport, setNewReport] = useState({ text: "Road flooded near Mathare, water reaching cars", reporterId: "demo-user", source: "social_media", platform: "WhatsApp", consent: true, photoUrl: "", lat: -1.2610, lon: 36.8560 });

  async function loadDashboard(lat = latitude, lon = longitude) {
    setLoading(true);
    setError("");

    try {
      const [dashboardRes, reportsRes] = await Promise.all([
        fetch(`${API}/api/dashboard?lat=${lat}&lon=${lon}`),
        fetch(`${API}/api/reports`)
      ]);

      if (!dashboardRes.ok) throw new Error("API request failed");

      const dashboardData = await dashboardRes.json();
      const reportsData = reportsRes.ok ? await reportsRes.json() : { reports: [] };

      setDashboard(dashboardData);
      setReports(reportsData.reports || []);
      setLatitude(lat);
      setLongitude(lon);
    } catch (err) {
      console.error(err);
      setError("Could not retrieve live disaster/weather data.");
    } finally {
      setLoading(false);
    }
  }

  function useGPS() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        loadDashboard(position.coords.latitude, position.coords.longitude);
      },
      () => setError("Location permission was denied."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    let tick = 0;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API}/api/reports`);
        if (response.ok) {
          const data = await response.json();
          setReports(data.reports || []);
        }

        tick += 1;
        if (tick % 6 === 0) {
          await loadDashboard(latitude, longitude);
        }
      } catch (error) {
        console.error("Failed to refresh flood reports:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [latitude, longitude]);

  useEffect(() => {
    async function loadGlobalWeather() {
      try {
        const response = await fetch(`${API}/api/global-weather`);
        if (!response.ok) return;
        const data = await response.json();
        setGlobalWeather(data.points || []);
      } catch (error) {
        console.error(error);
      }
    }

    loadGlobalWeather();
    const interval = setInterval(loadGlobalWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const risk = dashboard?.risk?.score ?? 0;
  const riskColor = RiskColor(risk);
  const liveReports = useMemo(() => reports.slice(0, 8), [reports]);

  async function submitReport(event) {
    event.preventDefault();

    try {
      const payload = {
        ...newReport,
        lat: Number(newReport.lat),
        lon: Number(newReport.lon),
        reporterId: newReport.reporterId || "anonymous",
        source: newReport.source,
        platform: newReport.platform,
        consent: newReport.consent,
        text: newReport.text,
        photoUrl: newReport.photoUrl || ""
      };

      const response = await fetch(`${API}/api/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Failed to submit report");
      }

      const data = await response.json();
      setNewReport({ ...newReport, text: "" });
      await loadDashboard(latitude, longitude);
      setError(data.message || "Report submitted.");
    } catch (err) {
      console.error(err);
      setError("Could not submit flood report.");
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <h1>FloodAlert Kenya</h1>
          <p>Hyperlocal flood alerts powered by resident reports, AI verification, and weather signals.</p>
        </div>
        <div className="header-actions">
          <button onClick={useGPS} className="gps-button">📍 Use my location</button>
          <button onClick={() => loadDashboard()}>Refresh</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <section className="location-panel">
        <div>
          <label>Latitude</label>
          <input type="number" step="0.0001" value={latitude} onChange={(event) => setLatitude(Number(event.target.value))} />
        </div>
        <div>
          <label>Longitude</label>
          <input type="number" step="0.0001" value={longitude} onChange={(event) => setLongitude(Number(event.target.value))} />
        </div>
        <button onClick={() => loadDashboard(latitude, longitude)}>Query location</button>
      </section>

      <section className="stats">
        <SummaryCard title="24h rainfall" value={dashboard?.summary?.rain24hMm ?? "—"} unit=" mm" color="#38bdf8" />
        <SummaryCard title="Peak hourly rain" value={dashboard?.summary?.maxHourlyRainMm ?? "—"} unit=" mm" color="#60a5fa" />
        <SummaryCard title="Rain probability" value={dashboard?.summary?.maxRainProbability ?? "—"} unit="%" color="#818cf8" />
        <SummaryCard title="Nearby reports (1h)" value={dashboard?.summary?.nearbyReports ?? "—"} color="#fb923c" />
        <SummaryCard title="River discharge" value={dashboard?.summary?.riverDischargeM3s ?? "—"} unit=" m³/s" color="#22d3ee" />
      </section>

      <section className="risk-panel">
        <div>
          <div className="section-label">LOCAL RISK INDICATOR</div>
          <div className="risk-number" style={{ color: riskColor }}>{risk}%</div>
          <div className="risk-category" style={{ color: riskColor }}>{RiskLabel(risk)}</div>
          <p>Combined indicator using rainfall, precipitation probability, river discharge, nearby disaster alerts, and resident flood reports.</p>
        </div>
        <div className="risk-bar">
          <div className="risk-fill" style={{ width: `${risk}%`, background: riskColor }} />
        </div>
      </section>

      <section className="report-box">
        <h2>Resident flood report</h2>
        <form onSubmit={submitReport} className="report-form">
          <textarea
            rows="3"
            value={newReport.text}
            onChange={(event) => setNewReport({ ...newReport, text: event.target.value })}
            placeholder="Describe the flooding: location, depth, blocked road, etc."
          />
          <div className="report-grid">
            <input value={newReport.reporterId} onChange={(event) => setNewReport({ ...newReport, reporterId: event.target.value })} placeholder="Reporter ID" />
            <input value={newReport.platform} onChange={(event) => setNewReport({ ...newReport, platform: event.target.value })} placeholder="Platform (WhatsApp, X, SMS)" />
            <input type="number" step="0.0001" value={newReport.lat} onChange={(event) => setNewReport({ ...newReport, lat: event.target.value })} placeholder="Latitude" />
            <input type="number" step="0.0001" value={newReport.lon} onChange={(event) => setNewReport({ ...newReport, lon: event.target.value })} placeholder="Longitude" />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={newReport.consent} onChange={(event) => setNewReport({ ...newReport, consent: event.target.checked })} />
            I consent to location and report data being used for this demo and minimised storage only.
          </label>
          <button type="submit" className="primary-button">Submit report</button>
        </form>
      </section>

      <section className="map-section">
        <div className="map-header">
          <div>
            <h2>Resident-verified flood map</h2>
            <span>Green = verified low risk · Yellow = unverified · Red = severe alert</span>
          </div>
          <div className="live"><span /> LIVE</div>
        </div>

        <div className="map">
          <MapContainer center={[latitude, longitude]} zoom={11} scrollWheelZoom={true}>
            <TileLayer attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapCenter latitude={latitude} longitude={longitude} />

            {globalWeather.map((point, index) => {
              const intensity = Math.min(1, (point.precipitation || 0) / 20);
              const score = intensity * 100;

              return (
                <Circle
                  key={`weather-${index}`}
                  center={[point.lat, point.lon]}
                  radius={70000}
                  pathOptions={{ stroke: false, fillColor: RiskColor(score), fillOpacity: 0.18 }}
                >
                  <Popup>
                    <strong>Weather cell</strong>
                    <br />
                    Temperature: {point.temperature}°C
                    <br />
                    Rain: {point.rain} mm
                    <br />
                    Wind: {point.wind} km/h
                  </Popup>
                </Circle>
              );
            })}

            {dashboard && <RiskHeatLayer points={dashboard.heatPoints} />}

            <CircleMarker center={[latitude, longitude]} radius={12} pathOptions={{ color: "#ffffff", weight: 3, fillColor: riskColor, fillOpacity: 1 }}>
              <Popup>
                <strong>Selected location</strong>
                <br />
                Risk indicator: {risk}%
              </Popup>
            </CircleMarker>

            {dashboard && <DisasterMarkers events={dashboard.disasters.nearby} />}
            {liveReports.map((report) => (
              <ReportMarker key={report.id} report={report} />
            ))}
          </MapContainer>
        </div>
      </section>

      <section className="events">
        <div className="events-header">
          <h2>Resident reports</h2>
          <span>AI verification + weather match</span>
        </div>

        {liveReports.length === 0 ? (
          <div className="empty">No resident flood reports yet.</div>
        ) : (
          liveReports.map((report) => (
            <div className="event" key={report.id}>
              <div className="event-dot" style={{ background: report.status === "verified" ? "#22c55e" : report.status === "unverified" ? "#fbbf24" : "#ef4444" }} />
              <div className="event-main">
                <strong>{report.source || "Resident report"}</strong>
                <span>
                  {report.platform || "Unknown platform"} · {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
                </span>
                <small>{report.text}</small>
                <small className="score-inline">Confidence {report.ai?.score ?? 0}% · {report.ai?.scoreLabel || "unverified"}</small>
              </div>
              <div className="event-alert">{report.status}</div>
            </div>
          ))
        )}
      </section>

      <footer>
        Flood alerts: demo for Nairobi / Kenya flood response. This app uses resident-originated data, minimal storage, and AI-assisted validation to support rapid local verification.
      </footer>
    </div>
  );
}
