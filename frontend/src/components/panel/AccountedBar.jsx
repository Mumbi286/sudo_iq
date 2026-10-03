// The headline metric: share of at-risk households whose status is known
export default function AccountedBar({ accounted, total }) {
  const active = accounted !== null && total > 0
  const percent = active ? Math.round((accounted / total) * 100) : 0

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accounted for</p>
        <p className="text-2xl font-semibold tabular-nums">{active ? `${percent}%` : '—'}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {active ? `${accounted} of ${total} households have a known status` : 'No active alert. All households are on standby.'}
      </p>
    </section>
  )
}
