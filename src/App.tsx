import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addToCart,
  cancelServerSnipe,
  createServerSnipe,
  extractEventId,
  fetchBackendHealth,
  fetchEventDetail,
  fetchExtraProperties,
  fetchKideTime,
  getApiStatus,
  getServerSnipe,
  maskToken,
  scanCity,
  validateToken,
} from './lib/kide/api'
import type { BackendHealthResponse, EventResponse, ScoredEvent } from './lib/kide/types'
import type { LogLine, SnipeSession, SnipePhase } from './lib/lt/types'
import { nowStr, uid } from './lib/lt/tokens'
import CommandPalette, { type Command } from './components/lt/CommandPalette'
import TokenDrawer from './components/lt/TokenDrawer'
import CityPicker from './components/CityPicker'
import SimpleDashboard from './components/lt/SimpleDashboard'
import './App.css'

const MAX_LOG = 40
const DEFAULT_POLL_MS = 800
const DEFAULT_CITY = 'Helsinki'
type BackendStatus = 'checking' | 'ready' | 'missing-config' | 'offline'

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writeLS(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export default function App() {
  const apiStatus = useMemo(() => getApiStatus(), [])

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
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendMessage, setBackendMessage] = useState<string | null>(null)
  const [backendHealth, setBackendHealth] = useState<BackendHealthResponse | null>(null)

  // selection
  const [activeId, setActiveId] = useState<string | undefined>()

  // overlays
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cityPickerOpen, setCityPickerOpen] = useState(false)

  // event detail
  const [detail, setDetail] = useState<EventResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // clock sync — offset between Kide.app server time and browser clock
  const [clockOffsetMs, setClockOffsetMs] = useState(0)

  // snipe
  const [snipe, setSnipe] = useState<SnipeSession | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [, setLatencies] = useState<number[]>([])
  const [landedCount, setLandedCount] = useState<number>(() => Number(readLS('kh.landed', '0')))
  // server-side snipe job (survives browser close)
  const [serverJobId, setServerJobId] = useState<string | null>(() => readLS('kh.serverJobId', '') || null)

  // tick for reactive "last updated" label (every 15s)
  const [, setTick] = useState(0)
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
  useEffect(() => { writeLS('kh.serverJobId', serverJobId ?? '') }, [serverJobId])

  // Drive the "last updated X s ago" label
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // validate token on mount / when it changes
  useEffect(() => {
    if (!token.trim()) { setTokenValid(false); setTokenEmail(undefined); return }
    validateToken(token.trim())
      .then((r) => { setTokenValid(!!r.valid); setTokenEmail(r.info?.email ?? r.user?.email) })
      .catch(() => { setTokenValid(false); setTokenEmail(undefined) })
  }, [token])

  // ─── scan ────────────────────────────────────────────────────────────────
  const pushLog = useCallback((level: LogLine['level'], text: string) => {
    setLogs((prev) => [{ id: uid(), ts: nowStr(), level, text }, ...prev].slice(0, MAX_LOG))
  }, [])

  const checkBackend = useCallback(async () => {
    if (!apiStatus.configured) {
      const msg = apiStatus.error ?? 'Backend API URL puuttuu.'
      setBackendStatus('missing-config')
      setBackendMessage(msg)
      setBackendHealth(null)
      setScanning(false)
      setScanError(msg)
      pushLog('err', msg)
      return
    }

    setBackendStatus('checking')
    setBackendMessage(null)
    try {
      const health = await fetchBackendHealth()
      setBackendHealth(health)
      setBackendStatus('ready')
      setBackendMessage(health.status === 'degraded' ? 'Backend vastaa, mutta osa palveluista on heikossa tilassa.' : null)
      pushLog(health.status === 'ok' ? 'ok' : 'warn', `Yhteys ${health.status} · ${apiStatus.apiUrl || 'same-origin'}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Backend ei vastaa'
      setBackendStatus('offline')
      setBackendMessage(msg)
      setBackendHealth(null)
      setScanning(false)
      setScanError(msg)
      pushLog('err', `Backend offline: ${msg}`)
    }
  }, [apiStatus, pushLog])

  useEffect(() => { void checkBackend() }, [checkBackend])

  // Sync clock only after the backend API has been confirmed.
  useEffect(() => {
    if (backendStatus !== 'ready') return
    fetchKideTime().then((r) => setClockOffsetMs(r.offsetMs)).catch(() => {})
  }, [backendStatus])

  // ─── server-side snipe job polling ──────────────────────────────────────
  // Polls the server-side snipe job every 2 s when one is active.
  // If the server lands the cart while the browser is open, we mirror it here.
  useEffect(() => {
    if (!serverJobId) return
    const id = setInterval(async () => {
      try {
        const job = await getServerSnipe(serverJobId)
        if (job.status === 'success') {
          const qty = job.quantity ?? 1
          pushLog('ok', `Varaus meni läpi · ${qty} kpl lisätty koriin`)
          setSnipe((s) => (s ? { ...s, phase: 'landed' as SnipePhase, quantity: qty } : s))
          setLandedCount((n) => n + 1)
          setServerJobId(null)
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          pushLog('warn', `Palvelinseuranta päättyi: ${job.message ?? job.status}`)
          setServerJobId(null)
        }
      } catch (error) {
        const status = typeof error === 'object' && error && 'status' in error
          ? Number((error as { status?: number }).status)
          : undefined

        if (status === 404) {
          pushLog('warn', 'Palvelinseuranta vanheni palvelimelta — nollaan vanhan työn')
          setServerJobId(null)
          return
        }

        if (status === 429) {
          pushLog('warn', 'Palvelinseurannan tarkistus hidastettu hetkeksi')
          return
        }

        // Network blip — keep polling
      }
    }, 2000)
    return () => clearInterval(id)
  }, [serverJobId, pushLog])

  const runScan = useCallback(async (target?: string) => {
    if (backendStatus !== 'ready') {
      const msg = backendMessage ?? 'Backend ei ole valmis.'
      setScanError(msg)
      pushLog('warn', `Skannaus odottaa backendia: ${msg}`)
      return
    }

    const c = target ?? city
    setScanning(true)
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
  }, [backendMessage, backendStatus, city, pushLog])

  useEffect(() => {
    if (backendStatus === 'ready') void runScan(city)
  }, [backendStatus, city, runScan])

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
    // Also cancel the server-side job if one is active
    setServerJobId((prev) => {
      if (prev) cancelServerSnipe(prev).catch(() => {})
      return null
    })
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

    // ─ Register server-side snipe job (runs on Railway even if browser closes)
    const det = detailRef.current
    const salesStartMs = det?.product.dateSalesFrom
      ? new Date(det.product.dateSalesFrom).getTime()
      : det?.product.timeUntilSalesStart && det.product.timeUntilSalesStart > 0
        ? Date.now() + det.product.timeUntilSalesStart * 1000
        : undefined
    createServerSnipe(token.trim(), params.variantId, params.quantity, salesStartMs, activeId)
      .then((job) => {
        setServerJobId(job.jobId)
        const whenStr = job.scheduledFor
          ? `aukeaa ${new Date(job.scheduledFor + 1000).toLocaleTimeString('fi-FI')} — palvelin ampuu automaattisesti`
          : 'palvelinseuranta aktiivinen'
        pushLog('info', `Palvelinseuranta rekisteröity · ${whenStr}`)
      })
      .catch((error) => {
        setServerJobId(null)
        const status = typeof error === 'object' && error && 'status' in error
          ? Number((error as { status?: number }).status)
          : undefined
        const message = error instanceof Error ? error.message : 'tuntematon virhe'
        if (status === 429) {
          pushLog('warn', `Palvelinseuranta hylättiin hetkeksi: ${message}`)
          return
        }
        pushLog('warn', `Palvelinseurannan rekisteröinti epäonnistui — vain selain seuraa (${message})`)
      })

    let attempts = 0
    let didRefreshBeforeSale = false

    const tryCart = async (qty: number): Promise<boolean> => {
      const r = await addToCart(token.trim(), params.variantId, qty)
      if (r.success) {
        pushLog('ok', `ONNISTUI — ${qty} kpl lisätty koriin`)
        setSnipe((s) => (s ? { ...s, phase: 'landed', quantity: qty } : s))
        setLandedCount((n) => n + 1)
        return true
      }

      if (
        r.message.includes('Variant not available')
        || r.message.includes('Invalid inventory ID')
        || r.message.includes('Token validation failed')
      ) {
        fetchExtraProperties().catch(() => {})
      }

      if (r.retryAfterMs && r.retryAfterMs > 0) {
        pushLog('warn', `Rate limited — odotan ${Math.round(r.retryAfterMs / 1000)}s`)
        await new Promise((res) => setTimeout(res, r.retryAfterMs!))
      }
      if (fallbackMode && r.retryWithQuantity && r.retryWithQuantity > 0) {
        const r2 = await addToCart(token.trim(), params.variantId, r.retryWithQuantity)
        if (r2.success) {
          pushLog('ok', `ONNISTUI (varareitti) — ${r.retryWithQuantity} kpl lisätty koriin`)
          setSnipe((s) => (s ? { ...s, phase: 'landed', quantity: r.retryWithQuantity! } : s))
          setLandedCount((n) => n + 1)
          return true
        }
      }
      pushLog('warn', r.message || 'Varaus ei onnistunut — jatkan')
      return false
    }

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
        // Apply clock offset so we fire relative to Kide's clock, not the browser's.
        const tUntil = (det.product.timeUntilSalesStart ?? 0) - clockOffsetMs / 1000
        if (tUntil > 0) {
          const salesStartAt = Date.now() + tUntil * 1000
          setSnipe((s) => (s ? { ...s, phase: 'waiting', salesStartAt } : s))

          // Refresh connection values once in the 30 s window before sale opens
          if (tUntil <= 30 && !didRefreshBeforeSale) {
            didRefreshBeforeSale = true
            fetchExtraProperties().catch(() => {})
            pushLog('info', `Myynti aukeaa ${Math.round(tUntil)}s päästä — yhteysarvot päivitetty`)
          } else if (tUntil <= 10) {
            pushLog('info', `Myynti aukeaa ${Math.round(tUntil)}s päästä!`)
          }

          // Adaptive polling: finer steps close to open time
          const adaptiveDelay =
            tUntil <= 2   ? 100 :
            tUntil <= 5   ? 150 :
            tUntil <= 15  ? 300 :
            tUntil <= 60  ? 1000 :
            tUntil <= 300 ? 5000 : 20_000
          await new Promise((r) => setTimeout(r, adaptiveDelay))
          continue
        }

        // ─ Sales just opened (was waiting) — fire immediately without
        //   waiting for availability > 0. Kide returns error type 13 if
        //   still unavailable; that's handled below. One poll cycle of
        //   latency saved beats a false negative from the availability field.
        const wasWaiting = snipeRef.current?.phase === 'waiting'
        if (wasWaiting) {
          setSnipe((s) => (s ? { ...s, phase: 'hunting', salesStartAt: undefined } : s))
          pushLog('ok', 'Myynti avautui — ammutaan heti!')
          if (variant) {
            try {
              const landed = await tryCart(params.quantity)
              if (landed) break
            } catch (err) {
              pushLog('err', `Varausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
            }
          }
        }

        if (!variant) {
          pushLog('warn', 'Lipputyyppiä ei löydy — pysäytän')
          setSnipe((s) => (s ? { ...s, phase: 'error', message: 'Lipputyyppiä ei löydy' } : s))
          break
        }

        if (variant.availability > 0) {
          pushLog('info', `Saatavilla ${variant.availability} kpl — yritän lisätä koriin`)
          try {
            const qty = Math.min(params.quantity, variant.availability)
            const landed = await tryCart(qty)
            if (landed) break
          } catch (err) {
            pushLog('err', `Varausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
          }
        } else if (!det.product.salesEnded && (det.product.timeUntilSalesStart ?? 0) <= 0) {
          try {
            const landed = await tryCart(params.quantity)
            if (landed) break
          } catch (err) {
            pushLog('err', `Varausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
          }
        }
      } catch (err) {
        pushLog('warn', `Pollausvirhe: ${err instanceof Error ? err.message : 'tuntematon'}`)
      }
      // ±100ms jitter so simultaneous snipe clients don't hit Kide at the same tick
      const jitter = Math.round(Math.random() * 200 - 100)
      await new Promise((r) => setTimeout(r, Math.max(100, pollMs + jitter)))
    }
  }, [events, activeId, token, tokenValid, fallbackMode, pollMs, clockOffsetMs, pushLog])

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
  // Recomputes on every tick (every 15s) so the label stays fresh
  const lastUpdatedLabel = (() => {
    if (!lastScanAt) return 'ei päivitetty'
    const s = Math.max(0, Math.floor((Date.now() - lastScanAt) / 1000))
    if (s < 60) return `päivitetty ${s} s sitten`
    return `päivitetty ${Math.floor(s / 60)} min sitten`
  })()


  // ─── handlers ───────────────────────────────────────────────────────────
  const handlePick = (id: string) => {
    setActiveId(id)
    loadDetail(id)
  }
  const handleUrlSubmit = (url: string) => {
    const id = extractEventId(url)
    if (!id) { pushLog('err', 'URL-tunnistus epäonnistui'); return }
    setActiveId(id)
    loadDetail(id)
    pushLog('info', `Tapahtuma ladattu URL:sta · ${id.slice(0, 8)}…`)
  }

  const commands: Command[] = [
    { id: 'scan', icon: '◎', label: `Skannaa ${city} uudelleen`, run: () => runScan() },
    { id: 'stop', icon: '⏻', label: 'Pysäytä aktiivinen seuranta', run: stopSnipe },
    { id: 'settings', icon: '⚙', label: 'Avaa asetukset', hint: 'Ctrl+,', run: () => setDrawerOpen(true) },
    { id: 'city', icon: '◉', label: 'Vaihda kaupunki', run: () => setCityPickerOpen(true) },
    { id: 'refresh', icon: '⟳', label: 'Päivitä yhteysarvot', run: () => { fetchExtraProperties().then(() => pushLog('ok', 'Yhteysarvot päivitetty')).catch(() => pushLog('err', 'Yhteysarvojen päivitys epäonnistui')) } },
  ]

  return (
    <div className="lt-app">
      <SimpleDashboard
        events={events}
        activeId={activeId}
        activeEvent={activeEvent}
        detail={detail}
        detailLoading={detailLoading}
        detailError={detailError}
        backendStatus={backendStatus}
        backendMessage={backendMessage}
        backendHealth={backendHealth}
        apiUrl={apiStatus.apiUrl}
        city={city}
        tokenValid={tokenValid}
        tokenLabel={tokenEmail ?? (token ? maskToken(token) : undefined)}
        loading={scanning}
        scanError={scanError}
        lastUpdatedLabel={lastUpdatedLabel}
        landedCount={landedCount}
        snipe={snipe}
        latestLog={logs[0]}
        pollMs={pollMs}
        onPick={handlePick}
        onRescan={() => runScan()}
        onRetryBackend={checkBackend}
        onOpenSettings={() => setDrawerOpen(true)}
        onOpenCity={() => setCityPickerOpen(true)}
        onSubmitUrl={handleUrlSubmit}
        onStart={startSnipe}
        onStopSnipe={stopSnipe}
      />

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
