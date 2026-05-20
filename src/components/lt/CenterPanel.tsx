import { useMemo, useState } from 'react'
import { C, F, evGlyph } from '../../lib/lt/tokens'
import { Dot, Glyph, Kbd, Pill } from '../../lib/lt/primitives'
import type { ScoredEvent } from '../../lib/kide/types'
import type { SnipeSession, LogLine } from '../../lib/lt/types'
import MissionBar from './MissionBar'

type Tab = 'all' | 'buy' | 'maybe' | 'skip' | 'top10'
type SortKey = 'score' | 'name' | 'price'

type Props = {
  events: ScoredEvent[]
  activeId?: string
  onPick: (id: string) => void
  activeSnipe?: SnipeSession
  missionSnipe?: SnipeSession
  pollMs: number
  latestLog?: LogLine
  onStopSnipe: () => void
  city: string
  onCityClick: () => void
  avgLatencyMs?: number
  landedCount: number
  lastUpdatedLabel: string
  loading?: boolean
  scanError?: string | null
  onOpenPalette: () => void
  onRescan: () => void
}

function finalDecision(event: ScoredEvent): 'BUY' | 'MAYBE' | 'SKIP' {
  return event.ai_score?.label ?? event.decision
}

function decisionColor(decision: 'BUY' | 'MAYBE' | 'SKIP'): string {
  if (decision === 'BUY') return C.buy
  if (decision === 'MAYBE') return C.maybe
  return C.skip
}

function isVisibleEvent(event: ScoredEvent): boolean {
  const now = Date.now()
  const startTime = event.start_time ? Date.parse(event.start_time) : Number.NaN

  if (event.sales_status === 'ended' || event.sales_status === 'sold_out') return false
  if ((event.availability_pct ?? 100) <= 0 && event.sales_status !== 'upcoming') return false
  if (!Number.isNaN(startTime) && startTime < now - 24 * 60 * 60 * 1000) return false
  if ((event.availability_pct ?? 100) <= 5 && finalDecision(event) === 'SKIP' && event.sales_status !== 'upcoming') return false
  return true
}

