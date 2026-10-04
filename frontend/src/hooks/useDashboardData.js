import { api } from '../lib/api'
import { usePolling } from './usePolling'

const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 3000

// Everything the operations screen needs. The newest alert is the "active" one:
// households carry their state for it and the feed shows its events.
async function loadDashboard() {
  const [meta, zones, alerts] = await Promise.all([api.meta(), api.zones(), api.alerts(5)])
  const activeAlert = alerts[0] ?? null
  const alertId = activeAlert?.id
  const [households, events] = await Promise.all([
    api.households({ alertId }),
    alertId ? api.events({ alertId }) : Promise.resolve([]),
  ])
  return { meta, zones, alerts, activeAlert, households, events }
}

export function useDashboardData() {
  return usePolling(loadDashboard, POLL_MS)
}
