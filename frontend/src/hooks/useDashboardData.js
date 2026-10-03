import { api } from '../lib/api'
import { usePolling } from './usePolling'

const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 10000

// Everything the operations screen needs, fetched together
async function loadDashboard() {
  const [meta, zones, households] = await Promise.all([api.meta(), api.zones(), api.households()])
  return { meta, zones, households }
}

export function useDashboardData() {
  return usePolling(loadDashboard, POLL_MS)
}
