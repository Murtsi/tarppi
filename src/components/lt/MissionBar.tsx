import { C, F, fmtElapsed } from '../../lib/lt/tokens'
import { Dot } from '../../lib/lt/primitives'
import { useEffect, useState } from 'react'
import type { SnipeSession, LogLine } from '../../lib/lt/types'

type Props = {
  snipe: SnipeSession
  pollMs: number
  latestLog?: LogLine
  onStop: () => void
}

export default function MissionBar({ snipe, pollMs, latestLog, onStop }: Props) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = Math.max(0, Math.floor((Date.now() - snipe.startedAt) / 1000))
  const phaseColor =
    snipe.phase === 'landed' ? C.accent :
    snipe.phase === 'waiting' ? C.maybe :
    snipe.phase === 'error' ? C.skip : C.magenta
  const phaseLabel =
    snipe.phase === 'landed' ? 'ONNISTUI' :
    snipe.phase === 'waiting' ? 'ODOTTAA' :
    snipe.phase === 'error' ? 'VIRHE' : 'KÄYNNISSÄ'

  return (
    <div className="lt-missionbar">
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Dot color={phaseColor} pulse={snipe.phase === 'hunting'} />
        <span style={{ color: phaseColor, letterSpacing: '0.08em', fontFamily: F.mono, fontSize: 11 }}>
          {phaseLabel}
        </span>
      </div>
      <div className="lt-missionbar__sep" />
      <div style={{ color: C.ink, fontFamily: F.mono, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
        {snipe.eventName} · {snipe.variantName ?? 'lippu'} · {snipe.quantity}×
      </div>
      <div className="lt-missionbar__sep" />
      <div style={{ color: C.inkSoft, fontFamily: F.mono, fontSize: 11 }}>
        pollaus <span style={{ color: C.ink }}>{pollMs} ms</span>
      </div>
      <div style={{ color: C.inkSoft, fontFamily: F.mono, fontSize: 11 }}>
        yrityksiä <span style={{ color: C.ink }}>{snipe.attempts}</span>
      </div>
      <div style={{ color: C.inkSoft, fontFamily: F.mono, fontSize: 11 }}>
        aikaa <span style={{ color: C.ink }}>{fmtElapsed(elapsed)}</span>
      </div>
      {snipe.lastCheckedAt && (
        <>
          <div className="lt-missionbar__sep" />
          <div style={{ color: C.inkSoft, fontFamily: F.mono, fontSize: 11 }}>
            tark. <span style={{ color: C.ink }}>{Math.round((Date.now() - snipe.lastCheckedAt) / 100) / 10} s</span> sitten
          </div>
          <div style={{ color: C.inkSoft, fontFamily: F.mono, fontSize: 11 }}>
            seur. <span style={{ color: C.ink }}>
              {Math.max(0, Math.round((pollMs - (Date.now() - snipe.lastCheckedAt)) / 100) / 10)} s
            </span>
          </div>
        </>
      )}
      <span style={{ flex: 1 }} />
      {latestLog && (
        <div className="lt-missionbar__log">
          <span style={{ color: C.accent }}>›</span> {latestLog.text}
        </div>
      )}
      <button className="lt-stopbtn" onClick={onStop}>PYSÄYTÄ</button>
    </div>
  )
}
