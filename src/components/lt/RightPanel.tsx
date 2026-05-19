import { useState, useMemo, useEffect, useRef } from 'react'
import { C, F } from '../../lib/lt/tokens'
import { Kbd, Lbl, Pill } from '../../lib/lt/primitives'
import { buildMediaUrl } from '../../lib/kide/api'
import type { ScoredEvent, EventResponse, KideVariant } from '../../lib/kide/types'
import type { SnipeSession } from '../../lib/lt/types'

const KIDE_CART_URL = 'https://kide.app/basket'

function formatMoney(value?: number | null): string {
  if (typeof value !== 'number') return '—'
  return `${value.toFixed(value % 1 === 0 ? 0 : 2).replace('.', ',')} €`
}

function formatDateTime(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fi-FI', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type Props = {
  event?: ScoredEvent
  detail?: EventResponse | null
  detailLoading?: boolean
  detailError?: string | null
  onClose: () => void
  onStart: (params: { variantId: string; variantName: string; quantity: number }) => void
  onLoadDetail: (id: string) => void
  tokenMasked?: string
  tokenValid?: boolean
  pollMs: number
  activeSnipe?: SnipeSession
  landedSnipe?: SnipeSession
}

function SalesCountdown({ dateSalesFrom }: { dateSalesFrom: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const target = new Date(dateSalesFrom).getTime()
  const secsLeft = Math.max(0, Math.floor((target - Date.now()) / 1000))
  if (secsLeft <= 0) return <span style={{ color: C.accent }}>Myynti on käynnissä!</span>
  const h = Math.floor(secsLeft / 3600)
  const m = Math.floor((secsLeft % 3600) / 60)
  const s = secsLeft % 60
  return (
    <span style={{ color: C.maybe, fontFamily: F.mono }}>
      {h > 0 && `${h}t `}{m > 0 && `${m}m `}{s}s
    </span>
  )
}

export default function RightPanel(p: Props) {
  const ev = p.event
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const onLoadDetailRef = useRef(p.onLoadDetail)
  onLoadDetailRef.current = p.onLoadDetail

  useEffect(() => {
    if (ev) onLoadDetailRef.current(ev.event_id)
    setSelectedVariantId('')
    setQuantity(1)
  }, [ev?.event_id, p.onLoadDetail])

  const variants: KideVariant[] = p.detail?.variants ?? []
  const selectedVariant = useMemo(
    () => variants.find((v) => v.inventoryId === selectedVariantId) ?? variants.find((v) => v.availability > 0) ?? variants[0],
    [variants, selectedVariantId],
  )

  const salesFrom = p.detail?.product.dateSalesFrom
  const tUntil = p.detail?.product.timeUntilSalesStart ?? 0
  const isUpcoming = tUntil > 0
  const salesEnded = p.detail?.product.salesEnded ?? false
  const coverImage = ev?.media_url ?? buildMediaUrl(p.detail?.product.mediaFilename)

  const canStart =
    p.tokenValid &&
    selectedVariant &&
    (selectedVariant.availability > 0 || isUpcoming) &&
    !salesEnded &&
    !p.activeSnipe

  // ─── Landed banner ───────────────────────────────────────────────────────
  if (p.landedSnipe) {
    return (
      <aside className="lt-right">
        <div className="lt-right__head">
          <Lbl>Tapahtuman tiedot</Lbl>
          <span style={{ flex: 1 }} />
          <button className="lt-iconbtn" onClick={p.onClose} aria-label="Sulje">×</button>
        </div>
        <div className="lt-landed">
          <div className="lt-landed__icon">✓</div>
          <div className="lt-landed__title">Liput korissa!</div>
          <div className="lt-landed__sub">
            {p.landedSnipe.quantity} × {p.landedSnipe.variantName ?? 'lippu'}
          </div>
          <div className="lt-landed__event">{p.landedSnipe.eventName}</div>
          <a
            href={KIDE_CART_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="lt-cartlink"
          >
            Siirry kassalle Kide.appissa →
          </a>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 12, textAlign: 'center' }}>
            Vahvista maksu Kide.app-sovelluksessa tai selaimessa.
          </div>
        </div>
      </aside>
    )
  }

  // ─── Empty state ─────────────────────────────────────────────────────────
  if (!ev && !p.detail && !p.detailLoading) {
    return (
      <aside className="lt-right lt-right--empty">
        <div style={{ textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⌕</div>
          <div style={{ color: C.ink, fontFamily: F.sans, fontSize: 14, marginBottom: 6 }}>
            Valitse tapahtuma tutkasta
          </div>
          <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11 }}>
            tai liitä Kide.app-URL komentokenttään
          </div>
        </div>
      </aside>
    )
  }

  // ─── Loading from URL paste ───────────────────────────────────────────────
  if (!ev && p.detailLoading) {
    return (
      <aside className="lt-right lt-right--empty">
        <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11, textAlign: 'center', padding: 24 }}>
          Ladataan tapahtumaa…
        </div>
      </aside>
    )
  }

  const col = ev?.decision === 'BUY' ? C.buy : ev?.decision === 'MAYBE' ? C.maybe : C.skip
  const feat = ev?.feature_breakdown

  // ─── Synthesize cover title from detail when ScoredEvent is absent ───────
  const coverTitle = ev?.name ?? p.detail?.product.name ?? ''

  return (
    <aside className="lt-right">
      <div className="lt-right__head">
        <Lbl>Tapahtuman tiedot</Lbl>
        <span style={{ flex: 1 }} />
        <button className="lt-iconbtn" onClick={p.onClose} aria-label="Sulje">×</button>
      </div>

      <div className="lt-right__scroll">
        <div style={{ padding: 16, paddingBottom: 0 }}>
          <div className="lt-cover">
            {coverImage && <img src={coverImage} alt="" className="lt-cover__img" />}
            <div className="lt-cover__title">{coverTitle}</div>
            {ev && (
              <div className="lt-cover__badge">
                <Pill color={C.bg} bg={col}>
                  {ev.decision} · {Math.round(ev.resell_score)}
                </Pill>
              </div>
            )}
          </div>
        </div>

        {/* ─ Sales countdown banner */}
        {isUpcoming && salesFrom && (
          <div className="lt-salesstart">
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
              Myynti alkaa
            </div>
            <div style={{ fontSize: 22, fontFamily: F.mono }}>
              <SalesCountdown dateSalesFrom={salesFrom} />
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 4 }}>
              {new Date(salesFrom).toLocaleString('fi-FI')}
            </div>
          </div>
        )}

        {salesEnded && (
          <div className="lt-salesstart" style={{ borderColor: C.skip }}>
            <div style={{ color: C.skip, fontFamily: F.mono, fontSize: 12 }}>Myynti on päättynyt</div>
          </div>
        )}

        <div style={{ padding: '14px 16px 0', fontFamily: F.mono, fontSize: 11, color: C.inkSoft, lineHeight: 1.7 }}>
          <div><span style={{ color: C.inkMuted }}>järjestäjä</span> {ev?.organiser ?? '—'}</div>
          <div><span style={{ color: C.inkMuted }}>aika</span> {formatDateTime(ev?.start_time)}</div>
          <div><span style={{ color: C.inkMuted }}>kaupunki</span> {ev?.city ?? '—'}</div>
          <div>
            <span style={{ color: C.inkMuted }}>hinta</span>{' '}
            {formatMoney(ev?.base_price_eur)}
            {ev?.max_price_eur && ev.max_price_eur !== ev.base_price_eur ? ` – ${formatMoney(ev.max_price_eur)}` : ''}
          </div>
        </div>

        {feat && (
          <div style={{ padding: '16px 16px 0' }}>
            <Lbl>Tekoälysignaalit</Lbl>
            <div style={{ marginTop: 8 }}>
              {([
                ['Suosio', feat.popularity],
                ['Kysyntä', feat.demand],
                ['Hinnoittelu', feat.pricing],
                ['Ajoitus', feat.timing],
                ['Järjestäjä', feat.organiser],
              ] as [string, number][]).map(([k, v]) => {
                const val = Math.round(Number(v) || 0)
                return (
                  <div key={k} className="lt-feature">
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div style={{ fontFamily: F.sans, fontSize: 12, color: C.ink }}>{k}</div>
                      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.ink }}>{val}</div>
                    </div>
                    <div className="lt-feature__bar">
                      <div style={{ width: `${Math.min(100, Math.max(0, val))}%`, height: '100%', background: col }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ padding: '16px 16px 0' }}>
          <Lbl>Lipputyypit</Lbl>
          {!variants.length && !p.detailLoading && !p.detailError && (
            <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11, padding: '10px 0' }}>
              Ei lipputietoja.
            </div>
          )}
          {p.detailLoading && (
            <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11, padding: '10px 0' }}>
              Ladataan lipputyyppejä…
            </div>
          )}
          {p.detailError && (
            <div style={{ color: C.skip, fontFamily: F.mono, fontSize: 11, padding: '10px 0' }}>
              {p.detailError}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {variants.map((v) => {
              const soldOut = v.availability <= 0 && !isUpcoming
              const active = selectedVariant?.inventoryId === v.inventoryId
              return (
                <button
                  key={v.inventoryId}
                  onClick={() => !soldOut && setSelectedVariantId(v.inventoryId)}
                  disabled={soldOut}
                  className={`lt-variant ${active ? 'is-active' : ''} ${soldOut ? 'is-sold' : ''}`}
                >
                  <div className="lt-variant__radio">
                    {active && <div className="lt-variant__radio-inner" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{v.name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkSoft, marginTop: 2 }}>
                      {isUpcoming
                        ? 'Ennakkomyynti — seuranta odottaa'
                        : soldOut
                        ? 'Loppuunmyyty'
                        : `${v.availability} jäljellä · enintään ${v.productVariantMaximumReservableQuantity ?? 10}`}
                    </div>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600 }}>
                    {typeof v.price === 'number'
                      ? formatMoney(v.price / 100)
                      : typeof v.pricePerItem === 'number'
                      ? formatMoney(v.pricePerItem / 100)
                      : '—'}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '16px 16px 0' }}>
          <Lbl>Automaatioasetukset</Lbl>
          <div className="lt-settings">
            <div className="lt-settings__row">
              <span style={{ color: C.inkSoft }}>määrä</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button className="lt-qbtn" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                <span style={{ color: C.ink, minWidth: 28, textAlign: 'center' }}>{quantity} kpl</span>
                <button className="lt-qbtn" onClick={() => setQuantity((q) => Math.min(10, q + 1))}>+</button>
              </div>
            </div>
            <div className="lt-settings__row">
              <span style={{ color: C.inkSoft }}>pollausväli</span>
              <span style={{ color: C.ink }}>{p.pollMs} ms</span>
            </div>
            <div className="lt-settings__row">
              <span style={{ color: C.inkSoft }}>token</span>
              <span style={{ color: p.tokenValid ? C.accent : C.skip }}>
                {p.tokenMasked ?? 'ei asetettu'} {p.tokenValid ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }} />
      </div>

      <div className="lt-cta">
        <button
          className="lt-startbtn"
          disabled={!canStart}
          onClick={() => {
            if (!selectedVariant) return
            p.onStart({
              variantId: selectedVariant.inventoryId,
              variantName: selectedVariant.name,
              quantity,
            })
          }}
        >
          <span style={{ fontSize: 13 }}>{isUpcoming ? '◷' : '▶'}</span>
          {p.activeSnipe
            ? p.activeSnipe.phase === 'waiting'
              ? 'Odottaa myyntiä…'
              : 'Automaatio käynnissä'
            : isUpcoming
            ? 'Ennakkoseuranta'
            : 'Käynnistä automaatio'}
          <span style={{ marginLeft: 4, fontFamily: F.mono, fontSize: 10, opacity: 0.7 }}><Kbd>Ctrl+↵</Kbd></span>
        </button>
      </div>
    </aside>
  )
}
