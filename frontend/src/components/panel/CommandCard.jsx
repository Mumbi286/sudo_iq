import { useState } from 'react'
import { ApiError } from '../../lib/api'
import { humanize } from '../../lib/theme'
import AddHouseholdForm from './AddHouseholdForm'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none'

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onLogin(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <p className="text-[11px] text-slate-400">Operators sign in to issue alerts.</p>
      <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className={inputClass} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-[11px] text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-sky-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

// Zone and severity options come from the API, not from the code
function IssueAlertForm({ zones, severities, selectedZoneId, onIssue }) {
  const [zoneId, setZoneId] = useState('')
  const [severity, setSeverity] = useState(severities[0] ?? 'WARNING')
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const effectiveZoneId = zoneId || (selectedZoneId ? String(selectedZoneId) : '')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setStatus(null)
    try {
      const alert = await onIssue({ zone_id: Number(effectiveZoneId), severity })
      setStatus({ ok: true, text: `Sent to ${alert.total} households in ${alert.zone_name}` })
    } catch (err) {
      setStatus({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <select className={inputClass} value={effectiveZoneId} onChange={(e) => setZoneId(e.target.value)} required>
        <option value="" disabled>Choose a zone…</option>
        {zones.features.map(({ properties: z }) => (
          <option key={z.id} value={z.id}>{z.name} ({z.households} households)</option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        {severities.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition ${
              severity === s
                ? s === 'EVACUATE' ? 'border-red-400/60 bg-red-500/25 text-red-200' : 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {humanize(s)}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy || !effectiveZoneId}
        className="w-full rounded-lg bg-red-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40"
      >
        {busy ? 'Sending…' : 'Issue alert'}
      </button>
      {status && <p className={`text-[11px] ${status.ok ? 'text-emerald-300' : 'text-red-300'}`}>{status.text}</p>}
    </form>
  )
}

// Sign in, then issue alerts and register phones; a 401 (expired token) signs the operator out
export default function CommandCard({ session, onLogin, onLogout, zones, meta, selectedZoneId, onIssue, onAddHousehold }) {
  const signOutOnExpiry = (action) => async (payload) => {
    try {
      return await action(payload)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onLogout()
      throw err
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Command</h2>
        {session && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span>{session.user.name} · {humanize(session.user.role)}</span>
            <button type="button" onClick={onLogout} className="text-sky-300 hover:text-sky-200">Sign out</button>
          </div>
        )}
      </div>
      {!session ? (
        <LoginForm onLogin={onLogin} />
      ) : ['ADMIN', 'OPERATOR'].includes(session.user.role) ? (
        <div className="space-y-3">
          <IssueAlertForm
            zones={zones}
            severities={meta?.severities ?? []}
            selectedZoneId={selectedZoneId}
            onIssue={signOutOnExpiry(onIssue)}
          />
          <AddHouseholdForm
            zones={zones}
            channels={meta?.channels ?? ['SMS']}
            selectedZoneId={selectedZoneId}
            onAdd={signOutOnExpiry(onAddHousehold)}
          />
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Responders see the live queue; only operators issue alerts.</p>
      )}
    </section>
  )
}
