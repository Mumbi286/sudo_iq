export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

// Fetch JSON from the backend; throws on network errors and non-2xx responses
async function request(path) {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} on ${path}`)
  }
  return res.json()
}

export const api = {
  meta: () => request('/meta'),
  zones: () => request('/zones'),
  households: (zoneId) => request(zoneId ? `/households?zone_id=${zoneId}` : '/households'),
}
