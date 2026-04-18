import { C, F, evGlyph, fmtElapsed } from '../../lib/lt/tokens'
import { Dot, Glyph, Kbd, Lbl, Pill } from '../../lib/lt/primitives'
import type { SnipeSession } from '../../lib/lt/types'
import type { ScoredEvent } from '../../lib/kide/types'

type Props = {
  snipes: SnipeSession[]
  watchlist: ScoredEvent[]
  activeId?: string
  onPick: (id: string) => void
  onNewSnipe: () => void
  collapsed: boolean
  onToggle: () => void
  userEmail?: string
}

const phaseMeta = {
  hunting: { color: C.magenta, label: 'KÄYNNISSÄ', pulse: true },
  waiting: { color: C.maybe, label: 'ODOTTAA', pulse: false },
  landed:  { color: C.accent, label: 'ONNISTUI', pulse: false },
  error:   { color: C.skip, label: 'VIRHE', pulse: false },
} as const

export default function LeftPanel(p: Props) {
  if (p.collapsed) {
    return (
      <aside className="lt-left lt-left--collapsed">
        <button className="lt-iconbtn" onClick={p.onToggle} aria-label="Laajenna paneeli">›</button>
        <div className="lt-thinrule" />
        {p.snipes.map((s) => (
          <button
            key={s.id}
            className="lt-glyphbtn"
            onClick={() => p.onPick(s.eventId)}
            title={s.eventName}
          >
            <Glyph text={evGlyph(s.eventName)} size={32} />
          </button>
        ))}
      </aside>
    )
  }

  return (
    <aside className="lt-left">
      <div className="lt-left__head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 20, color: C.ink, letterSpacing: '-0.02em' }}>
            Seurannat
          </div>
          <Lbl>{p.snipes.length} aktiivista seurantaa</Lbl>
        </div>
        <button className="lt-iconbtn" onClick={p.onToggle} aria-label="Tiivistä paneeli">‹</button>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        <button className="lt-newhunt" onClick={p.onNewSnipe}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>+</span> Uusi seuranta
          </span>
          <Kbd>N</Kbd>
        </button>
      </div>

      <div className="lt-left__scroll">
        {p.snipes.length === 0 && (
          <div style={{ padding: '18px 14px', color: C.inkMuted, fontFamily: F.mono, fontSize: 11, lineHeight: 1.6 }}>
            Ei aktiivisia seurantoja. Liitä Kide.app-URL tai valitse tapahtuma tutkasta.
          </div>
        )}
        {p.snipes.map((s) => {
          const meta = phaseMeta[s.phase]
          const active = p.activeId === s.eventId
          const elapsed = Math.max(0, Math.floor((Date.now() - s.startedAt) / 1000))
          const countdown = s.salesStartAt ? Math.max(0, Math.floor((s.salesStartAt - Date.now()) / 1000)) : 0
          return (
            <button
              key={s.id}
              onClick={() => p.onPick(s.eventId)}
              className={`lt-snipecard ${active ? 'is-active' : ''}`}
            >
              <Glyph text={evGlyph(s.eventName)} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Dot color={meta.color} size={5} pulse={meta.pulse} />
                  <Lbl style={{ color: meta.color }}>{meta.label}</Lbl>
                </div>
                <div className="lt-snipecard__title">{s.eventName}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                  {s.phase === 'waiting' && countdown > 0
                    ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, '0')} myynnin alkuun`
                    : s.phase === 'landed'
                    ? `✓ ${s.quantity} kpl lisätty koriin`
                    : s.phase === 'error'
                    ? s.message ?? 'Virhe'
                    : `${s.attempts} yritystä · ${fmtElapsed(elapsed)}`}
                </div>
              </div>
            </button>
          )
        })}

        {p.watchlist.length > 0 && (
          <>
            <div style={{ padding: '16px 14px 6px' }}>
              <Lbl>Seurantalista</Lbl>
            </div>
            {p.watchlist.slice(0, 5).map((ev) => (
              <button
                key={ev.event_id}
                onClick={() => p.onPick(ev.event_id)}
                className="lt-watchrow"
              >
                <Glyph text={evGlyph(ev.name)} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="lt-watchrow__title">{ev.name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 1 }}>
                    {ev.city ?? '—'}
                  </div>
                </div>
                <Pill color={ev.decision === 'BUY' ? C.buy : ev.decision === 'MAYBE' ? C.maybe : C.skip}>
                  {Math.round(ev.resell_score)}
                </Pill>
              </button>
            ))}
          </>
        )}
      </div>

      <div className="lt-left__foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div className="lt-avatar">
            {(p.userEmail ?? 'KH').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, color: C.ink, fontSize: 12, fontFamily: F.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.userEmail ?? 'Token puuttuu'}
          </div>
          <Kbd>⌘,</Kbd>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, lineHeight: 1.5 }}>
          <span style={{ color: C.accentDim }}>§</span> Vahvistat maksun aina itse Kide.appissa.
        </div>
      </div>
    </aside>
  )
}
