import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addToCart,
  extractEventId,
  fetchEventDetail,
  fetchExtraProperties,
  maskToken,
  scanCity,
  validateToken,
} from './lib/kide/api'
import type { EventResponse, ScoredEvent } from './lib/kide/types'
import type { LogLine, SnipeSession, SnipePhase } from './lib/lt/types'
import { nowStr, uid } from './lib/lt/tokens'
import LeftPanel from './components/lt/LeftPanel'
import CenterPanel from './components/lt/CenterPanel'
import RightPanel from './components/lt/RightPanel'
import CommandPalette, { type Command } from './components/lt/CommandPalette'
import TokenDrawer from './components/lt/TokenDrawer'
import CityPicker from './components/CityPicker'
import './App.css'

const MAX_LOG = 40
const DEFAULT_POLL_MS = 500
const DEFAULT_CITY = 'Helsinki'

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export default function App() {
  // persistent settings
  const [token, setToken] = useState(() => readLS('kh.token', ''))
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenEmail, setTokenEmail] = useState<string | undefined>()
  const [pollMs, setPollMs] = useState<number>(() => Number(readLS('kh.pollMs', String(DEFAULT_POLL_MS))))
  const [fallbackMode, setFallbackMode] = useState<boolean>(() => readLS('kh.fallback', '1') === '1')
  const [proxyUrl, setProxyUrl] = useState<string>(() => readLS('kh.proxy', ''))
  const [city, setCity] = useState<string>(() => readLS('kh.city', DEFAULT_CITY))

  // scan
  const [events, setEvents] = useState<ScoredEvent[]>([])
  const [scanning, setScanning] = useState(false)
  const [lastScanAt, setLastScanAt] = useState<number | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  // layout
  const [activeId, setActiveId] = useState<string | undefined>()
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [showRight, setShowRight] = useState(true)
  const [leftUserOverride, setLeftUserOverride] = useState(false)
  const [rightUserOverride, setRightUserOverride] = useState(false)

  // overlays
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)

  // event detail
  const [detail, setDetail] = useState<EventResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // snipe
  const [snipe, setSnipe] = useState<SnipeSession | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [latencies, setLatencies] = useState<number[]>([])
  const [landedCount, setLandedCount] = useState<number>(() => Number(readLS('kh.landed', '0')))
  const snipeRunRef = useRef<{ cancelled: boolean } | null>(null)
  const snipeRef = useRef(snipe)
  const detailRef = useRef<EventResponse | null>(null)

  useEffect(() => { snipeRef.current = snipe }, [snipe])
  useEffect(() => { detailRef.current = detail }, [detail])

  // ─── persistence + initial load ─────────────────────────────────────────
  useEffect(() => { writeLS('kh.token', token) }, [token])
  useEffect(() => { writeLS('kh.pollMs', String(pollMs)) }, [pollMs])
  useEffect(() => { writeLS('kh.fallback', fallbackMode ? '1' : '0') }, [fallbackMode])
  useEffect(() => { writeLS('kh.city', city) }, [city])
  useEffect(() => { writeLS('kh.landed', String(landedCount)) }, [landedCount])
  useEffect(() => { writeLS('kh.proxy', proxyUrl) }, [proxyUrl])

  useEffect(() => { fetchExtraProperties().catch(() => {}) }, [])

  // validate token on mount / when it changes
  useEffect(() => {
    if (!token.trim()) { setTokenValid(false); setTokenEmail(undefined); return }
    validateToken(token.trim())
      .then((r) => { setTokenValid(!!r.valid); setTokenEmail(r.info?.email ?? r.user?.email) })
      .catch(() => { setTokenValid(false); setTokenEmail(undefined) })
  }, [token])

  // responsive sidebars
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth
      if (!leftUserOverride) setLeftCollapsed(w < 1180)
      if (!rightUserOverride) setShowRight(w >= 980)
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [leftUserOverride, rightUserOverride])

  // ─── scan ────────────────────────────────────────────────────────────────
  const pushLog = useCallback((level: LogLine['level'], text: string) => {
    setLogs((prev) => [{ id: uid(), ts: nowStr(), level, text }, ...prev].slice(0, MAX_LOG))
  }, [])

  const runScan = useCallback(async (target?: string) => {
    const c = target ?? city
    setScanning(true)
    setDetailFor(undefined)
    setScanError(null)
    try {
      const r = await scanCity(c)
      setEvents(r.events)
      setLastScanAt(Date.now())
      pushLog('ok', `Skannaus · ${c || 'Kaikkialla'} · ${r.events.length} tapahtumaa`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'virhe'
      setScanError(msg)
      pushLog('err', `Skannaus epäonnistui: ${msg}`)
    } finally {
      setScanning(false)
    }
  }, [city, pushLog])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runScan(city) }, [city])

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((o) => !o); return }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); setDrawerOpen(true); return }
      if (e.key === 'Escape') {
        // Sulje vain päällimmäinen overlay, ei kaikkia kerralla
        if (drawerOpen) { setDrawerOpen(false); return }
        if (paletteOpen) { setPaletteOpen(false); return }
        if (cityPickerOpen) { setCityPickerOpen(false); return }
        return
      }
      // N avaa paletin vain jos mikään overlay ei ole auki ja focus ei ole inputissa
      if (!paletteOpen && !drawerOpen && !cityPickerOpen && e.key.toLowerCase() === 'n') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen, drawerOpen, cityPickerOpen])

  // ─── sniper loop ────────────────────────────────────────────────────────
  const stopSnipe = useCallback(() => {
    if (snipeRunRef.current) snipeRunRef.current.cancelled = true
    setSnipe((s) => (s ? { ...s, phase: 'error' as SnipePhase, message: 'Pysäytetty' } : s))
    setLatencies([])
  }, [])

  const startSnipe = useCallback(async (params: { variantId: string; variantName: string; quantity: number }) => {
    if (!activeId) return
    const ev = events.find((e) => e.event_id === activeId)
    const eventName = ev?.name ?? detailRef.current?.product.name ?? 'Tapahtuma'

    if (!token.trim() || !tokenValid) {
      pushLog('err', 'Token ei ole voimassa — avaa asetukset')
      setDrawerOpen(true)
      return
    }
    const currentSnipe = snipeRef.current
    if (currentSnipe && currentSnipe.phase !== 'error' && currentSnipe.phase !== 'landed') {
      pushLog('warn', 'Seuranta on jo käynnissä')
      return
    }

    const session: SnipeSession = {
      id: uid(),
      eventId: activeId,
      eventName,
      variantId: params.variantId,
      variantName: params.variantName,
      quantity: params.quantity,
      phase: 'hunting',
      startedAt: Date.now(),
      attempts: 0,
    }
    setSnipe(session)
    pushLog('ok', `Seuranta alkoi · ${eventName} · ${params.variantName} · ${params.quantity}×`)
    const run = { cancelled: false }
    snipeRunRef.current = run

    let attempts = 0
    while (!run.cancelled) {
      attempts++
      setSnipe((s) => (s ? { ...s, attempts, lastCheckedAt: Date.now() } : s))
      const started = Date.now()
      try {
        const det = await fetchEventDetail(activeId)
        const variant = det.variants.find((v) => v.inventoryId === params.variantId)
        const latency = Date.now() - started
        setLatencies((ls) => [...ls.slice(-19), latency])

        // ─ Sales ended
        if (det.product.salesEnded) {
          pushLog('warn', 'Myynti on päättynyt — pysäytän')
          setSnipe((s) => (s ? { ...s, phase: 'error', message: 'Myynti päättynyt' } : s))
          break
        }

        // ─ Pre-sale waiting phase
        const tUntil = det.product.timeUntilSalesStart ?? 0
        if (tUntil > 0) {
          const salesStartAt = Date.now() + tUntil * 1000
          setSnipe((s) => (s ? { ...s, phase: 'waiting', salesStartAt } : s))
          if (tUntil <= 10) {
            pushLog('info', `Myynti aukeaa ${Math.round(tUntil)}s päästä!`)
          }
          // Adaptive polling: fast when close, slow when far
          const adaptiveDelay = tUntil <= 5 ? pollMs : tUntil <= 30 ? 1000 : 10000
          await new Promise((r) => setTimeout(r, adaptiveDelay))
          continue
        }

        // ─ Sales just opened (was waiting)
        if (snipeRef.current?.phase === 'waiting') {
          setSnipe((s) => (s ? { ...s, phase: 'hunting', salesStartAt: undefined } : s))
          pushLog('ok', 'Myynti avautui — yritetään nyt!')
        }

        if (!variant) {
          pushLog('warn', 'Lipputyyppiä ei löydy — pysäytän')
          setSnipe((s) => (s ? { ...s, phase: 'error', message: 'Lipputyyppiä ei löydy' } : s))
          break
        }

        if (variant.availability > 0) {
          pushLog('info', `Saatavilla ${variant.availability} kpl — yritän lisätä koriin`)
          const qty = Math.min(params.quantity, variant.availability)
          try {
            const r = await addToCart(token.trim(), params.variantId, qty)
            if (r.success) {
              pushLog('ok', `ONNISTUI — ${qty} kpl lisätty koriin`)
              setSnipe((s) => (s ? { ...s, phase: 'landed', quantity: qty } : s))
              setLandedCount((n) => n + 1)
              break
            }
            if (fallbackMode && r.retryWithQuantity && r.retryWithQuantity > 0) {
              const r2 = await addToCart(token.trim(), params.variantId, r.retryWithQuantity)
              if (r2.success) {
                pushLog('ok', `ONNISTUI (varareitti) — ${r.retryWithQuantity} kpl lisätty koriin`)
                setSnipe((s) => (s ? { ...s, phase: 'landed', quantity: r.retryWithQuantity! } : s))
                setLandedCount((n) => n + 1)
                break
              }
            }
            pushLog('warn', r.message || 'Varaus ei onnistunut — jatkan')
          } catch (err) {
            pushLog('err', `Varausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
          }
        }
      } catch (err) {
        pushLog('warn', `Pollausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
      }
      await new Promise((r) => setTimeout(r, pollMs))
    }
  }, [events, activeId, token, tokenValid, fallbackMode, pollMs, pushLog])

  // ─── event detail fetcher ───────────────────────────────────────────────
  const loadDetail = useCallback(async (id: string) => {
    setDetail(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const d = await fetchEventDetail(id)
      setDetail(d)
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Lataus epäonnistui')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // ─── derived ────────────────────────────────────────────────────────────
  const activeEvent = useMemo(() => events.find((e) => e.event_id === activeId), [events, activeId])
  const watchlist = useMemo(
    () => events.filter((e) => e.decision === 'BUY' || e.decision === 'MAYBE').slice(0, 8),
    [events],
  )
  const avgLatency = useMemo(() => {
    if (latencies.length === 0) return undefined
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
  }, [latencies])
  const lastUpdatedLabel = useMemo(() => {
    if (!lastScanAt) return 'ei päivitetty'
    const s = Math.max(0, Math.floor((Date.now() - lastScanAt) / 1000))
    if (s < 60) return `päivitetty ${s} s sitten`
    return `päivitetty ${Math.floor(s / 60)} min sitten`
  }, [lastScanAt])

  const snipesForLeft = snipe ? [snipe] : []
  const activeSnipeForPanels = snipe && snipe.phase !== 'landed' && snipe.phase !== 'error' ? snipe : undefined
  const missionSnipe = snipe && snipe.phase !== 'error' ? snipe : undefined

  // ─── handlers ───────────────────────────────────────────────────────────
  const handlePick = (id: string) => {
    setActiveId(id)
    setRightUserOverride(true)
    setShowRight(true)
  }
  const handleUrlSubmit = (url: string) => {
    const id = extractEventId(url)
    if (!id) { pushLog('err', 'URL-tunnistus epäonnistui'); return }
    setActiveId(id)
    setShowRight(true)
    loadDetail(id)
    pushLog('info', `Tapahtuma ladattu URL:sta · ${id.slice(0, 8)}…`)
  }

  const commands: Command[] = [
    { id: 'scan', icon: '◎', label: `Skannaa ${city} uudelleen`, run: () => runScan() },
    { id: 'stop', icon: '⏻', label: 'Pysäytä aktiivinen seuranta', run: stopSnipe },
    { id: 'settings', icon: '⚙', label: 'Avaa asetukset', hint: 'Ctrl+,', run: () => setDrawerOpen(true) },
    { id: 'city', icon: '◉', label: 'Vaihda kaupunki', run: () => setCityPickerOpen(true) },
    { id: 'refresh', icon: '⟳', label: 'Päivitä anti-bot-otsakkeet', run: () => { fetchExtraProperties().then(() => pushLog('ok', 'Otsakkeet päivitetty')).catch(() => pushLog('err', 'Otsakkeiden päivitys epäonnistui')) } },
  ]

  return (
    <div className="lt-app">
      <div className="lt-main">
        <LeftPanel
          snipes={snipesForLeft}
          watchlist={watchlist}
          logs={logs}
          activeId={activeId}
          onPick={handlePick}
          onNewSnipe={() => setPaletteOpen(true)}
          collapsed={leftCollapsed}
          onToggle={() => { setLeftUserOverride(true); setLeftCollapsed((c) => !c) }}
          onRescan={() => runScan()}
          userEmail={tokenEmail ?? (token ? maskToken(token) : undefined)}
          onOpenSettings={() => setDrawerOpen(true)}
        />
        <div className="lt-center-wrap">
          <div className="lt-center-col">
            <CenterPanel
              events={events}
              activeId={activeId}
              onPick={handlePick}
              activeSnipe={activeSnipeForPanels}
              missionSnipe={missionSnipe}
              pollMs={pollMs}
              latestLog={logs[0]}
              onStopSnipe={stopSnipe}
              city={city}
              onCityClick={() => setCityPickerOpen(true)}
              avgLatencyMs={avgLatency}
              landedCount={landedCount}
              lastUpdatedLabel={lastUpdatedLabel}
              loading={scanning}
              scanError={scanError}
              onOpenPalette={() => setPaletteOpen(true)}
              onRescan={() => runScan()}
            />
          </div>
          {showRight && (
            <RightPanel
              event={activeEvent}
              detail={detail}
              detailLoading={detailLoading}
              detailError={detailError}
              onClose={() => { setRightUserOverride(true); setShowRight(false) }}
              onStart={startSnipe}
              onLoadDetail={loadDetail}
              tokenMasked={token ? maskToken(token) : undefined}
              tokenValid={tokenValid}
              pollMs={pollMs}
              activeSnipe={activeSnipeForPanels}
              landedSnipe={snipe?.phase === 'landed' ? snipe : undefined}
            />
          )}
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        onSubmitUrl={handleUrlSubmit}
      />

      <TokenDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        token={token}
        tokenValid={tokenValid}
        tokenEmail={tokenEmail}
        pollMs={pollMs}
        fallbackMode={fallbackMode}
        proxyUrl={proxyUrl}
        onSave={(next) => {
          setToken(next.token)
          setPollMs(next.pollMs)
          setFallbackMode(next.fallbackMode)
          setProxyUrl(next.proxyUrl)
        }}
        onValidate={async (draftToken) => {
          const t = draftToken.trim()
          if (!t) return
          try {
            const r = await validateToken(t)
            setTokenValid(!!r.valid)
            setTokenEmail(r.info?.email ?? r.user?.email)
            pushLog(r.valid ? 'ok' : 'err', r.valid ? 'Token kelvollinen' : 'Token virheellinen')
          } catch {
            setTokenValid(false)
            pushLog('err', 'Tokenin tarkistus epäonnistui')
          }
        }}
      />

      {cityPickerOpen && (
        <div className="lt-palette-overlay" onClick={() => setCityPickerOpen(false)}>
          <div className="lt-drawer lt-drawer--narrow" onClick={(e) => e.stopPropagation()}>
            <div className="lt-drawer__head">
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 20, color: 'var(--lt-ink)', letterSpacing: '-0.02em' }}>
                Valitse kaupunki
              </div>
              <span style={{ flex: 1 }} />
              <button className="lt-iconbtn" onClick={() => setCityPickerOpen(false)}>×</button>
            </div>
            <div className="lt-drawer__body" style={{ paddingTop: 14 }}>
              <CityPicker
                value={city}
                onChange={(c) => { setCity(c); setCityPickerOpen(false) }}
                placeholder="Hae kaupunkia…"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
