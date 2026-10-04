import { QRCodeSVG } from 'qrcode.react'

// "Try it on your phone": judges scan, join the WhatsApp sandbox, register in a zone, and receive the next alert live.
// Everything shown comes from /meta and /zones, so a new sandbox code or zone needs no code change.
export default function TryItCard({ meta, zones }) {
  if (!meta?.whatsapp?.enabled) return null

  const { number, join_code: joinCode } = meta.whatsapp
  const waNumber = number.replace(/\D/g, '')
  const joinLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(`join ${joinCode}`)}`
  const exampleZone = [...zones.features].sort((a, b) => b.properties.risk_level - a.properties.risk_level)[0]?.properties.name

  return (
    <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Try it on your phone</h2>
      <div className="flex gap-4">
        <a href={joinLink} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg bg-white p-2" aria-label="Open WhatsApp to join">
          <QRCodeSVG value={joinLink} size={96} />
        </a>
        <ol className="list-decimal space-y-1.5 pl-4 text-[11px] text-slate-300">
          <li>
            Scan and send <code className="text-emerald-200">join {joinCode}</code> on WhatsApp to {number}
          </li>
          <li>
            Then send <code className="text-emerald-200">JIUNGE {exampleZone ?? '<area>'}</code>
          </li>
          <li>Wait for the alert. Reply <b>1</b> if safe or <b>2</b> if you need help, and watch your dot on the map</li>
        </ol>
      </div>
    </section>
  )
}
