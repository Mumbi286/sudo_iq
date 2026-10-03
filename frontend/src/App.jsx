import { useMemo, useState } from 'react'
import MapLegend from './components/map/MapLegend'
import MapView from './components/map/MapView'
import GlassPanel from './components/panel/GlassPanel'
import { useDashboardData } from './hooks/useDashboardData'
import { API_URL } from './lib/api'
import { summarize } from './lib/stats'

// Activity items arrive with the alerts API in Phase 2
const NO_ACTIVITY = []

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
  const { data, error, updatedAt } = useDashboardData()
  const [selectedZoneId, setSelectedZoneId] = useState(null)

  const stats = useMemo(() => (data ? summarize(data.zones, data.households) : null), [data])

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
      />
      <MapLegend zones={data.zones} meta={data.meta} />
      <GlassPanel
        meta={data.meta}
        zones={data.zones}
        stats={stats}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        updatedAt={updatedAt}
        error={error}
        activity={NO_ACTIVITY}
      />
    </main>
  )
}
