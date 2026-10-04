import { useState } from 'react'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none'

// Operator registers a real phone number (e.g. a judge's) in a zone, on SMS or WhatsApp
export default function AddHouseholdForm({ zones, channels, selectedZoneId, onAdd }) {
  const [phone, setPhone] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [channel, setChannel] = useState(channels[0] ?? 'SMS')
  const [members, setMembers] = useState(1)
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const effectiveZoneId = zoneId || (selectedZoneId ? String(selectedZoneId) : '')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      await onAdd({ phone, zone_id: Number(effectiveZoneId), channel, members: Number(members) })
      setStatus({ ok: true, text: `${phone} registered. It will receive the next alert for this zone.` })
      setPhone('')
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] text-slate-400">Register a phone (e.g. a judge&apos;s real number)</p>
      <input className={inputClass} type="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <select className={inputClass} value={effectiveZoneId} onChange={(e) => setZoneId(e.target.value)} required>
          <option value="" disabled>Zone…</option>
          {zones.features.map(({ properties: z }) => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <select className={inputClass} value={channel} onChange={(e) => setChannel(e.target.value)}>
          {channels.map((c) => (
            <option key={c} value={c}>{c === 'WHATSAPP' ? 'WhatsApp' : c}</option>
          ))}
        </select>
        <input
          className={`${inputClass} w-16`}
          type="number"
          min={1}
          max={50}
          value={members}
          onChange={(e) => setMembers(e.target.value)}
          aria-label="Household size"
          title="Household size"
        />
      </div>
      <button
        type="submit"
        disabled={busy || !effectiveZoneId}
        className="w-full rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40"
      >
        {busy ? 'Registering…' : 'Register phone'}
      </button>
      {status && <p className={`text-[11px] ${status.ok ? 'text-emerald-300' : 'text-red-300'}`}>{status.text}</p>}
    </form>
  )
}
