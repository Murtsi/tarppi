import { useEffect, useMemo, useState } from 'react'
import { buildMediaUrl } from '../../lib/kide/api'
import type { BackendHealthResponse, EventResponse, KideVariant, ScoredEvent } from '../../lib/kide/types'
import type { LogLine, SnipeSession } from '../../lib/lt/types'
import { KIDE_CHECKOUT_URL } from '../../lib/checkout'
import { TELEGRAM_BOT_URL } from '../../lib/kide-token'
import { snipeMatchesEvent } from '../../lib/snipe-session'
import { TarppiMark } from '../Logo'

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
  tokenExpiresAt?: number
  loading: boolean
  scanError?: string | null
  lastUpdatedLabel: string
  landedCount: number
  snipe?: SnipeSession | null
  latestLog?: LogLine
  logs: LogLine[]
  pollMs: number
  telegramChatId: string
  onPick: (id: string) => void
  onRescan: () => void
  onRetryBackend: () => void
  onOpenSettings: () => void
  onOpenCity: () => void
  onTelegramChatIdChange: (chatId: string) => void
  onSubmitUrl: (url: string) => void
  onStart: (params: { variantId?: string; variantName?: string; quantity: number; variantIds?: string[]; ticketNameQuery?: string }) => void
  onStopSnipe: () => void
}

const EMPTY_VARIANTS: KideVariant[] = []

function finalDecision(event?: ScoredEvent): 'BUY' | 'MAYBE' | 'SKIP' | undefined {
  return event?.ai_score?.label ?? event?.decision
}

function decisionLabel(value?: 'BUY' | 'MAYBE' | 'SKIP') {
  if (value === 'BUY') return 'Osta'
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
  if (status === 'ready' && health?.status === 'ok') return { text: 'Valmis', tone: 'ok' }
  if (status === 'ready') return { text: 'Osittain valmis', tone: 'warn' }
  if (status === 'missing-config') return { text: 'API puuttuu', tone: 'bad' }
  return { text: 'Yhteys poikki', tone: 'bad' }
}

function backendHelp(p: Props) {
  if (p.backendStatus === 'missing-config') {
    return p.backendMessage ?? 'Lisää backendin osoite ennen käyttöä.'
  }
  if (p.backendStatus === 'offline') {
    return `Backend ei vastaa: ${p.backendMessage ?? 'yhteys epäonnistui'}`
  }
  if (p.scanError) return `Tapahtumien haku ei mennyt läpi: ${p.scanError}`
  if (p.backendHealth?.services.database.status === 'ok') {
    const currentEvents = p.events.length
    const trackedEvents = p.backendHealth.services.database.trackedEvents ?? 0
    const eventCount = currentEvents > 0 ? currentEvents : trackedEvents
    if (eventCount > 0) {
      return `Tietokanta kunnossa. ${eventCount.toLocaleString('fi-FI')} tapahtumaa listalla.`
    }
    return 'Tietokanta kunnossa. Odotetaan tapahtumia.'
  }
  return 'Valitse tapahtuma tai liitä suora linkki.'
}

