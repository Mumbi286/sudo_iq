export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Fetch JSON from the backend; throws ApiError with the server's detail message on failure
async function request(path, { method = 'GET', token, json, form } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form !== undefined) {
    body = new URLSearchParams(form)
  }

  const res = await fetch(`${API_URL}${path}`, { method, headers, body })
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const data = await res.json()
      if (data.detail) detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
    } catch {
      // response had no JSON body
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

const query = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
  return entries.length ? `?${new URLSearchParams(entries)}` : ''
}

export const api = {
  meta: () => request('/meta'),
  zones: () => request('/zones'),
  households: ({ zoneId, alertId } = {}) => request(`/households${query({ zone_id: zoneId, alert_id: alertId })}`),
  alerts: (limit = 5) => request(`/alerts${query({ limit })}`),
  events: ({ alertId, limit = 30 } = {}) => request(`/events${query({ alert_id: alertId, limit })}`),
  login: (email, password) => request('/auth/login', { method: 'POST', form: { username: email, password } }),
  issueAlert: (token, payload) => request('/alerts', { method: 'POST', token, json: payload }),
  addHousehold: (token, payload) => request('/households', { method: 'POST', token, json: payload }),
}
