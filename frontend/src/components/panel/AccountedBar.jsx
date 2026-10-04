import { humanize, stateColor } from '../../lib/theme'

const formatKes = (value) => `KES ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

// The headline metric for the active alert: share of targeted households whose status is known,
// plus what the alert has cost so far (the business case, live)
export default function AccountedBar({ alert }) {
  const percent = alert ? Math.round(alert.accounted_percent) : 0
  const breakdown = alert ? Object.entries(alert.by_state).filter(([, count]) => count > 0) : []

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Accounted for</p>
        <p className="text-2xl font-semibold tabular-nums">{alert ? `${percent}%` : '—'}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>

      {!alert ? (
        <p className="mt-2 text-[11px] text-slate-400">No active alert. All households are on standby.</p>
      ) : (
        <>
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-medium text-slate-200">{humanize(alert.severity)}</span> · {alert.zone_name} ·{' '}
            {alert.accounted} of {alert.total} households known
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {breakdown.map(([state, count]) => (
              <li key={state} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] capitalize text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stateColor(state) }} />
                {humanize(state)} {count}
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-white/10 pt-2 text-[11px] text-slate-400">
            {Object.entries(alert.messages_by_channel)
              .filter(([, count]) => count > 0)
              .map(([channel, count]) => `${count} ${channel === 'WHATSAPP' ? 'WhatsApp' : channel}`)
              .join(' + ') || '0 messages'}{' '}
            · {formatKes(alert.message_cost_kes)}
            {alert.cost_per_accounted_kes !== null && ` · ${formatKes(alert.cost_per_accounted_kes)} per household accounted`}
          </p>
        </>
      )}
    </section>
  )
}