function statusText(snipe?: SnipeSession | null) {
  if (!snipe) return 'Ei aktiivista seurantaa'
  if (snipe.phase === 'waiting') return 'Odottaa myynnin alkua'
  if (snipe.phase === 'hunting') return 'Seuraa nyt'
  if (snipe.phase === 'landed') return 'Liput korissa'
  return snipe.message ?? 'Seuranta pysäytetty'
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function SimpleDashboard(p: Props) {
  const [urlDraft, setUrlDraft] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [ticketNameQuery, setTicketNameQuery] = useState('')
  const [logOpen, setLogOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const snipeForActive = snipeMatchesEvent(p.snipe, p.activeId) ? p.snipe : null

  useEffect(() => {
    if (snipeForActive?.phase !== 'landed' || !snipeForActive.paymentExpiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [snipeForActive?.paymentExpiresAt, snipeForActive?.phase])

  const variants = p.detail?.variants ?? EMPTY_VARIANTS
  const salesUpcoming = (p.detail?.product.timeUntilSalesStart ?? 0) > 0
  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => variant.inventoryId === selectedVariantId)
      ?? variants.find((variant) => variant.availability > 0)
      ?? variants[0],
    [selectedVariantId, variants],
  )
  const presaleTargets = useMemo(() => {
    if (!salesUpcoming) return selectedVariant ? [selectedVariant] : []
    if (selectedVariant) return [selectedVariant]
    return variants
  }, [salesUpcoming, selectedVariant, variants])

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
  const salesEnded = p.detail?.product.salesEnded ?? false
  const activeSnipe = snipeForActive && snipeForActive.phase !== 'landed' && snipeForActive.phase !== 'error'
  const canStart = Boolean(p.tokenValid && !salesEnded && !activeSnipe && (selectedVariant || salesUpcoming || variants.length === 0))
  const targetSummary = presaleTargets.length > 1
    ? `${presaleTargets.length} lipputyyppiä`
    : presaleTargets[0]?.name ?? (ticketNameQuery.trim() ? `lähin osuma: ${ticketNameQuery.trim()}` : 'kaikki löytyvät lipputyypit')
  const coverImage = buildMediaUrl(p.detail?.product.mediaFilename) ?? p.activeEvent?.media_url ?? null
  const paymentMsLeft = snipeForActive?.phase === 'landed' && snipeForActive.paymentExpiresAt
    ? snipeForActive.paymentExpiresAt - now
    : null

  // Token expiring before the sale opens is the most common self-inflicted
  // failure: the bot fires at open with a dead token and can't reach the cart.
  const saleStartMs = p.detail?.product.dateSalesFrom
    ? new Date(p.detail.product.dateSalesFrom).getTime()
    : (p.detail?.product.timeUntilSalesStart ?? 0) > 0
      ? now + (p.detail?.product.timeUntilSalesStart ?? 0) * 1000
      : null
  const tokenExpiresBeforeSale = Boolean(
    p.tokenValid && p.tokenExpiresAt && saleStartMs && p.tokenExpiresAt <= saleStartMs,
  )
  const saleStartLabel = saleStartMs
    ? new Date(saleStartMs).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
    : null

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
          <span className="simple-brand__mark"><TarppiMark size={38} /></span>
          <div>
            <h1>Tärppi</h1>
            <p>Valitse tapahtuma. Botti lisää liput puolestasi.</p>
          </div>
        </div>
        <div className="simple-top__actions">
          <section className="simple-telegram" aria-label="Telegram-botti">
            <div className="simple-telegram__copy">
              <strong>Telegram-botti</strong>
              <span>
                Avaa{' '}
                <a className="simple-telegram__bot" href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
                  @Tarppibot
                </a>
                , kirjoita <code>/start</code> ja liitä Chat ID.
              </span>
            </div>
            <input
              aria-label="Telegram Chat ID"
              value={p.telegramChatId}
              onChange={(event) => p.onTelegramChatIdChange(event.target.value)}
              placeholder="Chat ID"
            />
          </section>
          <span className={`simple-status simple-status--${backend.tone}`}>{backend.text}</span>
          <button className="simple-button simple-button--ghost" onClick={p.onOpenSettings}>
            {p.tokenValid ? p.tokenLabel ?? 'Token kunnossa' : 'Lisää token'}
          </button>
        </div>
      </header>

      <main className="simple-shell">
        <section className="simple-hero">
          <div className="simple-hero__copy">
            <span className="simple-kicker">Kaupunki: {p.city || 'Kaikki'}</span>
            <h2>Valitse tapahtuma ja laita Tärppi vahtiin.</h2>
            <p>{backendHelp(p)}</p>
          </div>
          <div className="simple-hero__actions">
            <button className="simple-button" onClick={p.onOpenCity}>Vaihda kaupunki</button>
            <button className="simple-button simple-button--primary" onClick={p.onRescan} disabled={p.loading || p.backendStatus !== 'ready'}>
              {p.loading ? 'Haetaan...' : 'Hae tapahtumat'}
            </button>
            {p.backendStatus !== 'ready' && (
              <button className="simple-button simple-button--danger" onClick={p.onRetryBackend}>Tarkista yhteys</button>
            )}
          </div>
        </section>

        <section className="simple-urlbar" aria-label="Tapahtuman URL">
          <input
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') submitUrl() }}
            placeholder="Liitä tapahtuman linkki tähän"
          />
          <button className="simple-button simple-button--primary" onClick={submitUrl}>Avaa tapahtuma</button>
        </section>

        <section className="simple-summary" aria-label="Tilanne">
          <div><strong>{stats.total}</strong><span>Tapahtumaa</span></div>
          <div><strong>{stats.buy}</strong><span>Ostokehotus</span></div>
          <div><strong>{stats.maybe}</strong><span>Seurattava</span></div>
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
                  <option value="watch">Kiinnostavat</option>
                  <option value="buy">Osta</option>
                  <option value="maybe">Seuraa</option>
                </select>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="Lajittele tapahtumat">
                  <option value="score">Paras ensin</option>
                  <option value="soon">Pian</option>
                  <option value="price">Hinta</option>
                </select>
              </div>
            </div>

            {visibleEvents.length === 0 ? (
              <div className="simple-empty">
                <strong>{p.loading ? 'Haetaan tapahtumia...' : 'Täällä on nyt tyhjää'}</strong>
                <span>{p.loading ? 'Tämä kestää yleensä vain hetken.' : 'Kokeile toista kaupunkia tai avaa tapahtuma suoran linkin kautta.'}</span>
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
                        setTicketNameQuery('')
                        setQuantity(1)
                        p.onPick(event.event_id)
                      }}
                    >
                      <span className={`simple-event__decision simple-event__decision--${decision?.toLowerCase() ?? 'skip'}`}>
                        {decisionLabel(decision)}
                      </span>
                      <span className="simple-event__body">
                        <strong>{event.name}</strong>
                        <small>{formatDate(event.start_time)} · {event.organiser ?? 'Järjestäjä ei tiedossa'}</small>
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
                <h3>{p.activeEvent ? 'Tapahtuma' : 'Aloita tästä'}</h3>
                <p>{statusText(snipeForActive)}</p>
              </div>
              {snipeForActive && snipeForActive.phase !== 'landed' && snipeForActive.phase !== 'error' && (
                <button className="simple-button simple-button--danger" onClick={p.onStopSnipe}>Pysäytä</button>
              )}
            </div>

            {!p.activeEvent ? (
              <div className="simple-empty simple-empty--large">
                <strong>Valitse tapahtuma listasta.</strong>
                <span>Sitten näet lipputyypit ja voit laittaa Tärpin vahtiin.</span>
              </div>
            ) : (
              <>
                {tokenExpiresBeforeSale && (
                  <div className="simple-tokenwarn" role="alert">
                    <div>
                      <strong>Token vanhenee ennen myynnin alkua</strong>
                      <span>
                        Kirjautumistoken vanhenee ennen{saleStartLabel ? ` klo ${saleStartLabel}` : ' myyntiä'}.
                        {' '}Hae uusi Kide.app-token, muuten botti ei pääse koriin.
                      </span>
                    </div>
                    <button className="simple-button simple-button--danger" onClick={p.onOpenSettings}>
                      Päivitä token
                    </button>
                  </div>
                )}
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
                {!p.detailLoading && !p.detailError && p.detail && variants.length === 0 && (
                  <div className="simple-empty">
                    <strong>Tälle tapahtumalle ei löytynyt varattavia lipputyyppejä.</strong>
                    <span>{salesUpcoming ? 'Voit silti laittaa botin odottamaan. Kun myynti aukeaa, botti hakee lipputyypit uudelleen ja yrittää sopivaa lippua.' : 'Kide näyttää tapahtuman, mutta rajapinta ei anna lipputyyppejä. Kokeile myöhemmin uudelleen.'}</span>
                  </div>
                )}

                {variants.length > 0 && (
                  <div className="simple-variants">
                    <div className="simple-variants__head">
                      <h4>Lipputyyppi</h4>
                      <span>{salesUpcoming ? `Botti yrittää myynnin auetessa: ${targetSummary}` : `Botti yrittää: ${targetSummary}`}</span>
                    </div>
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
                            <small>{soldOut ? 'Loppu' : salesUpcoming ? 'Myynti ei ole vielä alkanut' : `${variant.availability} jäljellä`}</small>
                          </span>
                          <strong>{formatMoney(price)}</strong>
                        </button>
                      )
                    })}
                  </div>
                )}

                {salesUpcoming && (
                  <label className="simple-risk-option simple-ticket-query">
                    <span>
                      <strong>Lipputyypin vihje</strong>
                      <small>Jos lipputyyppiä ei vielä näy, kirjoita esim. opiskelija, perjantai tai VIP. Tyhjänä botti yrittää kaikkia löytyviä lipputyyppejä käyttäjän omalla vastuulla.</small>
                    </span>
                    <input
                      value={ticketNameQuery}
                      onChange={(event) => setTicketNameQuery(event.target.value)}
                      disabled={Boolean(activeSnipe)}
                      placeholder="esim. opiskelija"
                      aria-label="Lipputyypin vihje"
                    />
                  </label>
                )}

                <div className="simple-start">
                  {snipeForActive?.phase === 'landed' ? (
                    <div className="simple-landed">
                      <div className="simple-landed__info">
                        <strong>Liput ovat korissa.</strong>
                        <span>Maksa noin {paymentMsLeft != null ? formatCountdown(paymentMsLeft) : '25:00'} kuluessa.</span>
                      </div>
                      <a className="simple-button simple-button--primary" href={KIDE_CHECKOUT_URL} target="_blank" rel="noreferrer">Avaa kori</a>
                    </div>
                  ) : (
                    <>
                      <div className="simple-quantity">
                        <button onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
                        <span>{quantity} kpl</span>
                        <button onClick={() => setQuantity((value) => Math.min(10, value + 1))}>+</button>
                      </div>
                      <button
                        className="simple-button simple-button--primary"
                        disabled={!canStart}
                        onClick={() => {
                          const trimmedQuery = ticketNameQuery.trim()
                          const variantIds = salesUpcoming
                            ? presaleTargets.map((variant) => variant.inventoryId)
                            : selectedVariant
                              ? [selectedVariant.inventoryId]
                              : []
                          p.onStart({
                            variantId: selectedVariant?.inventoryId,
                            variantName: selectedVariant?.name ?? (trimmedQuery ? `Lähin osuma: ${trimmedQuery}` : 'Kaikki löytyvät lipputyypit'),
                            quantity,
                            variantIds,
                            ticketNameQuery: trimmedQuery || undefined,
                          })
                        }}
                      >
                        {!p.tokenValid ? 'Token puuttuu' : activeSnipe ? 'Botti käynnissä' : 'Käynnistä botti'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {p.latestLog && (
          <section className={`simple-log simple-log--${p.latestLog.level} ${logOpen ? 'is-open' : ''}`}>
            <button type="button" className="simple-log__summary" onClick={() => setLogOpen((open) => !open)}>
              <span>Live-logi</span>
              <strong>{p.latestLog.text}</strong>
              <time>{p.latestLog.ts}</time>
            </button>
            {logOpen && (
              <div className="simple-log__history">
                {p.logs.map((log) => (
                  <div key={log.id} className={`simple-log__row simple-log__row--${log.level}`}>
                    <time>{log.ts}</time>
                    <span>{log.text}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="simple-footer">
        <span>
          Tärppi · Tekijä{' '}
          <a href="https://www.anttimurtokangas.com" target="_blank" rel="noreferrer">
            Antti Murtokangas
          </a>
        </span>
        <span>
          Palaute ja yhteydenotot{' '}
          <a href="https://www.anttimurtokangas.com" target="_blank" rel="noreferrer">
            portfolion kautta
          </a>
          {' '}· Epävirallinen työkalu, ei Kide.appin tuottama
        </span>
      </footer>
    </div>
  )
}
