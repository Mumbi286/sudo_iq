import { useCallback, useMemo, useState } from 'react'
import BasemapSwitcher from './components/map/BasemapSwitcher'
import MapLegend from './components/map/MapLegend'
import MapView from './components/map/MapView'
import GlassPanel from './components/panel/GlassPanel'
import { useAuth } from './hooks/useAuth'
import { useDashboardData } from './hooks/useDashboardData'
import { API_URL, api } from './lib/api'
import { DEFAULT_BASEMAP_ID } from './lib/basemaps'
import { buildFeed } from './lib/feed'
import { summarize } from './lib/stats'

function FullScreenMessage({ title, children }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950 p-6 text-slate-200">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="mt-2 text-sm text-slate-400">{children}</div>
      </div>
    </div>
  )
}

export default function App() {
  const { data, error, updatedAt, refresh } = useDashboardData()
  const { session, login, logout } = useAuth()
  const [selectedZoneId, setSelectedZoneId] = useState(null)
  const [basemapId, setBasemapId] = useState(DEFAULT_BASEMAP_ID)

  const stats = useMemo(() => (data ? summarize(data.zones, data.households) : null), [data])
  const activity = useMemo(() => (data ? buildFeed(data.activeAlert, data.events) : []), [data])

  // Issue an alert, then refresh at once so the map turns yellow without waiting for the next poll
  const issueAlert = useCallback(
    async (payload) => {
      const alert = await api.issueAlert(session.token, payload)
      refresh()
      return alert
    },
    [session, refresh],
  )

  const addHousehold = useCallback(
    async (payload) => {
      const household = await api.addHousehold(session.token, payload)
      refresh()
      return household
    },
    [session, refresh],
  )

  if (!data) {
    return error ? (
      <FullScreenMessage title="Can't reach the Mlinzi API">
        <p>
          Tried <code className="text-slate-200">{API_URL}</code>: {error.message}.
        </p>
        <p className="mt-2">
          Is the backend running? <code className="text-slate-200">python -m uvicorn app.main:app --reload</code>
        </p>
      </FullScreenMessage>
    ) : (
      <FullScreenMessage title="Loading operations map…" />
    )
  }

  return (
    <main className="relative h-full w-full overflow-hidden">
      <MapView
        zones={data.zones}
        households={data.households}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        basemapId={basemapId}
      />
      <BasemapSwitcher value={basemapId} onChange={setBasemapId} />
      <MapLegend zones={data.zones} meta={data.meta} />
      <GlassPanel
        meta={data.meta}
        zones={data.zones}
        stats={stats}
        activeAlert={data.activeAlert}
        activity={activity}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        updatedAt={updatedAt}
        error={error}
        session={session}
        onLogin={login}
        onLogout={logout}
        onIssue={issueAlert}
        onAddHousehold={addHousehold}
      />
    </main>
  )
}
