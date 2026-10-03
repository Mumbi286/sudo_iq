import AccountedBar from './AccountedBar'
import ActivityFeed from './ActivityFeed'
import PanelHeader from './PanelHeader'
import StatGrid from './StatGrid'
import ZoneList from './ZoneList'

// Frosted panel over the map: right side on desktop, bottom sheet on phones
export default function GlassPanel({ meta, zones, stats, selectedZoneId, onSelectZone, updatedAt, error, activity }) {
  return (
    <aside className="absolute inset-x-3 bottom-3 z-[1000] flex max-h-[50vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 text-slate-100 shadow-2xl backdrop-blur-xl md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-[400px]">
      <PanelHeader meta={meta} updatedAt={updatedAt} error={error} />

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        <AccountedBar accounted={null} total={stats.households} />
        <StatGrid stats={stats} />
        <ZoneList zones={zones} stats={stats} selectedZoneId={selectedZoneId} onSelectZone={onSelectZone} />
        <ActivityFeed items={activity} />
      </div>
    </aside>
  )
}
