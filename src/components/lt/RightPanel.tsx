import { useState, useMemo, useEffect } from 'react'
import { C, F } from '../../lib/lt/tokens'
import { Kbd, Lbl, Pill } from '../../lib/lt/primitives'
import type { ScoredEvent, EventResponse, KideVariant } from '../../lib/kide/types'
import type { SnipeSession } from '../../lib/lt/types'

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
}

export default function RightPanel(p: Props) {
  const ev = p.event
  const [selectedVariantId, setSelectedVariantId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (ev) p.onLoadDetail(ev.event_id)
    setSelectedVariantId('')
    setQuantity(1)
  }, [ev?.event_id])

  const variants: KideVariant[] = p.detail?.variants ?? []
  const selectedVariant = useMemo(
    () => variants.find((v) => v.inventoryId === selectedVariantId) ?? variants.find((v) => v.availability > 0) ?? variants[0],
    [variants, selectedVariantId],
  )

  if (!ev) {
    return (
      <aside className="lt-right lt-right--empty">
        <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11, textAlign: 'center', padding: 24 }}>
          Valitse tapahtuma tutkasta
        </div>
      </aside>
    )
  }

  const col = ev.decision === 'BUY' ? C.buy : ev.decision === 'MAYBE' ? C.maybe : C.skip
  const feat = ev.feature_breakdown

  const canStart =
    p.tokenValid &&
    selectedVariant &&
    selectedVariant.availability > 0 &&
    !p.activeSnipe

  return (
    <aside className="lt-right">
      <div className="lt-right__head">
        <Lbl>Zoom · tapahtuma</Lbl>
        <span style={{ flex: 1 }} />
        <button className="lt-iconbtn" onClick={p.onClose} aria-label="Sulje">×</button>
      </div>

      <div className="lt-right__scroll">
        <div style={{ padding: 16, paddingBottom: 0 }}>
          <div className="lt-cover">
            {ev.media_url && <img src={ev.media_url} alt="" className="lt-cover__img" />}
            <div className="lt-cover__title">{ev.name}</div>
            <div className="lt-cover__badge">
              <Pill color={C.bg} bg={col}>
                {ev.decision} · {Math.round(ev.resell_score)}
              </Pill>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 16px 0', fontFamily: F.mono, fontSize: 11, color: C.inkSoft, lineHeight: 1.7 }}>
          <div><span style={{ color: C.inkMuted }}>järj.</span> {ev.organiser ?? '—'}</div>
          <div><span style={{ color: C.inkMuted }}>aika</span> {ev.start_time ? new Date(ev.start_time).toLocaleString('fi-FI') : '—'}</div>
          <div><span style={{ color: C.inkMuted }}>kaupunki</span> {ev.city ?? '—'}</div>
          <div><span style={{ color: C.inkMuted }}>hinta</span> {ev.base_price_eur ?? '—'}
            {ev.max_price_eur && ev.max_price_eur !== ev.base_price_eur ? `–${ev.max_price_eur}` : ''} €</div>
        </div>

        {ev.reason && (
          <div style={{ padding: '12px 16px 0' }}>
            <div className="lt-reason" style={{ borderLeftColor: col, background: col === C.buy ? 'rgba(74,222,128,0.08)' : col === C.maybe ? 'rgba(251,191,36,0.08)' : 'rgba(248,113,113,0.08)' }}>
              „{ev.reason}"
            </div>
          </div>
        )}

        <div style={{ padding: '16px 16px 0' }}>
          <Lbl>Tekoäly · signaalit</Lbl>
          <div style={{ marginTop: 8 }}>
            {[
              ['Suosio', feat.popularity],
              ['Kysyntä', feat.demand],
              ['Hinnoittelu', feat.pricing],
              ['Ajoitus', feat.timing],
              ['Järjestäjä', feat.organiser],
            ].map(([k, v]) => {
              const val = Math.round(Number(v) || 0)
              return (
                <div key={k as string} className="lt-feature">
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

        <div style={{ padding: '16px 16px 0' }}>
          <Lbl>Lipputyypit</Lbl>
          {p.detailLoading && (
            <div style={{ color: C.inkMuted, fontFamily: F.mono, fontSize: 11, padding: '10px 0' }}>
              Ladataan variantteja…
            </div>
          )}
          {p.detailError && (
            <div style={{ color: C.skip, fontFamily: F.mono, fontSize: 11, padding: '10px 0' }}>
              {p.detailError}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {variants.map((v) => {
              const soldOut = v.availability <= 0
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
                      {soldOut ? 'LOPPUUNMYYTY' : `${v.availability} vapaata · max ${v.productVariantMaximumReservableQuantity ?? 10}`}
                    </div>
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600 }}>
                    {v.price ?? v.pricePerItem ?? '—'}€
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ padding: '16px 16px 0' }}>
          <Lbl>Metsästysasetukset</Lbl>
          <div className="lt-settings">
            <div className="lt-settings__row">
              <span style={{ color: C.inkSoft }}>määrä</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="lt-qbtn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >−</button>
                <span style={{ color: C.ink, minWidth: 28, textAlign: 'center' }}>{quantity} kpl</span>
                <button
                  className="lt-qbtn"
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                >+</button>
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
          <span style={{ fontSize: 13 }}>▶</span> {p.activeSnipe ? 'Hiiri käynnissä' : 'Käynnistä hiiri'}
          <span style={{ marginLeft: 4, fontFamily: F.mono, fontSize: 10, opacity: 0.7 }}><Kbd>⌘⏎</Kbd></span>
        </button>
      </div>
    </aside>
  )
}
