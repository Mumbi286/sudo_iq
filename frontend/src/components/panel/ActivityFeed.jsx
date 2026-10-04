import { stateColor } from '../../lib/theme'

// Live log of alerts and household replies, newest first.
// Item shape: { id, time, title, detail, state }, built from /events in lib/feed.js.
export default function ActivityFeed({ items }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
        Live activity
      </h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[11px] text-slate-500">
          No alerts yet. Issued alerts and household replies will stream here.
        </p>
      ) : (
        <ol className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stateColor(item.state) }} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <time className="shrink-0 text-[10px] tabular-nums text-slate-500">{item.time}</time>
                </div>
                {item.detail && <p className="truncate text-[11px] text-slate-400">{item.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
