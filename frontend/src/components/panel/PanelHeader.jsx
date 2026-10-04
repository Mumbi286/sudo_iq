// App title plus live status: API reachable, demo mode, last refresh
export default function PanelHeader({ meta, updatedAt, error }) {
  const online = !error

  return (
    <header className="border-b border-white/10 px-5 pt-5 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{meta?.app_name ?? 'Mlinzi'}</h1>
          <p className="text-xs text-slate-400">Flood alert &amp; household accountability</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {meta?.simulation && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Simulation
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              online
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                : 'border-red-400/30 bg-red-400/10 text-red-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${online ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`} />
            {online ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {error
          ? `Reconnecting… (${error.message})`
          : updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString()}`
            : 'Connecting…'}
        {meta && ` · SMS: ${meta.sms_provider}`}
      </p>
    </header>
  )
}
