import { humanize } from './theme'

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

// Turn API events (and the alert itself) into activity-feed items, newest first
export function buildFeed(activeAlert, events) {
  const items = events.map((e) => ({
    id: `event-${e.id}`,
    time: time(e.created_at),
    title: e.household_name ?? `Household #${e.household_id}`,
    detail: `${e.from_state ? `${humanize(e.from_state)} → ` : ''}${humanize(e.to_state)} · ${e.zone_name}${e.note ? ` · ${e.note}` : ''}`,
    state: e.to_state,
  }))
  if (activeAlert) {
    items.push({
      id: `alert-${activeAlert.id}`,
      time: time(activeAlert.created_at),
      title: `${humanize(activeAlert.severity)} alert · ${activeAlert.zone_name}`,
      detail: `Sent to ${activeAlert.total} households`,
      state: activeAlert.severity === 'EVACUATE' ? 'NEEDS_HELP' : 'SENT',
    })
  }
  return items
}
