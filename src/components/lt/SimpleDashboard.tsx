import { useMemo, useState } from 'react'
import { buildMediaUrl } from '../../lib/kide/api'
import type { BackendHealthResponse, EventResponse, KideVariant, ScoredEvent } from '../../lib/kide/types'
import type { LogLine, SnipeSession } from '../../lib/lt/types'

type BackendStatus = 'checking' | 'ready' | 'missing-config' | 'offline'
type SortKey = 'score' | 'soon' | 'price'
type FilterKey = 'all' | 'watch' | 'buy' | 'maybe'

type Props = {
  events: ScoredEvent[]
  activeId?: string
  activeEvent?: ScoredEvent
  detail?: EventResponse | null
  detailLoading?: boolean
  detailError?: string | null
  backendStatus: BackendStatus
  backendMessage?: string | null
  backendHealth?: BackendHealthResponse | null
  apiUrl?: string
  city: string
  tokenValid: boolean
  tokenLabel?: string
  loading: boolean
  scanError?: string | null
  lastUpdatedLabel: string
  landedCount: number
  snipe?: SnipeSession | null
  latestLog?: LogLine
  pollMs: number
  onPick: (id: string) => void
  onRescan: () => void
  onRetryBackend: () => void
  onOpenSettings: () => void
  onOpenCity: () => void
  onSubmitUrl: (url: string) => void
  onStart: (params: { variantId: string; variantName: string; quantity: number }) => void
  onStopSnipe: () => void
}

const KIDE_CART_URL = 'https://kide.app/basket'
const EMPTY_VARIANTS: KideVariant[] = []

function finalDecision(event?: ScoredEvent): 'BUY' | 'MAYBE' | 'SKIP' | undefined {
  return event?.ai_score?.label ?? event?.decision
}

function decisionLabel(value?: 'BUY' | 'MAYBE' | 'SKIP') {
  if (value === 'BUY') return 'Ota'
  if (value === 'MAYBE') return 'Seuraa'
  return 'Ohita'
}

function formatMoney(value?: number | null): string {
  if (typeof value !== 'number') return '-'
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')} €`
}

