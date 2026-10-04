// Presentation only: which colour each backend value is drawn in.
// The values themselves (risk levels, states) come from the API.

export const FALLBACK_COLOR = '#94a3b8'

export const RISK_STYLES = {
  1: { label: 'Low risk', color: '#38bdf8' },
  2: { label: 'Medium risk', color: '#f59e0b' },
  3: { label: 'High risk', color: '#ef4444' },
}

export const STATE_COLORS = {
  SENT: '#facc15',
  RESENT: '#fb923c',
  CALLING: '#f97316',
  UNREACHABLE: '#64748b',
  NEEDS_HELP: '#ef4444',
  ASSIGNED: '#a855f7',
  SAFE: '#22c55e',
  RESCUED: '#10b981',
  CLOSED: '#94a3b8',
}

// Households before any alert: registered, and vulnerable ones highlighted
export const HOUSEHOLD_COLORS = {
  registered: '#e2e8f0',
  vulnerable: '#f472b6',
}

// Ring around households reached on WhatsApp (e.g. judges who joined live)
export const WHATSAPP_RING = '#25d366'

export const riskStyle = (level) => RISK_STYLES[level] ?? { label: `Risk ${level}`, color: FALLBACK_COLOR }
export const stateColor = (state) => STATE_COLORS[state] ?? FALLBACK_COLOR
export const humanize = (value) => value.toLowerCase().replace(/_/g, ' ')
