import { HOUSEHOLD_COLORS, humanize, riskStyle, stateColor } from '../../lib/theme'

function Swatch({ color, label, round = false }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 ${round ? 'rounded-full' : 'rounded-sm'}`}
        style={{ backgroundColor: color }}
      />
      <span className="capitalize">{label}</span>
    </li>
  )
}

// Legend built from the risk levels in the data and the states the API reports
export default function MapLegend({ zones, meta }) {
  const riskLevels = [...new Set(zones.features.map((f) => f.properties.risk_level))].sort()

  return (
    <div className="pointer-events-auto absolute bottom-8 left-3 z-[1000] hidden w-48 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-[11px] text-slate-300 shadow-xl backdrop-blur-xl md:block">
      <p className="mb-1.5 font-semibold uppercase tracking-wider text-slate-400">Zones</p>
      <ul className="space-y-1">
        {riskLevels.map((level) => (
          <Swatch key={level} color={riskStyle(level).color} label={riskStyle(level).label} />
        ))}
      </ul>
      <p className="mb-1.5 mt-3 font-semibold uppercase tracking-wider text-slate-400">Households</p>
      <ul className="space-y-1">
        <Swatch round color={HOUSEHOLD_COLORS.registered} label="registered" />
        <Swatch round color={HOUSEHOLD_COLORS.vulnerable} label="has vulnerable members" />
      </ul>
      {meta && (
        <>
          <p className="mb-1.5 mt-3 font-semibold uppercase tracking-wider text-slate-400">During an alert</p>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
            {meta.checkin_states.map((state) => (
              <Swatch key={state} round color={stateColor(state)} label={humanize(state)} />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