export default function CenterPanel(p: Props) {
  const [tab, setTab] = useState<Tab>('all')
  const [sort, setSort] = useState<SortKey>('score')
  const [histOpen, setHistOpen] = useState(false)

  const visibleEvents = useMemo(() => p.events.filter(isVisibleEvent), [p.events])

  const filtered = useMemo(() => {
    if (tab === 'top10') {
      return [...visibleEvents].sort((a, b) => b.resell_score - a.resell_score).slice(0, 10)
    }

    const byTab = tab === 'all'
      ? visibleEvents
      : visibleEvents.filter((e) => finalDecision(e).toLowerCase() === tab)

    return [...byTab].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fi')
      if (sort === 'price') return (a.base_price_eur ?? 0) - (b.base_price_eur ?? 0)
      return b.resell_score - a.resell_score
    })
  }, [visibleEvents, tab, sort])

  const histogram = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({ min: i * 10, buy: 0, maybe: 0, skip: 0, total: 0 }))
    for (const ev of visibleEvents) {
      const idx = Math.min(9, Math.floor(ev.resell_score / 10))
      const key = finalDecision(ev).toLowerCase() as 'buy' | 'maybe' | 'skip'
      buckets[idx][key]++
      buckets[idx].total++
    }
    return buckets
  }, [visibleEvents])

  const histMax = useMemo(() => Math.max(1, ...histogram.map((b) => b.total)), [histogram])

  const counts = useMemo(() => ({
    all: visibleEvents.length,
    buy: visibleEvents.filter((e) => finalDecision(e) === 'BUY').length,
    maybe: visibleEvents.filter((e) => finalDecision(e) === 'MAYBE').length,
    skip: visibleEvents.filter((e) => finalDecision(e) === 'SKIP').length,
  }), [visibleEvents])

  return (
    <div className="lt-center">
      <div className="lt-topbar">
        <button className="lt-cmdfield" onClick={p.onOpenPalette}>
          <span style={{ color: C.inkMuted, fontSize: 13 }}>⌕</span>
          <span style={{ fontFamily: F.sans, fontSize: 13, color: C.inkSoft }}>
            Etsi tapahtumia, liitä URL tai kirjoita komento...
          </span>
          <span style={{ flex: 1 }} />
          <Kbd>Ctrl+K</Kbd>
        </button>
        <span style={{ flex: 1 }} />
        <div className="lt-livemeta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Dot size={5} pulse color={p.loading ? C.maybe : C.accent} />
            <span style={{ color: p.loading ? C.maybe : C.accent, letterSpacing: '0.08em' }}>
              {p.loading ? 'SKANNAUS' : 'LIVE'}
            </span>
          </span>
          {typeof p.avgLatencyMs === 'number' && <span>⌛ {p.avgLatencyMs} ms</span>}
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
            {p.city || '—'} · {visibleEvents.length} tapahtumaa · {p.lastUpdatedLabel}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="lt-rescanbtn"
            onClick={p.onRescan}
            disabled={p.loading}
            title="Skannaa uudelleen"
          >
            <span style={{ display: 'inline-block', transition: 'transform 0.4s ease', transform: p.loading ? 'rotate(360deg)' : 'none' }}>⟳</span>
          </button>
          <button className="lt-citypill" onClick={p.onCityClick}>
            {p.city || 'Valitse kaupunki'}
            <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 6 }}>▾</span>
          </button>
        </div>
      </div>

      <div className="lt-tabrow">
        {([
          { k: 'all', l: 'Kaikki', n: counts.all },
          { k: 'buy', l: 'Osta', n: counts.buy, c: C.buy },
          { k: 'maybe', l: 'Ehkä', n: counts.maybe, c: C.maybe },
          { k: 'skip', l: 'Ohita', n: counts.skip, c: C.skip },
          { k: 'top10', l: 'Top 10', n: Math.min(10, counts.all) },
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

      {visibleEvents.length > 0 && (
        <div className="lt-histogram" onClick={() => setHistOpen((o) => !o)} title={histOpen ? 'Piilota jakauma' : 'Näytä pistejakauma'}>
          {histogram.map((b, i) => {
            const domColor = b.buy >= b.maybe && b.buy >= b.skip ? C.buy
              : b.maybe > b.buy && b.maybe >= b.skip ? C.maybe
                : C.skip
            return (
              <div key={i} className="lt-histogram__col">
                {histOpen && (
                  <div style={{ fontFamily: F.mono, fontSize: 8, color: C.inkMuted, textAlign: 'center', marginBottom: 2 }}>
                    {b.total || ''}
                  </div>
                )}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    className="lt-histogram__bar"
                    style={{
                      height: `${(b.total / histMax) * 100}%`,
                      background: b.total === 0 ? 'var(--lt-rule)' : domColor,
                      opacity: b.total === 0 ? 0.3 : 0.75,
                    }}
                  />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 8, color: C.inkMuted, textAlign: 'center', marginTop: 2 }}>
                  {b.min}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
            {p.loading
              ? 'Skannataan...'
              : p.scanError
                ? `Skannaus epäonnistui: ${p.scanError}. Tarkista backend-yhteys tai yritä uudelleen.`
                : 'Ei tapahtumia. Valitse kaupunki yläreunasta.'}
          </div>
        )}

        {filtered.map((ev) => {
          const active = p.activeId === ev.event_id
          const final = finalDecision(ev)
          const col = decisionColor(final)
          const availPct = Math.max(0, Math.min(100, ev.availability_pct ?? 0))
          const buyP = ev.ai_score?.buy_probability ?? (final === 'BUY' ? 0.7 : final === 'MAYBE' ? 0.3 : 0.1)
          const maybeP = ev.ai_score?.maybe_probability ?? (final === 'MAYBE' ? 0.5 : 0.2)
          const skipP = ev.ai_score?.skip_probability ?? Math.max(0, 1 - buyP - maybeP)

          return (
            <div
              key={ev.event_id}
              className={`lt-row ${active ? 'is-active' : ''}`}
              onClick={() => p.onPick(ev.event_id)}
            >
              <Glyph text={evGlyph(ev.name)} size={32} />
              <div style={{ minWidth: 0 }}>
                <div className="lt-row__title">{ev.name}</div>
                <div className="lt-row__sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{ev.start_time ? new Date(ev.start_time).toLocaleString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                  {ev.ai_score && (
                    <span
                      title={`AI · ${ev.ai_score.model_version}`}
                      style={{
                        fontFamily: F.mono,
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        padding: '1px 5px',
                        borderRadius: 3,
                        border: '1px solid currentColor',
                        color: col,
                        opacity: 0.8,
                      }}
                    >
                      AI
                    </span>
                  )}
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
                      width: `${availPct}%`,
                      background: availPct <= 5 ? C.skip : availPct < 30 ? C.maybe : C.accentDim,
                    }}
                  />
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 3 }}>
                  {typeof ev.availability_pct === 'number' ? `${Math.round(availPct)}%` : '—'}
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

      {(p.missionSnipe ?? p.activeSnipe) && (
        <MissionBar
          snipe={(p.missionSnipe ?? p.activeSnipe)!}
          pollMs={p.pollMs}
          latestLog={p.latestLog}
          onStop={p.onStopSnipe}
        />
      )}
    </div>
  )
}
