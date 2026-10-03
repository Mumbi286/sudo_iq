// src/services/locationService.js
// Handles the user's GPS position and converts place names <-> coordinates
// using OpenStreetMap's free Nominatim API (no API key needed).

const NOMINATIM_URL = "https://nominatim.openstreetmap.org";

/**
 * Ask the browser for the user's current position.
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Your browser does not support location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        const messages = {
          1: "Location permission was denied. Allow location access in your browser settings and try again.",
          2: "Your location could not be determined. Check your GPS or network and try again.",
          3: "Finding your location took too long. Try again.",
        };
        reject(new Error(messages[err.code] || "Could not get your location."));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  });
}

/**
 * Convert a place name (e.g. "Mathare, Nairobi") into coordinates.
 * Results are limited to Kenya.
 * @returns {Promise<{lat: number, lng: number, name: string}>}
 */
export async function geocodeAddress(query) {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "ke",
  });

  const res = await fetch(`${NOMINATIM_URL}/search?${params}`);
  if (!res.ok) throw new Error("Place search failed. Try again in a moment.");

  const results = await res.json();
  if (!results.length) {
    throw new Error(`No place found for "${query}". Try adding a town or county.`);
  }

  const top = results[0];
  return {
    lat: parseFloat(top.lat),
    lng: parseFloat(top.lon),
    name: top.display_name,
  };
}

/**
 * Convert coordinates into a readable place name.
 * Falls back to the raw coordinates if the lookup fails.
 * @returns {Promise<string>}
 */
export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "json",
    });
    const res = await fetch(`${NOMINATIM_URL}/reverse?${params}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}