// src/components/NearbyRisks/NearbyRisks.jsx
import { useEffect, useState } from "react";
import { getNearbyRisks } from "../../services/floodService";
import "./Nearbyrisks.css";

const SEVERITY_ORDER = { severe: 0, high: 1, moderate: 2, low: 3 };

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} h ago` : `${Math.round(hrs / 24)} d ago`;
}

export default function Nearbyrisks({ location }) {
  // The last finished request. State is only set when a response arrives
  // (inside the async callbacks), never synchronously in the effect body.
  const [result, setResult] = useState({
    locationKey: null,
    requestKey: null,
    places: [],
    error: "",
  });
  const [refreshCount, setRefreshCount] = useState(0);

  const locationKey = location ? `${location.lat},${location.lng}` : null;
  const requestKey = `${locationKey}#${refreshCount}`;

  useEffect(() => {
    if (!location) return;

    let cancelled = false; // ignore responses from outdated requests

    getNearbyRisks(location)
      .then((data) => {
        if (cancelled) return;
        // Most dangerous first, then nearest
        const sorted = [...data].sort(
          (a, b) =>
            (SEVERITY_ORDER[a.level] ?? 9) - (SEVERITY_ORDER[b.level] ?? 9) ||
            a.distanceKm - b.distanceKm
        );
        setResult({ locationKey, requestKey, places: sorted, error: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ locationKey, requestKey, places: [], error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [location, locationKey, requestKey]);

  // Derived values: no extra state to keep in sync
  const loading = Boolean(location) && result.requestKey !== requestKey;
  const places = result.locationKey === locationKey ? result.places : [];
  const error = result.requestKey === requestKey ? result.error : "";
  const load = () => setRefreshCount((c) => c + 1);

  const dangerous = places.filter((p) => p.level === "high" || p.level === "severe").length;

  return (
    <section className="nearby" aria-label="Flood risk nearby">
      <div className="nearby__head">
        <h2 className="nearby__title">Flood risk near you</h2>
        {location && (
          <button type="button" className="nearby__refresh" onClick={load} disabled={loading}>
            {loading ? "Updating..." : "Refresh"}
          </button>
        )}
      </div>

      {!location && (
        <p className="nearby__empty">
          Pin your location in the chat to see which places around you are at risk of flooding.
        </p>
      )}

      {location && !loading && !error && places.length > 0 && (
        <p className="nearby__summary">
          {dangerous > 0
            ? `${dangerous} ${dangerous === 1 ? "place" : "places"} within 15 km ${dangerous === 1 ? "is" : "are"} at high or severe risk.`
            : "No high-risk places within 15 km right now."}
        </p>
      )}

      {error && <p className="nearby__error" role="alert">{error}</p>}

      {location && loading && places.length === 0 && (
        <p className="nearby__empty">Loading flood risk around you...</p>
      )}

      {location && !loading && !error && places.length === 0 && (
        <p className="nearby__empty">No flood reports for places near you.</p>
      )}

      <ul className="nearby__list">
        {places.map((p) => (
          <li key={p.id || p.name} className={`nearby__item nearby__item--${p.level}`}>
            <div className="nearby__row">
              <span className="nearby__name">{p.name}</span>
              <span className={`nearby__badge nearby__badge--${p.level}`}>{p.level}</span>
            </div>
            <p className="nearby__message">{p.message}</p>
            <p className="nearby__meta">
              {p.distanceKm?.toFixed(1)} km away
              {p.updatedAt && ` | Updated ${timeAgo(p.updatedAt)}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
