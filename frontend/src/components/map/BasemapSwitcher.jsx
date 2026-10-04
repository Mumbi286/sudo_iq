import { BASEMAPS } from '../../lib/basemaps'

// Glass pill to switch the map background (dark for the ops room, satellite to see rivers and terrain)
export default function BasemapSwitcher({ value, onChange }) {
  return (
    <div className="absolute top-3 left-14 z-[1000] flex gap-1 rounded-full border border-white/10 bg-slate-900/50 p-1 text-[11px] shadow-xl backdrop-blur-xl">
      {BASEMAPS.map((basemap) => (
        <button
          key={basemap.id}
          type="button"
          onClick={() => onChange(basemap.id)}
          className={`rounded-full px-3 py-1 font-medium transition ${
            value === basemap.id ? 'bg-white/20 text-white' : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          {basemap.name}
        </button>
      ))}
    </div>
  )
}
