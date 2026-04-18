import { useState, useMemo } from 'react'
import { C, F, evGlyph } from '../../lib/lt/tokens'
import { Dot, Glyph, Kbd, Pill } from '../../lib/lt/primitives'
import type { ScoredEvent } from '../../lib/kide/types'
import type { SnipeSession, LogLine } from '../../lib/lt/types'
import MissionBar from './MissionBar'

type Tab = 'all' | 'buy' | 'maybe' | 'skip'
type SortKey = 'score' | 'name' | 'price'

type Props = {
  events: ScoredEvent[]
  activeId?: string
  onPick: (id: string) => void
  activeSnipe?: SnipeSession
  pollMs: number
  latestLog?: LogLine
  onStopSnipe: () => void
  city: string
  onCityClick: () => void
  avgLatencyMs?: number
  landedCount: number
  lastUpdatedLabel: string
  loading?: boolean
  onOpenPalette: () => void
}

export default function CenterPanel(p: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<SortKey>('score')

  const filtered = useMemo(() => {
    const byTab = tab === 'all' ? p.events : p.events.filter((e) => e.decision.toLowerCase() === tab)
    return [...byTab].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'price') return (a.base_price_eur ?? 0) - (b.base_price_eur ?? 0)
      return b.resell_score - a.resell_score
    })
  }, [p.events, tab, sort])

  const counts = useMemo(() => ({
    all: p.events.length,
    buy: p.events.filter((e) => e.decision === 'BUY').length,
    maybe: p.events.filter((e) => e.decision === 'MAYBE').length,
    skip: p.events.filter((e) => e.decision === 'SKIP').length,
  }), [p.events])

  return (
    <div className="lt-center">
      <div className="lt-topbar">
        <button className="lt-cmdfield" onClick={p.onOpenPalette}>
          <span style={{ color: C.inkMuted, fontSize: 13 }}>⌕</span>
          <span style={{ fontFamily: F.sans, fontSize: 13, color: C.inkSoft }}>
            Etsi tapahtumia, liitä URL tai kirjoita komento…
          </span>
          <span style={{ flex: 1 }} />
          <Kbd>⌘K</Kbd>
        </button>
        <span style={{ flex: 1 }} />
        <div className="lt-livemeta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Dot size={5} pulse color={p.loading ? C.maybe : C.accent} />
            <span style={{ color: p.loading ? C.maybe : C.accent, letterSpacing: '0.08em' }}>
              {p.loading ? 'SKANNAUS' : 'LIVE'}
            </span>
          </span>
          {typeof p.avgLatencyMs === 'number' && <span>⌀ {p.avgLatencyMs} ms</span>}
          <span>{p.landedCount} onnistumista</span>
          <Pill>FI</Pill>
        </div>
      </div>

      <div className="lt-wordmark">
        <div>
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 44, color: C.ink, letterSpacing: '-0.03em', lineHeight: 0.95 }}>
            Lipputerminaali
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.inkSoft, marginTop: 6 }}>
            {p.city || '—'} · {p.events.length} tapahtumaa · {p.lastUpdatedLabel}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button className="lt-citypill" onClick={p.onCityClick}>
          {p.city || 'Valitse kaupunki'}
          <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>▾</span>
        </button>
      </div>

      <div className="lt-tabrow">
        {([
          { k: 'all',   l: 'Kaikki',  n: counts.all },
          { k: 'buy',   l: 'Osta',    n: counts.buy, c: C.buy },
          { k: 'maybe', l: 'Ehkä',    n: counts.maybe, c: C.maybe },
          { k: 'skip',  l: 'Ohita',   n: counts.skip, c: C.skip },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`lt-tab ${tab === t.k ? 'is-active' : ''}`}
          >
            {'c' in t && t.c && <Dot color={t.c} size={5} />}
            {t.l}
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted }}>{t.n}</span>
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          className="lt-sortbtn"
          onClick={() => setSort((s) => (s === 'score' ? 'name' : s === 'name' ? 'price' : 'score'))}
        >
          Lajittelu: <span style={{ color: C.ink }}>
            {sort === 'score' ? 'pisteet ↓' : sort === 'name' ? 'nimi ↑' : 'hinta ↑'}
          </span>
        </button>
      </div>

      <div className="lt-tablewrap">
        <div className="lt-row lt-row--head">
          <span />
          <span>Tapahtuma</span>
          <span>Järjestäjä</span>
          <span style={{ textAlign: 'right' }}>€</span>
          <span>Saatavuus</span>
          <span style={{ textAlign: 'right' }}>Pisteet</span>
          <span>Todennäköisyys</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: '32px 20px', color: C.inkMuted, fontFamily: F.mono, fontSize: 11, textAlign: 'center' }}>
            {p.loading ? 'Skannataan…' : 'Ei tapahtumia. Valitse kaupunki yläreunasta.'}
          </div>
        )}

        {filtered.map((ev) => {
          const active = p.activeId === ev.event_id
          const col = ev.decision === 'BUY' ? C.buy : ev.decision === 'MAYBE' ? C.maybe : C.skip
          const availPct = (ev.availability_pct ?? 0) / 100
          const buyP = ev.ai_score?.buy_probability ?? (ev.decision === 'BUY' ? 0.7 : ev.decision === 'MAYBE' ? 0.3 : 0.1)
          const maybeP = ev.ai_score?.maybe_probability ?? (ev.decision === 'MAYBE' ? 0.5 : 0.2)
          const skipP = ev.ai_score?.skip_probability ?? (1 - buyP - maybeP)

          return (
            <div
              key={ev.event_id}
              className={`lt-row ${active ? 'is-active' : ''}`}
              onClick={() => p.onPick(ev.event_id)}
            >
              <Glyph text={evGlyph(ev.name)} size={32} />
              <div style={{ minWidth: 0 }}>
                <div className="lt-row__title">{ev.name}</div>
                <div className="lt-row__sub">
                  {ev.start_time ? new Date(ev.start_time).toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
              <div className="lt-row__org">{ev.organiser ?? '—'}</div>
              <div className="lt-row__price">
                {ev.base_price_eur ?? '—'}
                {ev.max_price_eur && ev.max_price_eur !== ev.base_price_eur && (
                  <span style={{ color: C.inkMuted }}>–{ev.max_price_eur}</span>
                )}
              </div>
              <div>
                <div className="lt-bar">
                  <div
                    className="lt-bar__fill"
                    style={{
                      width: `${availPct * 100}%`,
                      background: availPct < 0.05 ? C.skip : availPct < 0.3 ? C.maybe : C.accentDim,
                    }}
                  />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 3 }}>
                  {typeof ev.availability_pct === 'number' ? `${Math.round(ev.availability_pct)}%` : '—'}
                </div>
              </div>
              <div style={{
                fontFamily: F.display,
                fontSize: 24,
                fontStyle: 'italic',
                color: col,
                textAlign: 'right',
                letterSpacing: '-0.02em',
              }}>
                {Math.round(ev.resell_score)}
              </div>
              <div>
                <div className="lt-probbar">
                  <div style={{ width: `${buyP * 100}%`, background: C.buy }} />
                  <div style={{ width: `${maybeP * 100}%`, background: C.maybe }} />
                  <div style={{ width: `${skipP * 100}%`, background: C.skip }} />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.buy }}>{Math.round(buyP * 100)}</span>
                  <span style={{ color: C.maybe }}>{Math.round(maybeP * 100)}</span>
                  <span style={{ color: C.skip }}>{Math.round(skipP * 100)}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {p.activeSnipe && (
        <MissionBar
          snipe={p.activeSnipe}
          pollMs={p.pollMs}
          latestLog={p.latestLog}
          onStop={p.onStopSnipe}
        />
      )}
    </div>
  )
}
