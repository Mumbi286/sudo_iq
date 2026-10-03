import { riskStyle } from '../../lib/theme'

// Zones from the API, highest risk first; click to fly the map there
export default function ZoneList({ zones, stats, selectedZoneId, onSelectZone }) {
  const sorted = [...zones.features].sort((a, b) => b.properties.risk_level - a.properties.risk_level)

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Zones</h2>
        {selectedZoneId && (
          <button
            type="button"
            onClick={() => onSelectZone(null)}
            className="text-[11px] text-sky-300 hover:text-sky-200"
          >
            Show all
          </button>
        )}
      </div>
      <ul className="space-y-1.5">
        {sorted.map(({ properties: zone }) => {
          const risk = riskStyle(zone.risk_level)
          const zoneStats = stats.byZone[zone.id]
          const selected = zone.id === selectedZoneId
          return (
            <li key={zone.id}>
              <button
                type="button"
                onClick={() => onSelectZone(selected ? null : zone.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selected ? 'border-white/30 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{zone.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: `${risk.color}26`, color: risk.color }}
                  >
                    {risk.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {zone.households} households
                  {zoneStats && ` · ${zoneStats.people} people · ${zoneStats.vulnerable} vulnerable`}
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
