function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  )
}

// Population covered by the system, derived from the API data
export default function StatGrid({ stats }) {
  return (
    <section className="grid grid-cols-2 gap-2">
      <Stat label="Zones monitored" value={stats.zones} />
      <Stat label="Households registered" value={stats.households} />
      <Stat label="People covered" value={stats.people} />
      <Stat label="Vulnerable households" value={stats.vulnerable} />
    </section>
  )
}