function formatDate(value?: string): string {
  if (!value) return 'Ei aikaa'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Ei aikaa'
  return date.toLocaleString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function backendLabel(status: BackendStatus, health?: BackendHealthResponse | null) {
  if (status === 'checking') return { text: 'Tarkistetaan', tone: 'warn' }
  if (status === 'ready' && health?.status === 'ok') return { text: 'Backend toimii', tone: 'ok' }
  if (status === 'ready') return { text: 'Backend toimii osittain', tone: 'warn' }
  if (status === 'missing-config') return { text: 'API puuttuu', tone: 'bad' }
  return { text: 'Backend offline', tone: 'bad' }
}

function backendHelp(p: Props) {
  if (p.backendStatus === 'missing-config') {
    return p.backendMessage ?? 'Aseta Vercelissä VITE_API_URL Railway-backendin osoitteeksi.'
  }
  if (p.backendStatus === 'offline') {
    return `Railway ei vastaa: ${p.backendMessage ?? 'yhteys epäonnistui'}`
  }
  if (p.scanError) return `Skannaus epäonnistui: ${p.scanError}`
  if (p.backendHealth?.services.database.status === 'ok') {
    return `Tietokanta ok · ${p.backendHealth.services.database.snapshotRows ?? 0} snapshotia`
  }
  return 'Valmis skannaamaan.'
}

function statusText(snipe?: SnipeSession | null) {
  if (!snipe) return 'Ei seurantaa'
  if (snipe.phase === 'waiting') return 'Odottaa myynnin alkua'
  if (snipe.phase === 'hunting') return 'Seuranta käynnissä'
  if (snipe.phase === 'landed') return 'Liput korissa'
  return snipe.message ?? 'Seuranta pysäytetty'
}

export default function SimpleDashboard(p: Props) {
  const [urlDraft, setUrlDraft] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)

  const variants = p.detail?.variants ?? EMPTY_VARIANTS
  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => variant.inventoryId === selectedVariantId)
      ?? variants.find((variant) => variant.availability > 0)
      ?? variants[0],
    [selectedVariantId, variants],
  )

  const visibleEvents = useMemo(() => {
    const filtered = p.events.filter((event) => {
      const decision = finalDecision(event)
      if (event.sales_status === 'ended' || event.sales_status === 'sold_out') return false
      if (filter === 'watch') return decision === 'BUY' || decision === 'MAYBE'
      if (filter === 'buy') return decision === 'BUY'
      if (filter === 'maybe') return decision === 'MAYBE'
      return true
    })

    return filtered.sort((a, b) => {
      if (sort === 'price') return (a.base_price_eur ?? 9999) - (b.base_price_eur ?? 9999)
      if (sort === 'soon') {
        const aTime = a.start_time ? Date.parse(a.start_time) : Number.MAX_SAFE_INTEGER
        const bTime = b.start_time ? Date.parse(b.start_time) : Number.MAX_SAFE_INTEGER
        return aTime - bTime
      }
      return b.resell_score - a.resell_score
    })
  }, [filter, p.events, sort])

  const stats = useMemo(() => {
    const buy = p.events.filter((event) => finalDecision(event) === 'BUY').length
    const maybe = p.events.filter((event) => finalDecision(event) === 'MAYBE').length
    return { buy, maybe, total: p.events.length }
  }, [p.events])

  const backend = backendLabel(p.backendStatus, p.backendHealth)
  const activeDecision = finalDecision(p.activeEvent)
  const salesUpcoming = (p.detail?.product.timeUntilSalesStart ?? 0) > 0
  const salesEnded = p.detail?.product.salesEnded ?? false
  const activeSnipe = p.snipe && p.snipe.phase !== 'landed' && p.snipe.phase !== 'error'
  const canStart = Boolean(p.tokenValid && selectedVariant && !salesEnded && !activeSnipe)
  const coverImage = buildMediaUrl(p.detail?.product.mediaFilename) ?? p.activeEvent?.media_url ?? null

  const submitUrl = () => {
    const value = urlDraft.trim()
    if (!value) return
    p.onSubmitUrl(value)
    setUrlDraft('')
  }

  return (
    <div className="simple-app">
      <header className="simple-top">
        <div className="simple-brand">
          <span className="simple-brand__mark">KH</span>
          <div>
            <h1>Kidehiiri</h1>
            <p>Nopea lippuseuranta ilman säätöä.</p>
          </div>
        </div>
        <div className="simple-top__actions">
          <span className={`simple-status simple-status--${backend.tone}`}>{backend.text}</span>
          <button className="simple-button simple-button--ghost" onClick={p.onOpenSettings}>
            {p.tokenValid ? p.tokenLabel ?? 'Token ok' : 'Aseta token'}
          </button>
        </div>
      </header>

      <main className="simple-shell">
        <section className="simple-hero">
          <div className="simple-hero__copy">
            <span className="simple-kicker">Kaupunki: {p.city || 'Kaikki'}</span>
            <h2>Valitse tapahtuma. Kidehiiri hoitaa seurannan.</h2>
            <p>{backendHelp(p)}</p>
          </div>
          <div className="simple-hero__actions">
            <button className="simple-button" onClick={p.onOpenCity}>Vaihda kaupunki</button>
            <button className="simple-button simple-button--primary" onClick={p.onRescan} disabled={p.loading || p.backendStatus !== 'ready'}>
              {p.loading ? 'Skannataan...' : 'Skannaa nyt'}
            </button>
            {p.backendStatus !== 'ready' && (
              <button className="simple-button simple-button--danger" onClick={p.onRetryBackend}>Tarkista backend</button>
            )}
          </div>
        </section>

        <section className="simple-urlbar" aria-label="Tapahtuman URL">
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submitUrl() }}
            placeholder="Liitä Kide.app-tapahtuman linkki"
          />
          <button className="simple-button simple-button--primary" onClick={submitUrl}>Avaa</button>
        </section>

        <section className="simple-summary" aria-label="Tilanne">
          <div><strong>{stats.total}</strong><span>tapahtumaa</span></div>
          <div><strong>{stats.buy}</strong><span>ota heti</span></div>
          <div><strong>{stats.maybe}</strong><span>seuraa</span></div>
          <div><strong>{p.landedCount}</strong><span>onnistumista</span></div>
        </section>

        <div className="simple-grid">
          <section className="simple-card simple-list">
            <div className="simple-card__head">
              <div>
                <h3>Tapahtumat</h3>
                <p>{p.lastUpdatedLabel}</p>
              </div>
              <div className="simple-controls">
                <select value={filter} onChange={(event) => setFilter(event.target.value as FilterKey)} aria-label="Suodata tapahtumia">
                  <option value="all">Kaikki</option>
                  <option value="watch">Ota + seuraa</option>
                  <option value="buy">Ota</option>
                  <option value="maybe">Seuraa</option>
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Lajittele tapahtumat">
                  <option value="score">Paras ensin</option>
                  <option value="soon">Aika</option>
                  <option value="price">Hinta</option>
                </select>
              </div>
            </div>

            {visibleEvents.length === 0 ? (
              <div className="simple-empty">
                <strong>{p.loading ? 'Skannataan...' : 'Ei tapahtumia'}</strong>
                <span>{p.loading ? 'Tämä kestää yleensä pari sekuntia.' : 'Kokeile toista kaupunkia tai liitä tapahtuman linkki.'}</span>
              </div>
            ) : (
              <div className="simple-events">
                {visibleEvents.map((event) => {
                  const decision = finalDecision(event)
                  const active = event.event_id === p.activeId
                  return (
                    <button
                      key={event.event_id}
                      className={`simple-event ${active ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedVariantId('')
                        setQuantity(1)
                        p.onPick(event.event_id)
                      }}
                    >
                      <span className={`simple-event__decision simple-event__decision--${decision?.toLowerCase() ?? 'skip'}`}>
                        {decisionLabel(decision)}
                      </span>
                      <span className="simple-event__body">
                        <strong>{event.name}</strong>
                        <small>{formatDate(event.start_time)} · {event.organiser ?? 'Järjestäjä puuttuu'}</small>
                      </span>
                      <span className="simple-event__meta">
                        <strong>{Math.round(event.resell_score)}</strong>
                        <small>{formatMoney(event.base_price_eur)}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          <section className="simple-card simple-detail">
            <div className="simple-card__head">
              <div>
                <h3>{p.activeEvent ? 'Valittu tapahtuma' : 'Aloita tästä'}</h3>
                <p>{statusText(p.snipe)}</p>
              </div>
              {p.snipe && p.snipe.phase !== 'landed' && p.snipe.phase !== 'error' && (
                <button className="simple-button simple-button--danger" onClick={p.onStopSnipe}>Pysäytä</button>
              )}
            </div>

            {!p.activeEvent ? (
              <div className="simple-empty simple-empty--large">
                <strong>Valitse tapahtuma listasta.</strong>
                <span>Sen jälkeen näet lipputyypit ja voit käynnistää seurannan.</span>
              </div>
            ) : (
              <>
                <div className="simple-detail__cover">
                  {coverImage && <img src={coverImage} alt="" loading="lazy" />}
                  <div>
                    <span className={`simple-event__decision simple-event__decision--${activeDecision?.toLowerCase() ?? 'skip'}`}>
                      {decisionLabel(activeDecision)}
                    </span>
                    <h2>{p.activeEvent.name}</h2>
                    <p>{p.activeEvent.reason}</p>
                  </div>
                </div>

                <div className="simple-facts">
                  <div><span>Aika</span><strong>{formatDate(p.activeEvent.start_time)}</strong></div>
                  <div><span>Hinta</span><strong>{formatMoney(p.activeEvent.base_price_eur)}</strong></div>
                  <div><span>Saatavuus</span><strong>{typeof p.activeEvent.availability_pct === 'number' ? `${Math.round(p.activeEvent.availability_pct)} %` : '-'}</strong></div>
                  <div><span>Pollaus</span><strong>{p.pollMs} ms</strong></div>
                </div>

                {p.detailLoading && <div className="simple-empty"><strong>Ladataan lipputyyppejä...</strong></div>}
                {p.detailError && <div className="simple-alert">{p.detailError}</div>}

                {variants.length > 0 && (
                  <div className="simple-variants">
                    <h4>Lipputyyppi</h4>
                    {variants.map((variant: KideVariant) => {
                      const soldOut = variant.availability <= 0 && !salesUpcoming
                      const active = selectedVariant?.inventoryId === variant.inventoryId
                      const price = typeof variant.price === 'number'
                        ? variant.price / 100
                        : typeof variant.pricePerItem === 'number'
                          ? variant.pricePerItem / 100
                          : undefined
                      return (
                        <button
                          key={variant.inventoryId}
                          className={`simple-variant ${active ? 'is-active' : ''}`}
                          disabled={soldOut}
                          onClick={() => setSelectedVariantId(variant.inventoryId)}
                        >
                          <span>
                            <strong>{variant.name}</strong>
                            <small>{soldOut ? 'Loppuunmyyty' : salesUpcoming ? 'Odottaa myynnin alkua' : `${variant.availability} jäljellä`}</small>
                          </span>
                          <strong>{formatMoney(price)}</strong>
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="simple-start">
                  <div className="simple-quantity">
                    <button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
                    <span>{quantity} kpl</span>
                    <button onClick={() => setQuantity((value) => Math.min(10, value + 1))}>+</button>
                  </div>
                  {p.snipe?.phase === 'landed' ? (
                    <a className="simple-button simple-button--primary" href={KIDE_CART_URL} target="_blank" rel="noreferrer">Avaa kori</a>
                  ) : (
                    <button
                      className="simple-button simple-button--primary"
                      disabled={!canStart}
                      onClick={() => {
                        if (!selectedVariant) return
                        p.onStart({ variantId: selectedVariant.inventoryId, variantName: selectedVariant.name, quantity })
                      }}
                    >
                      {!p.tokenValid ? 'Token puuttuu' : activeSnipe ? 'Seuranta käynnissä' : salesUpcoming ? 'Aloita ennakkoseuranta' : 'Aloita seuranta'}
                    </button>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {p.latestLog && (
          <section className={`simple-log simple-log--${p.latestLog.level}`}>
            <span>{p.latestLog.ts}</span>
            <strong>{p.latestLog.text}</strong>
          </section>
        )}
      </main>
    </div>
  )
}
