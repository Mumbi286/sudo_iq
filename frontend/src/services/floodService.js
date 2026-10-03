// src/services/floodService.js
// Talks to the MajiMvua backend. Set VITE_API_BASE_URL in your .env file.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

/**
 * Check flood risk for a trip from `origin` to `destination`.
 * Expected response: { level, message, advice }
 */
export async function getFloodRisk(origin, destination) {
  const res = await fetch(`${API_BASE_URL}/flood-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination }),
  });

  if (!res.ok) {
    throw new Error("The flood risk service is not responding. Try again shortly.");
  }

  return res.json();
}

/**
 * Send the user's pinned location so the system can send them alerts.
 */
export async function registerLocation(location) {
  const res = await fetch(`${API_BASE_URL}/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(location),
  });

  if (!res.ok) throw new Error("Could not save your location.");
  return res.json();
}

/**
 * Get flood risk for places around a location.
 * Expected response: [{ id, name, level, distanceKm, message, updatedAt }]
 */
export async function getNearbyRisks(location, radiusKm = 15) {
  const params = new URLSearchParams({
    lat: String(location.lat),
    lng: String(location.lng),
    radius: String(radiusKm),
  });

  const res = await fetch(`${API_BASE_URL}/flood-risk/nearby?${params}`);
  if (!res.ok) {
    throw new Error("Could not load nearby flood risks. Try again shortly.");
  }

  return res.json();
}