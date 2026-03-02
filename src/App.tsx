import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { extractEventId, fetchEventProducts, fetchEventDetail, maskToken, validateToken, addToCart, fetchExtraProperties, scanCity, adminLogin, adminVerify, fetchTikettiEvents, triggerTikettiScrape, fetchTikettiEvent, addToTikettiCart } from './lib/kide/api'
import { getTranslation, type LanguageCode } from './lib/translations'
import type { ScoredEvent, TopEvent, SalesStatus, AiScore, KideVariant, TikettiEvent, TikettiEventDetail } from './lib/kide/types'
import CityPicker from './components/CityPicker'
import { TicketSniperIcon } from './components/Logo'
import './App.css'

type MainSection = 'kide' | 'tiketti' | 'coming-soon'
type KideSubTab = 'sniper' | 'scorer'
type TikettiSubTab = 'sniper' | 'events'

type Step = 0 | 1 | 2 | 3 | 4

type MonitorStatus = 'idle' | 'monitoring' | 'stopped'

type MonitoringConfig = {
  eventUrl: string
  authToken: string
  selectedVariantId: string
  delayMs: number
  keywordsText: string
  quantity: number
  startQuantity: number
  proxyUrl: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 80

const formatMs = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}m ${total % 60}s`
}

// ─── Token Guide Modal Component ───────────────────────────────────────────────

const TokenGuideContent = ({ onClose, t }: { onClose: () => void; t: (key: string) => string }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
  <div className="info-modal-overlay" onClick={onClose}>
    <div className="info-modal token-guide-modal" onClick={(e) => e.stopPropagation()}>
      <button className="info-close-btn" onClick={onClose}>✕</button>

      <h2>{t('tokenGuideTitle')}</h2>
      <p className="token-guide-intro">{t('tokenGuideIntro')}</p>

      <div className="token-guide-steps">
        <div className="token-guide-step">
          <div className="token-guide-step-number">1</div>
          <div>
            <h4>{t('tokenGuideStep1Title')}</h4>
            <p>{t('tokenGuideStep1Text')}</p>
          </div>
        </div>
        <div className="token-guide-step">
          <div className="token-guide-step-number">2</div>
          <div>
            <h4>{t('tokenGuideStep2Title')}</h4>
            <p>{t('tokenGuideStep2Text')}</p>
          </div>
        </div>
        <div className="token-guide-step">
          <div className="token-guide-step-number">3</div>
          <div>
            <h4>{t('tokenGuideStep3Title')}</h4>
            <p>{t('tokenGuideStep3Text')}</p>
          </div>
        </div>
        <div className="token-guide-step">
          <div className="token-guide-step-number">4</div>
          <div>
            <h4>{t('tokenGuideStep4Title')}</h4>
            <p>{t('tokenGuideStep4Text')}</p>
          </div>
        </div>
        <div className="token-guide-step">
          <div className="token-guide-step-number">5</div>
          <div>
            <h4>{t('tokenGuideStep5Title')}</h4>
            <p>{t('tokenGuideStep5Text')}</p>
          </div>
        </div>
        <div className="token-guide-step">
          <div className="token-guide-step-number">6</div>
          <div>
            <h4>{t('tokenGuideStep6Title')}</h4>
            <p>{t('tokenGuideStep6Text')}</p>
          </div>
        </div>
      </div>

      <p className="token-guide-note">{t('tokenGuideNote')}</p>

      <button type="button" className="btn-primary token-guide-close" onClick={onClose}>
        {t('tokenGuideClose')}
      </button>
    </div>
  </div>
  )
}

// ─── Info Modal Component ──────────────────────────────────────────────────────

const InfoModalContent = ({ onClose, t }: { onClose: () => void; t: (key: string) => string }) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
  <div className="info-modal-overlay" onClick={onClose}>
    <div className="info-modal" onClick={(e) => e.stopPropagation()}>
      <button className="info-close-btn" onClick={onClose}>✕</button>

      <h2>{t('technicalDetails')}</h2>

      <div className="info-section">
        <h3>{t('howItWorks')}</h3>
        <p>{t('howItWorksText')}</p>
      </div>
      <div className="info-section">
        <h3>{t('authentication')}</h3>
        <p>{t('authenticationText')}</p>
      </div>
      <div className="info-section">
        <h3>{t('pollingInterval')}</h3>
        <p>{t('pollingIntervalText')}</p>
      </div>
      <div className="info-section">
        <h3>{t('keywordFilter')}</h3>
        <p>{t('keywordFilterText')}</p>
      </div>
      <div className="info-section">
        <h3>{t('statusIndicators')}</h3>
        <ul className="info-list">
          <li><strong>{t('statusNotChecked')}</strong></li>
          <li><strong className="text-success">{t('statusValid')}</strong></li>
          <li><strong className="text-danger">{t('statusInvalid')}</strong></li>
        </ul>
      </div>
      <div className="info-section">
        <h3>{t('tips')}</h3>
        <ul className="info-list">
          <li>{t('tip1')}</li>
          <li>{t('tip2')}</li>
          <li>{t('tip3')}</li>
          <li>{t('tip4')}</li>
        </ul>
      </div>
    </div>
  </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────



// ─── Score Histogram Component ───────────────────────────────────────────────

type HistogramData = {
  buckets: { range: string; count: number; color: string }[]
  buyCount: number
  maybeCount: number
  skipCount: number
}

function buildHistogramData(events: Array<{ resell_score: number; decision: string; ai_score?: AiScore }>): HistogramData {
  // Create 10 buckets: 0-9, 10-19, ..., 90-100
  const ranges = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100']
  const counts = new Array(10).fill(0) as number[]
  let buyCount = 0, maybeCount = 0, skipCount = 0

  for (const ev of events) {
    const bucket = Math.min(Math.floor(ev.resell_score / 10), 9)
    counts[bucket]++
    const label = ev.ai_score?.label ?? ev.decision
    if (label === 'BUY') buyCount++
    else if (label === 'MAYBE') maybeCount++
    else skipCount++
  }

  return {
    buckets: ranges.map((range, i) => ({
      range,
      count: counts[i],
      color: i >= 8 ? 'var(--success)' : i >= 5 ? 'var(--warning)' : 'var(--danger)',
    })),
    buyCount,
    maybeCount,
    skipCount,
  }
}

const ScoreHistogram = ({ events, t }: { events: Array<{ resell_score: number; decision: string; ai_score?: AiScore }>; t: (k: string, p?: Record<string, string | number>) => string }) => {
  if (events.length === 0) return null
  const data = buildHistogramData(events)
  const maxCount = Math.max(...data.buckets.map(b => b.count), 1)

  return (
    <div className="histogram-container">
      <h3>{t('histogramTitle')}</h3>
      <div className="histogram-bar-chart">
        {data.buckets.map((b) => (
          <div
            key={b.range}
            className="histogram-bar"
            style={{
              height: `${(b.count / maxCount) * 100}%`,
              backgroundColor: b.color,
              minHeight: b.count > 0 ? '4px' : '0',
            }}
            data-tooltip={`${b.range}: ${b.count}`}
          />
        ))}
      </div>
      <div className="histogram-legend">
        <span className="histogram-legend-item">
          <span className="histogram-legend-dot" style={{ background: 'var(--success)' }} />
          {t('histogramBuy')} ({data.buyCount})
        </span>
        <span className="histogram-legend-item">
          <span className="histogram-legend-dot" style={{ background: 'var(--warning)' }} />
          {t('histogramMaybe')} ({data.maybeCount})
        </span>
        <span className="histogram-legend-item">
          <span className="histogram-legend-dot" style={{ background: 'var(--danger)' }} />
          {t('histogramSkip')} ({data.skipCount})
        </span>
      </div>
    </div>
  )
}

// ─── Score badge helper ──────────────────────────────────────────────────────

function decisionClass(d: 'BUY' | 'MAYBE' | 'SKIP'): string {
  if (d === 'BUY') return 'decision-buy'
  if (d === 'MAYBE') return 'decision-maybe'
  return 'decision-skip'
}

function scoreColor(score: number): string {
  if (score >= 75) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}

/** The effective label: AI if available, otherwise heuristic. */
function effectiveLabel(ev: { decision: string; ai_score?: AiScore }): 'BUY' | 'MAYBE' | 'SKIP' {
  return (ev.ai_score?.label ?? ev.decision) as 'BUY' | 'MAYBE' | 'SKIP'
}

/** Format a probability as percentage string. */
function pctStr(p: number): string {
  return `${Math.round(p * 100)}%`
}

/** AI confidence bar color. */
function aiConfidenceColor(prob: number): string {
  if (prob >= 0.7) return 'var(--success)'
  if (prob >= 0.4) return 'var(--warning)'
  return 'var(--danger)'
}

/** Small AI badge component. */
const AiBadge = ({ ai }: { ai?: AiScore }) => {
  if (!ai) return null
  return (
    <span className={`ai-badge ai-badge-${ai.label.toLowerCase()}`} title={`AI: ${pctStr(ai.buy_probability)} buy · v${ai.model_version}`}>
      AI {ai.label} ({pctStr(ai.buy_probability)})
    </span>
  )
}

/** Score category explanation text. */
function scoreExplanation(key: string, value: number, t: (k: string) => string): string {
  if (key === 'popularity') {
    if (value >= 80) return t('explainPopHigh')
    if (value >= 50) return t('explainPopMed')
    return t('explainPopLow')
  }
  if (key === 'demand') {
    if (value >= 80) return t('explainDemandHigh')
    if (value >= 50) return t('explainDemandMed')
    return t('explainDemandLow')
  }
  if (key === 'pricing') {
    if (value >= 70) return t('explainPriceHigh')
    if (value >= 40) return t('explainPriceMed')
    return t('explainPriceLow')
  }
  if (key === 'timing') {
    if (value >= 80) return t('explainTimingHigh')
    if (value >= 50) return t('explainTimingMed')
    return t('explainTimingLow')
  }
  if (key === 'organiser') {
    if (value >= 60) return t('explainOrgHigh')
    if (value >= 40) return t('explainOrgMed')
    return t('explainOrgLow')
  }
  return ''
}

/** Breakdown bar with explanation. */
const BreakdownBarExplained = ({ label, value, explainKey, t }: { label: string; value: number; explainKey: string; t: (k: string) => string }) => (
  <div className="breakdown-item">
    <div className="breakdown-label">
      <span>{label}</span>
      <span className="breakdown-value">{value}</span>
    </div>
    <div className="breakdown-track">
      <div
        className="breakdown-fill"
        style={{
          width: `${value}%`,
          backgroundColor: value >= 75 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)',
        }}
      />
    </div>
    <div className="breakdown-explain">{scoreExplanation(explainKey, value, t)}</div>
  </div>
)

/** Variant list in expanded event detail. */
const VariantList = ({ variants, t }: { variants: KideVariant[]; t: (k: string) => string }) => {
  if (variants.length === 0) return <p className="variants-empty">{t('noVariants')}</p>
  return (
    <div className="variant-list">
      {variants.map((v) => {
        const priceEur = (v.pricePerItem ?? v.price ?? 0) / 100
        return (
          <div key={v.inventoryId} className="variant-row">
            <span className="variant-name">{v.name}</span>
            <span className="variant-price">
              {priceEur > 0 ? `€${priceEur.toFixed(2)}` : t('freeLabel')}
            </span>
            <span className={`variant-avail ${v.availability > 0 ? 'variant-avail-ok' : 'variant-avail-none'}`}>
              {v.availability > 0 ? `${v.availability} ${t('availableLabel')}` : t('soldOutLabel')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function salesStatusBadge(status: SalesStatus | undefined, t: (k: string) => string): { label: string; className: string } | null {
  if (!status) return null
  switch (status) {
    case 'upcoming': return { label: t('statusUpcoming'), className: 'status-upcoming' }
    case 'on_sale': return { label: t('statusOnSale'), className: 'status-on-sale' }
    case 'selling_fast': return { label: t('statusSellingFast'), className: 'status-selling-fast' }
    case 'almost_sold_out': return { label: t('statusAlmostSoldOut'), className: 'status-almost-sold-out' }
    case 'paused': return { label: t('statusPaused'), className: 'status-paused' }
    default: return null
  }
}

function formatEventDate(dateStr?: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return null
  }
}

function App() {
  // ── State ───────────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<MainSection>('kide')
  const [kideTab, setKideTab] = useState<KideSubTab>('sniper')
  const [step, setStep] = useState<Step>(0)
  const [infoPanelOpen, setInfoPanelOpen] = useState(false)
  const [eventUrl, setEventUrl] = useState('')
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('kidehiiri-token') || '')
  const [quantity, setQuantity] = useState(1)
  const [proxyUrl, setProxyUrl] = useState('')
  const [delayMs, setDelayMs] = useState(1200)
  const [activeMonitoringDelayMs, setActiveMonitoringDelayMs] = useState(0)
  const [keywordsText, setKeywordsText] = useState('')
  const [includeAllKeywords, setIncludeAllKeywords] = useState(false)

  const [status, setStatus] = useState<MonitorStatus>('idle')
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'error'>('idle')
  const [tokenUser, setTokenUser] = useState('')
  const [tokenEmail, setTokenEmail] = useState('')
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null)
  const [logs, setLogs] = useState<string[]>(['Ready'])
  const [matchCount, setMatchCount] = useState(0)
  const [lastCheckedAt, setLastCheckedAt] = useState('Not checked yet')
  const [nextCheckInMs, setNextCheckInMs] = useState(delayMs)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successTicketName, setSuccessTicketName] = useState('')
  const [lastMonitoringConfig, setLastMonitoringConfig] = useState<MonitoringConfig | null>(null)

  const [eventName, setEventName] = useState('')
  const [eventImageUrl, setEventImageUrl] = useState('')
  const [eventVariants, setEventVariants] = useState<Array<{ inventoryId: string; name: string; price: number; availability: number }>>([])
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [fetchingEvent, setFetchingEvent] = useState(false)
  const [showTokenGuide, setShowTokenGuide] = useState(false)
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
  const [showQtyPicker, setShowQtyPicker] = useState(false)
  const qtyPickerRef = useRef<HTMLDivElement>(null)

  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('kidehiiri-language') as LanguageCode | null
    return saved || 'en'
  })

  // ── Scorer state ──────────────────────────────────────────────────────────
  const [scanCityInput, setScanCityInput] = useState('Helsinki')
  const [scorerLoading, setScorerLoading] = useState(false)
  const [scorerError, setScorerError] = useState('')
  const [scoredEvents, setScoredEvents] = useState<ScoredEvent[]>([])
  const [scorerTop10, setScorerTop10] = useState<TopEvent[]>([])
  const [scorerStats, setScorerStats] = useState<{ total: number; buy_count: number; maybe_count: number; skip_count: number; avg_score: number } | null>(null)
  const [scorerView, setScorerView] = useState<'top10' | 'all' | 'ai'>('top10')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [scanMeta, setScanMeta] = useState<{ scanned_count: number; filtered_count: number; filtered_out_sold_out: number; filtered_out_free: number; city: string } | null>(null)
  const [eventVariantCache, setEventVariantCache] = useState<Record<string, { variants: KideVariant[]; loading: boolean; error?: string }>>({})

  // ── Admin auth state ──────────────────────────────────────────────────────
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem('kidehiiri-admin-token') || '')
  const [adminUser, setAdminUser] = useState('')
  const [adminLoginLoading, setAdminLoginLoading] = useState(false)
  const [adminLoginError, setAdminLoginError] = useState('')
  const [adminUsernameInput, setAdminUsernameInput] = useState('')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')

  // ── Tiketti state ──────────────────────────────────────────────────────────
  const [tikettiEvents, setTikettiEvents] = useState<TikettiEvent[]>([])
  const [tikettiLoading, setTikettiLoading] = useState(false)
  const [tikettiError, setTikettiError] = useState('')
  const [tikettiScraping, setTikettiScraping] = useState(false)
  const [tikettiLastMessage, setTikettiLastMessage] = useState('')

  // ── Tiketti Sniper state ──────────────────────────────────────────────────
  const [tikettiTab, setTikettiTab] = useState<TikettiSubTab>('sniper')
  const [tikettiSniperUrl, setTikettiSniperUrl] = useState('')
  const [tikettiSniperEvent, setTikettiSniperEvent] = useState<TikettiEventDetail | null>(null)
  const [tikettiSniperFetching, setTikettiSniperFetching] = useState(false)
  const [tikettiSniperStatus, setTikettiSniperStatus] = useState<'idle' | 'monitoring' | 'stopped'>('idle')
  const [tikettiSniperLogs, setTikettiSniperLogs] = useState<string[]>(['Ready'])
  const [tikettiSniperDelayMs, setTikettiSniperDelayMs] = useState(2000)
  const [tikettiSniperError, setTikettiSniperError] = useState('')
  const [tikettiSniperSuccess, setTikettiSniperSuccess] = useState(false)
  const [tikettiSessionCookie, setTikettiSessionCookie] = useState('')
  const [tikettiSniperQty, setTikettiSniperQty] = useState(1)
  const tikettiSniperIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(language, key, params)

  // ── Derived values ────────────────────────────────────────────────────────
  const keywords = useMemo(
    () => keywordsText.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    [keywordsText],
  )

  const estimatedTotal = useMemo(() => {
    const selected = eventVariants.find((v) => v.inventoryId === selectedVariantId)
    return selected ? (selected.price * quantity) / 100 : 0
  }, [selectedVariantId, quantity, eventVariants])

  const canGoNext = useMemo(() => {
    if (step === 0) {
      try {
        new URL(eventUrl.trim())
        return !(eventVariants.length > 0 && !selectedVariantId)
      } catch {
        return false
      }
    }
    if (step === 1) return Number.isFinite(delayMs) && delayMs >= 200 && quantity > 0
    return true
  }, [delayMs, eventUrl, step, eventVariants, selectedVariantId, quantity])

  // ── Logging ─────────────────────────────────────────────────────────────────
  const appendLog = (entry: string) => {
    setLogs((prev) => [`${new Date().toLocaleTimeString()} · ${entry}`, ...prev].slice(0, MAX_LOG_ENTRIES))
  }

  // ── Refs for monitoring loop ────────────────────────────────────────────────
  const configRef = useRef({ keywords, includeAllKeywords, eventUrl, delayMs, selectedVariantId, authToken, quantity, proxyUrl })
  const appendLogRef = useRef(appendLog)

  useEffect(() => {
    configRef.current = { keywords, includeAllKeywords, eventUrl, delayMs, selectedVariantId, authToken, quantity, proxyUrl }
  })
  useEffect(() => {
    appendLogRef.current = appendLog
  })

  // ── Persist language & token ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('kidehiiri-language', language)
    setLogs([t('ready')])
  }, [language])

  useEffect(() => {
    localStorage.setItem('kidehiiri-token', authToken)
  }, [authToken])

  // ── Close qty picker on outside click / Escape ─────────────────────────
  useEffect(() => {
    if (!showQtyPicker) return
    const handleClick = (e: MouseEvent) => {
      if (qtyPickerRef.current && !qtyPickerRef.current.contains(e.target as Node)) {
        setShowQtyPicker(false)
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowQtyPicker(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [showQtyPicker])

  // ── Init: fetch properties + auto-validate token ──────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const props = await fetchExtraProperties()
        if (props?.hash) {
          appendLogRef.current(`Backend properties ready: ${props.headerKey}`)
        } else {
          appendLogRef.current('Using cached backend properties')
        }
      } catch {
        appendLogRef.current('Could not reach backend for properties')
      }

      // Auto-validate saved token
      const saved = localStorage.getItem('kidehiiri-token')
      if (saved?.trim() && tokenStatus === 'idle') {
        setTokenStatus('validating')
        appendLogRef.current('Auto-validating remembered token...')
        try {
          const result = await validateToken(saved)
          if (result.valid && result.user) {
            setTokenStatus('valid')
            setTokenUser(`${result.user.firstName || ''} ${result.user.lastName || ''}`.trim())
            setTokenEmail(result.user.email || '')
            if (result.info?.expiresAt) setTokenExpiresAt(new Date(result.info.expiresAt))
            appendLogRef.current('Token auto-validated')
          } else {
            setTokenStatus('invalid')
            appendLogRef.current('Remembered token is invalid')
          }
        } catch (error) {
          setTokenStatus('error')
          appendLogRef.current(`Error validating token: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
    init()
  }, [])

  // ── Auto-fetch event details ──────────────────────────────────────────────
  useEffect(() => {
    if (step !== 0 || !eventUrl.trim()) return

    const fetchDetails = async () => {
      setFetchingEvent(true)
      try {
        const data = await fetchEventProducts(eventUrl)
        setEventName(data.product.name)
        const mf = data.product.mediaFilename
        setEventImageUrl(mf ? `https://portalvhdsp62n0yt356llm.blob.core.windows.net/bailataan-mediaitems/${mf}` : '')
        const variants = data.variants.map((v) => ({
          inventoryId: v.inventoryId,
          name: v.name,
          price: v.pricePerItem ?? v.price ?? 0,
          availability: v.availability,
        }))
        setEventVariants(variants)
        if (variants.length > 0 && !selectedVariantId) {
          setSelectedVariantId(variants[0].inventoryId)
        }
      } catch {
        setEventName('')
        setEventImageUrl('')
        setEventVariants([])
        setSelectedVariantId('')
      } finally {
        setFetchingEvent(false)
      }
    }

    const timer = setTimeout(fetchDetails, 500)
    return () => clearTimeout(timer)
  }, [eventUrl, step, selectedVariantId])

  // ── Monitoring loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'monitoring' || activeMonitoringDelayMs <= 0) return

    const countdownTimer = window.setInterval(() => {
      setNextCheckInMs((prev) => (prev <= 1000 ? activeMonitoringDelayMs : prev - 1000))
    }, 1000)

    const checkTimer = window.setInterval(async () => {
      const { eventUrl: url, selectedVariantId: variantId, authToken: token, quantity: targetQty } = configRef.current
      const log = appendLogRef.current

      if (!url?.trim()) { log('Error: event URL is empty'); return }
      if (!extractEventId(url)) { log('Error: could not parse event ID from URL'); return }
      if (!token?.trim()) { log('Error: authorization token is empty or missing'); return }
      if (!variantId) { log('Error: no ticket variant selected'); return }

      try {
        const { product, variants } = await fetchEventProducts(url)
        const available = variants.filter((v) => v.availability > 0)

        setLastCheckedAt(new Date().toLocaleTimeString())
        setNextCheckInMs(activeMonitoringDelayMs)

        const selectedVariant = available.find((v) => v.inventoryId === variantId)

        if (selectedVariant) {
          log(`Found selected ticket: ${selectedVariant.name}! (availability: ${selectedVariant.availability})`)
          setMatchCount((c) => c + 1)

          const quantityToBuy = Math.min(targetQty, selectedVariant.availability)
          log(`Attempting to add ${quantityToBuy} ticket(s) to cart...`)

          try {
            const result = await addToCart(token, variantId, quantityToBuy)
            log(result.message)

            if (result.success) {
              log(`Success! Added ${quantityToBuy} ticket(s) to cart`)
              setShowSuccessMessage(true)
              setSuccessTicketName(selectedVariant.name)
              setStatus('stopped')
              setLastMonitoringConfig({
                eventUrl: url, authToken: token, selectedVariantId: variantId,
                delayMs: activeMonitoringDelayMs, keywordsText, quantity: targetQty,
                startQuantity: quantity, proxyUrl: configRef.current.proxyUrl,
              })
              return
            } else if (result.retryWithQuantity && result.retryWithQuantity > 0) {
              configRef.current.quantity = result.retryWithQuantity
              setQuantity(result.retryWithQuantity)
              log(`Will retry next poll with quantity ${result.retryWithQuantity}...`)
            } else {
              log(`Failed: ${result.message}`)
              log('Retrying next poll...')
            }
          } catch (addErr) {
            log(`Error adding to cart: ${addErr instanceof Error ? addErr.message : String(addErr)}`)
            log('Retrying next poll...')
          }
        } else {
          log(`Waiting for ${product.name}... (${available.length}/${variants.length} available)`)
        }
      } catch (err) {
        log(`Check error: ${err instanceof Error ? err.message : String(err)}`)
      }
    }, activeMonitoringDelayMs)

    return () => {
      window.clearInterval(countdownTimer)
      window.clearInterval(checkTimer)
    }
  }, [status, activeMonitoringDelayMs])

  // ── Navigation ────────────────────────────────────────────────────────────
  const moveBack = () => {
    if (step === 0) return
    if (step === 4 && status === 'monitoring') {
      setStatus('stopped')
      setActiveMonitoringDelayMs(0)
      appendLog(t('monitoringStoppedLeft'))
    }
    setShowSuccessMessage(false)
    setStep((prev) => (prev - 1) as Step)
  }

  const moveNext = () => {
    if (!canGoNext || step === 4) return
    setStep((prev) => (prev + 1) as Step)
  }

  const startMonitoring = () => {
    setShowSuccessMessage(false)
    setMatchCount(0)
    setNextCheckInMs(delayMs)
    setActiveMonitoringDelayMs(delayMs)
    setStatus('monitoring')
    appendLog(t('monitoringStarted', { quantity }))
  }

  const resumeMonitoring = () => {
    if (!lastMonitoringConfig) return
    const originalQty = lastMonitoringConfig.startQuantity
    setEventUrl(lastMonitoringConfig.eventUrl)
    setAuthToken(lastMonitoringConfig.authToken)
    setSelectedVariantId(lastMonitoringConfig.selectedVariantId)
    setDelayMs(lastMonitoringConfig.delayMs)
    setQuantity(originalQty)
    setProxyUrl(lastMonitoringConfig.proxyUrl)
    setShowSuccessMessage(false)
    setStep(4)
    setTimeout(() => {
      configRef.current.quantity = originalQty
      setMatchCount(0)
      setNextCheckInMs(lastMonitoringConfig.delayMs)
      setActiveMonitoringDelayMs(lastMonitoringConfig.delayMs)
      setStatus('monitoring')
      appendLog(t('monitoringStarted', { quantity: originalQty }))
    }, 100)
  }

  const stopMonitoring = () => {
    setStatus('stopped')
    setActiveMonitoringDelayMs(0)
    appendLog(t('monitoringStopped'))
  }

  const handleValidateToken = async () => {
    const trimmed = authToken.trim()
    if (!trimmed) {
      setTokenStatus('invalid')
      setTokenUser('')
      setTokenEmail('')
      setTokenExpiresAt(null)
      appendLog(t('tokenValidationEmpty'))
      return
    }

    try {
      setTokenStatus('validating')
      const result = await validateToken(trimmed)
      if (!result.valid) {
        setTokenStatus('invalid')
        setTokenUser('')
        setTokenEmail(result.info?.email || '')
        setTokenExpiresAt(result.info?.expiresAt ? new Date(result.info.expiresAt) : null)
        appendLog(t('tokenValidationInvalid'))
        return
      }
      setTokenStatus('valid')
      const userName = [result.user?.firstName, result.user?.lastName].filter(Boolean).join(' ').trim()
      setTokenUser(userName || result.user?.email || result.user?.id || 'Authenticated user')
      setTokenEmail(result.info?.email || '')
      setTokenExpiresAt(result.info?.expiresAt ? new Date(result.info.expiresAt) : null)
      appendLog(t('tokenValidationSuccess'))
    } catch (error) {
      setTokenStatus('error')
      setTokenUser('')
      setTokenEmail('')
      setTokenExpiresAt(null)
      appendLog(t('tokenValidationError', { error: error instanceof Error ? error.message : String(error) }))
    }
  }

  const resetToken = () => {
    setAuthToken('')
    setTokenStatus('idle')
    setTokenUser('')
    setTokenEmail('')
    setTokenExpiresAt(null)
  }

  // ── Scorer handlers ───────────────────────────────────────────────────────
  const handleScanCity = async (city: string) => {
    setScanCityInput(city)
    setScorerError('')
    setScorerLoading(true)
    setScanMeta(null)

    try {
      const result = await scanCity(city.trim())
      setScoredEvents(result.events)
      setScorerTop10(result.top_10)
      setScorerStats(result.stats)
      setScanMeta({
        scanned_count: result.scanned_count,
        filtered_count: result.filtered_count,
        filtered_out_sold_out: result.filtered_out_sold_out ?? 0,
        filtered_out_free: result.filtered_out_free ?? 0,
        city: result.city,
      })
      setScorerView('top10')
      setExpandedEventId(null)
    } catch (err) {
      setScorerError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScorerLoading(false)
    }
  }

  const handleSnipeEvent = (eventId: string) => {
    const url = `https://kide.app/events/${eventId}`
    setEventUrl(url)
    setActiveSection('kide')
    setKideTab('sniper')
    setStep(0)
  }

  /** Toggle expand + fetch variant data on first expand. */
  const handleToggleExpand = useCallback((eventId: string) => {
    setExpandedEventId((prev) => {
      const opening = prev !== eventId
      if (opening && !eventVariantCache[eventId]) {
        // Mark loading
        setEventVariantCache((c) => ({ ...c, [eventId]: { variants: [], loading: true } }))
        fetchEventDetail(eventId)
          .then((data) => {
            setEventVariantCache((c) => ({ ...c, [eventId]: { variants: data.variants, loading: false } }))
          })
          .catch((err) => {
            setEventVariantCache((c) => ({
              ...c,
              [eventId]: { variants: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load' },
            }))
          })
      }
      return opening ? eventId : null
    })
  }, [eventVariantCache])

  // ── Admin auth handlers ───────────────────────────────────────────────────

  // Verify existing admin token on mount
  useEffect(() => {
    if (!adminToken) return
    adminVerify(adminToken)
      .then((res) => {
        if (res.valid && res.user) {
          setAdminUser(res.user)
        } else {
          // Token expired — clear it
          setAdminToken('')
          setAdminUser('')
          localStorage.removeItem('kidehiiri-admin-token')
        }
      })
      .catch(() => {
        setAdminToken('')
        setAdminUser('')
        localStorage.removeItem('kidehiiri-admin-token')
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdminLogin = async () => {
    setAdminLoginError('')
    setAdminLoginLoading(true)
    try {
      const res = await adminLogin(adminUsernameInput.trim(), adminPasswordInput)
      setAdminToken(res.token)
      localStorage.setItem('kidehiiri-admin-token', res.token)
      setAdminUser(adminUsernameInput.trim())
      setAdminUsernameInput('')
      setAdminPasswordInput('')
    } catch (err) {
      setAdminLoginError(err instanceof Error ? err.message : t('adminLoginError'))
    } finally {
      setAdminLoginLoading(false)
    }
  }

  const handleAdminLogout = () => {
    setAdminToken('')
    setAdminUser('')
    localStorage.removeItem('kidehiiri-admin-token')
    setTikettiEvents([])
    setTikettiError('')
    setTikettiLastMessage('')
  }

  // ── Tiketti handlers ──────────────────────────────────────────────────────

  // Auto-fetch tiketti events when authenticated and on tiketti tab
  useEffect(() => {
    if (activeSection !== 'tiketti' || !adminToken) return
    setTikettiLoading(true)
    setTikettiError('')
    fetchTikettiEvents(adminToken)
      .then((res) => {
        setTikettiEvents(res.events)
        setTikettiLastMessage('')
      })
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          handleAdminLogout()
          setTikettiError(t('adminLoginError'))
        } else {
          setTikettiError(err instanceof Error ? err.message : 'Failed to fetch events')
        }
      })
      .finally(() => setTikettiLoading(false))
  }, [activeSection, adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTikettiScrape = async () => {
    if (!adminToken) return
    setTikettiScraping(true)
    setTikettiLastMessage('')
    try {
      const res = await triggerTikettiScrape(adminToken)
      setTikettiLastMessage(t('tikettiScrapeDone', { count: res.scraped }))
      // Refresh the list
      const updated = await fetchTikettiEvents(adminToken)
      setTikettiEvents(updated.events)
    } catch (err) {
      setTikettiError(err instanceof Error ? err.message : 'Scrape failed')
    } finally {
      setTikettiScraping(false)
    }
  }

  // ── Tiketti Sniper handlers ───────────────────────────────────────────────

  const addTikettiLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTikettiSniperLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, MAX_LOG_ENTRIES))
  }, [])

  const handleFetchTikettiEvent = useCallback(async () => {
    const url = tikettiSniperUrl.trim()
    if (!url) return

    setTikettiSniperFetching(true)
    setTikettiSniperError('')
    setTikettiSniperEvent(null)
    addTikettiLog(`Fetching event: ${url}`)

    try {
      const res = await fetchTikettiEvent(url)
      if (res.success && res.event) {
        setTikettiSniperEvent(res.event)
        const free = res.event.ticketsFree ?? 0
        const total = res.event.ticketsTotal ?? 0
        addTikettiLog(`Found: ${res.event.title} — ${free}/${total} tickets free`)
      } else {
        setTikettiSniperError(res.error || 'Failed to fetch event')
        addTikettiLog(`Error: ${res.error || 'Unknown error'}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setTikettiSniperError(msg)
      addTikettiLog(`Error: ${msg}`)
    } finally {
      setTikettiSniperFetching(false)
    }
  }, [tikettiSniperUrl, addTikettiLog])

  const handleTikettiSniperStart = useCallback(() => {
    if (!tikettiSniperEvent) return

    setTikettiSniperStatus('monitoring')
    setTikettiSniperSuccess(false)
    addTikettiLog('Monitoring started — watching for tickets...')
    addTikettiLog(`Polling every ${tikettiSniperDelayMs}ms...`)

    const doCheck = async () => {
      try {
        addTikettiLog('Checking availability...')
        const res = await fetchTikettiEvent(tikettiSniperUrl)

        if (!res.success || !res.event) {
          addTikettiLog(`Fetch failed: ${res.error || 'Unknown error'}`)
          return
        }

        // Update event info in UI
        setTikettiSniperEvent(res.event)

        const ticketsFree = res.event.ticketsFree ?? 0
        const soldOut = res.event.soldOut ?? false

        if (soldOut || ticketsFree === 0) {
          addTikettiLog(`Not available yet — ${ticketsFree} tickets free, soldOut=${soldOut}`)
          return
        }

        // Tickets are available!
        addTikettiLog(`🎉 TICKETS AVAILABLE! ${ticketsFree} free`)

        // Try to add to cart if session cookie is provided
        if (tikettiSessionCookie.trim()) {
          addTikettiLog(`Attempting to add ${tikettiSniperQty} ticket(s) to cart...`)
          try {
            const cartRes = await addToTikettiCart(tikettiSniperUrl, tikettiSniperQty, tikettiSessionCookie)
            if (cartRes.success) {
              addTikettiLog(`✅ ${cartRes.message}`)
            } else {
              addTikettiLog(`⚠️ Cart failed: ${cartRes.message} — go to tiketti.fi manually!`)
            }
          } catch (cartErr) {
            addTikettiLog(`⚠️ Cart error: ${cartErr instanceof Error ? cartErr.message : 'Unknown'} — go to tiketti.fi manually!`)
          }
        } else {
          addTikettiLog('No cookies provided — go to tiketti.fi now to buy!')
        }

        setTikettiSniperSuccess(true)
        setTikettiSniperStatus('stopped')
        if (tikettiSniperIntervalRef.current) clearInterval(tikettiSniperIntervalRef.current)

        // Try to play an alert sound
        try {
          const ctx = new AudioContext()
          for (const freq of [523.25, 659.25, 783.99]) {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = freq
            gain.gain.value = 0.3
            osc.start(ctx.currentTime + (freq - 523) / 500)
            osc.stop(ctx.currentTime + (freq - 523) / 500 + 0.2)
          }
        } catch { /* audio not available */ }
      } catch (err) {
        addTikettiLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`)
      }
    }

    // Immediate first check
    doCheck()

    // Set up polling
    tikettiSniperIntervalRef.current = setInterval(doCheck, tikettiSniperDelayMs)
  }, [tikettiSniperEvent, tikettiSniperUrl, tikettiSniperDelayMs, tikettiSessionCookie, tikettiSniperQty, addTikettiLog])

  const handleTikettiSniperStop = useCallback(() => {
    if (tikettiSniperIntervalRef.current) {
      clearInterval(tikettiSniperIntervalRef.current)
      tikettiSniperIntervalRef.current = null
    }
    setTikettiSniperStatus('stopped')
    addTikettiLog('Monitoring stopped')
  }, [addTikettiLog])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tikettiSniperIntervalRef.current) clearInterval(tikettiSniperIntervalRef.current)
    }
  }, [])

  const steps = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {infoPanelOpen && <InfoModalContent onClose={() => setInfoPanelOpen(false)} t={t} />}
      {showTokenGuide && <TokenGuideContent onClose={() => setShowTokenGuide(false)} t={t} />}

      <main className="app-shell">
        <header className="app-header">
          <div className="header-left">
            <TicketSniperIcon size={40} />
            <div>
              <h1>{t('appTitle')}</h1>
              <p>{t('appSubtitle')}</p>
            </div>
          </div>
          <div className="header-right">
            <div className="language-toggle">
              <button className={`lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>EN</button>
              <span className="lang-sep">|</span>
              <button className={`lang-btn ${language === 'fi' ? 'active' : ''}`} onClick={() => setLanguage('fi')}>FI</button>
            </div>
            <button className="info-button" onClick={() => setInfoPanelOpen(true)} title={t('technicalDetails')}>
              i
            </button>
          </div>
        </header>

        {/* ── Main navigation ── */}
        <div className="nav-bar">
          <button
            className={`nav-btn ${activeSection === 'kide' ? 'nav-active' : ''}`}
            onClick={() => setActiveSection('kide')}
          >
            {t('navKide')}
          </button>
          <button
            className={`nav-btn ${activeSection === 'tiketti' ? 'nav-active' : ''}`}
            onClick={() => setActiveSection('tiketti')}
          >
            {t('navTiketti')}
          </button>
          <button
            className={`nav-btn ${activeSection === 'coming-soon' ? 'nav-active' : ''}`}
            onClick={() => setActiveSection('coming-soon')}
          >
            {t('navComingSoon')}
          </button>
        </div>

        {/* ── Kide sub-tabs ── */}
        {activeSection === 'kide' && (
          <div className="tab-bar">
            <button
              className={`tab-btn ${kideTab === 'sniper' ? 'tab-active' : ''}`}
              onClick={() => setKideTab('sniper')}
            >
              {t('sniperTab')}
            </button>
            <button
              className={`tab-btn ${kideTab === 'scorer' ? 'tab-active' : ''}`}
              onClick={() => setKideTab('scorer')}
            >
              {t('scorerTab')}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SNIPER TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'kide' && kideTab === 'sniper' && (
          <div className="section-fade-in">
            <ol className="stepper" aria-label="Setup steps">
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={[
                    'step',
                    step === index ? 'step-active' : '',
                    step > index ? 'step-complete' : '',
                  ].join(' ')}
                  onClick={() => {
                    if (index < step) {
                      if (step === 4 && status === 'monitoring') {
                        setStatus('stopped')
                        setActiveMonitoringDelayMs(0)
                        appendLog(t('monitoringStoppedLeft'))
                      }
                      setShowSuccessMessage(false)
                      setStep(index as Step)
                    }
                  }}
                  role={index < step ? 'button' : undefined}
                  tabIndex={index < step ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (index < step && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      setStep(index as Step)
                    }
                  }}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>

        <section className="panel">
          <div key={step} className="step-content-fade">
          {/* ── Step 0: Event Configuration ── */}
          {step === 0 && (
            <>
              <h2>{t('chooseEventSource')}</h2>

              <label>
                {t('eventUrl')}
                <input
                  type="url"
                  placeholder={t('eventUrlPlaceholder')}
                  value={eventUrl}
                  onChange={(e) => setEventUrl(e.target.value)}
                />
              </label>

              {fetchingEvent && !eventName && <p className="loading-text">{t('loadingEvent')}</p>}

              {eventName && (
                <div className={`event-card ${fetchingEvent ? 'event-card-loading' : ''}`}>
                  {eventImageUrl && (
                    <div className="event-card-img">
                      <img src={eventImageUrl} alt={eventName} loading="lazy" />
                    </div>
                  )}
                  <div className="event-card-info">
                    <p className="event-card-label">{t('eventLabel')}</p>
                    <p className="event-card-name">{eventName}</p>
                    {eventVariants.length > 0 && (
                      <label className="variant-select-label">
                        <span>{t('selectTicketType')}</span>
                        <select
                          value={selectedVariantId}
                          onChange={(e) => setSelectedVariantId(e.target.value)}
                          className="variant-select"
                        >
                          {eventVariants.map((v) => (
                            <option key={v.inventoryId} value={v.inventoryId} disabled={v.availability === 0}>
                              {v.name} — €{(v.price / 100).toFixed(2)}{v.availability === 0 ? ` ${t('soldOutSuffix')}` : ` ${t('leftSuffix', { n: v.availability })}`}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {/* Token: show validated state or input */}
              {tokenStatus === 'valid' ? (
                <div className="token-valid-card">
                  <div className="token-valid-content">
                    <div className="token-valid-info">
                      <p className="text-success"><strong>{t('tokenValid')}</strong></p>
                      {tokenUser && <p className="token-user">{tokenUser}</p>}
                      {tokenEmail && <p className="token-email">{tokenEmail}</p>}
                      {tokenExpiresAt && (
                        <p className={`token-expires ${tokenExpiresAt < new Date() ? 'expired' : ''}`}>
                          {t('expiresLabel')} {tokenExpiresAt.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={resetToken} className="btn-change-token">
                      {t('changeToken')}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label>
                    {t('authToken')}{' '}
                    <span className="label-hint">{t('authTokenOptional')}</span>
                    <input
                      type="password"
                      placeholder={t('authTokenPlaceholder')}
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                    />
                    <div className="token-warning-text">{t('tokenWarning')}</div>
                  </label>
                  <button type="button" className="token-guide-link" onClick={() => setShowTokenGuide(true)}>
                    {t('tokenHowToGet')}
                  </button>
                  <div className="button-row">
                    <button type="button" onClick={handleValidateToken} disabled={tokenStatus === 'validating'} className="btn-primary">
                      {tokenStatus === 'validating' ? t('validating') : t('validateToken')}
                    </button>
                  </div>
                  {tokenStatus !== 'idle' && (
                    <div className="token-status-row">
                      <p>
                        {t('tokenStatus')}{' '}
                        <span className={tokenStatus === 'invalid' ? 'text-danger' : 'text-gray'}>
                          {tokenStatus === 'invalid' && t('tokenInvalid')}
                          {tokenStatus === 'error' && t('tokenError')}
                          {tokenStatus === 'validating' && t('validating')}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ marginBottom: '0.25rem' }}>{t('quantity')}</label>
                <div className="qty-picker-wrapper" ref={qtyPickerRef}>
                  <button
                    type="button"
                    className={`qty-picker-trigger ${showQtyPicker ? 'open' : ''}`}
                    onClick={() => setShowQtyPicker(!showQtyPicker)}
                  >
                    <span>{quantity} {quantity === 1 ? t('ticketSingular') : t('ticketPlural')}</span>
                    <span className="arrow">▼</span>
                  </button>
                  {showQtyPicker && (
                    <div className="qty-picker-dropdown">
                      {[1, 2, 3, 4, 5, 6, 8, 10, 15, 20].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={quantity === n ? 'selected' : ''}
                          onClick={() => { setQuantity(n); setShowQtyPicker(false) }}
                        >
                          {n} {n === 1 ? t('ticketSingular') : t('ticketPlural')}
                        </button>
                      ))}
                      <div className="qty-custom-row">
                        <input
                          type="number"
                          min={1}
                          max={50}
                          placeholder="Custom..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = Math.max(1, Math.min(50, parseInt((e.target as HTMLInputElement).value) || 1))
                              setQuantity(val)
                              setShowQtyPicker(false)
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible advanced options */}
              <button
                type="button"
                className="advanced-toggle"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                <span className={`toggle-arrow ${showAdvancedOptions ? 'open' : ''}`}>▶</span>
                {t('advancedOptions')}
              </button>

              {showAdvancedOptions && (
                <div className="advanced-content">
                  <label>
                    {t('proxyUrl')} <span className="label-hint">{t('proxyUrlOptional')}</span>
                    <input type="text" placeholder={t('proxyUrlPlaceholder')} value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} />
                    <div className="hint-text">{t('proxyUrlHint')}</div>
                  </label>
                </div>
              )}
            </>
          )}

          {/* ── Step 1: Delay ── */}
          {step === 1 && (
            <>
              <h2>{t('setRefreshDelay')}</h2>
              <label>
                {t('pollInterval')}
                <input type="number" min={200} step={100} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} />
              </label>
            </>
          )}

          {/* ── Step 2: Keywords ── */}
          {step === 2 && (
            <>
              <h2>{t('filterByKeywords')}</h2>
              <label>
                {t('keywordsInput')}
                <input type="text" placeholder={t('keywordsPlaceholder')} value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} />
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={includeAllKeywords} onChange={(e) => setIncludeAllKeywords(e.target.checked)} />
                {t('requireAllKeywords')}
              </label>
            </>
          )}

          {/* ── Step 3: Summary ── */}
          {step === 3 && (
            <>
              <h2>{t('summary')}</h2>
              <div className="summary-grid">
                <div><strong>{t('eventUrlLabel')}</strong><p>{eventUrl}</p></div>
                <div><strong>{t('authTokenLabel')}</strong><p>{authToken ? maskToken(authToken) : t('notSetLabel')}</p></div>
                <div><strong>{t('quantityLabel')}</strong><p>{quantity} {quantity === 1 ? t('ticketSingular') : t('ticketPlural')}</p></div>
                <div><strong>{t('estimatedTotalLabel')}</strong><p>€{estimatedTotal.toFixed(2)}</p></div>
                <div><strong>{t('delayLabel')}</strong><p>{delayMs} ms</p></div>
                <div><strong>{t('keywordsLabel')}</strong><p>{keywords.length ? keywords.join(', ') : t('noKeywordFilter')}</p></div>
                <div><strong>{t('matchModeLabel')}</strong><p>{includeAllKeywords ? t('matchModeAll') : t('matchModeAny')}</p></div>
                <div><strong>{t('proxyLabel')}</strong><p>{proxyUrl || t('directConnection')}</p></div>
              </div>
            </>
          )}

          {/* ── Step 4: Monitor ── */}
          {step === 4 && (
            <>
              <h2>{t('monitor')}</h2>

              {showSuccessMessage && (
                <div className="success-banner">
                  <p className="success-title">{t('successMessage', { quantity })}</p>
                  <p className="success-ticket">{successTicketName}</p>
                  <div className="success-actions">
                    <a href="https://kide.app/checkout" target="_blank" rel="noopener noreferrer" className="btn-success-action">
                      {t('viewCart')}
                    </a>
                    {lastMonitoringConfig && (
                      <button type="button" onClick={resumeMonitoring} className="btn-success-action">
                        {t('buyMore', { quantity: lastMonitoringConfig.startQuantity ?? quantity })}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="summary-grid">
                <div><strong>{t('statusLabel')}</strong><p><span className={`monitor-status monitor-status-${status}`}>{status === 'idle' ? t('statusIdle') : status === 'monitoring' ? t('statusMonitoring') : t('statusStopped')}</span></p></div>
                <div><strong>{t('matchesFoundLabel')}</strong><p>{matchCount}</p></div>
                <div><strong>{t('lastCheckedLabel')}</strong><p>{lastCheckedAt}</p></div>
                <div><strong>{t('nextCheckInLabel')}</strong><p>{formatMs(nextCheckInMs)}</p></div>
              </div>

              <div className="button-row">
                {status !== 'monitoring' ? (
                  <button type="button" onClick={startMonitoring} className="btn-primary">
                    {showSuccessMessage ? t('monitorAnother') : t('startMonitoring')}
                  </button>
                ) : (
                  <button type="button" onClick={stopMonitoring} className="danger">
                    {t('stopMonitoring')}
                  </button>
                )}
              </div>

              <div className="logs" role="log" aria-live="polite">
                {logs.map((entry, index) => (
                  <p key={`${entry}-${index}`}>{entry}</p>
                ))}
              </div>
            </>
          )}
          </div>
        </section>

        <footer className="button-row footer-nav">
          <button type="button" onClick={moveBack} disabled={step === 0} className="btn-secondary">
            {t('back')}
          </button>
          <button type="button" onClick={moveNext} disabled={!canGoNext || step === 4} className="btn-primary">
            {step === 3 ? t('reviewMonitor') : t('next')}
          </button>
        </footer>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AI SCORER TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'kide' && kideTab === 'scorer' && (
          <section className="scorer-panel">
            <h2>{t('scorerTitle')}</h2>
            <p className="scorer-subtitle">{t('scorerSubtitle')}</p>

            {/* City picker — Finland only, auto-scans on selection */}
            <div className="scorer-input-area">
              <label>{t('scorerCityLabel')}</label>
              <CityPicker
                value={scanCityInput}
                onChange={handleScanCity}
                placeholder={t('scorerCustomCityPlaceholder')}
                disabled={scorerLoading}
              />

              {scorerLoading && <p className="scorer-scanning">{t('scorerScanning')}</p>}
              {scorerError && <p className="scorer-error">{scorerError}</p>}
            </div>

            {/* Scan meta info */}
            {scanMeta && (
              <div className="scan-meta">
                {t('scorerScanMeta', {
                  filtered: scanMeta.filtered_count,
                  total: scanMeta.scanned_count,
                  city: scanMeta.city,
                })}
                {scanMeta.filtered_out_sold_out > 0 && (
                  <span className="scan-meta-sold-out">
                    {' · '}{scanMeta.filtered_out_sold_out} {t('soldOutFiltered')}
                  </span>
                )}
                {scanMeta.filtered_out_free > 0 && (
                  <span className="scan-meta-free">
                    {' · '}{scanMeta.filtered_out_free} {t('freeEventsFiltered')}
                  </span>
                )}
              </div>
            )}

            {/* Stats banner */}
            {scorerStats && (
              <div className="scorer-stats">
                <h3>{t('scorerStats')}</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <span className="stat-value">{scorerStats.total}</span>
                    <span className="stat-label">{t('scorerTotalEvents')}</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{scorerStats.avg_score}</span>
                    <span className="stat-label">{t('scorerAvgScore')}</span>
                  </div>
                  <div className="stat-card stat-buy">
                    <span className="stat-value">{scorerStats.buy_count}</span>
                    <span className="stat-label">{t('scorerBuyCount')}</span>
                  </div>
                  <div className="stat-card stat-maybe">
                    <span className="stat-value">{scorerStats.maybe_count}</span>
                    <span className="stat-label">{t('scorerMaybeCount')}</span>
                  </div>
                  <div className="stat-card stat-skip">
                    <span className="stat-value">{scorerStats.skip_count}</span>
                    <span className="stat-label">{t('scorerSkipCount')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Score distribution histogram */}
            {scoredEvents.length > 0 && (
              <ScoreHistogram events={scoredEvents} t={t} />
            )}

            {/* Results toggle */}
            {scoredEvents.length > 0 && (
              <>
                <div className="scorer-view-toggle">
                  <button
                    className={`tab-btn ${scorerView === 'top10' ? 'tab-active' : ''}`}
                    onClick={() => setScorerView('top10')}
                  >
                    {t('scorerTop10')}
                  </button>
                  <button
                    className={`tab-btn ${scorerView === 'ai' ? 'tab-active' : ''}`}
                    onClick={() => setScorerView('ai')}
                  >
                    {t('scorerAiView')}
                  </button>
                  <button
                    className={`tab-btn ${scorerView === 'all' ? 'tab-active' : ''}`}
                    onClick={() => setScorerView('all')}
                  >
                    {t('scorerAllEvents')}
                  </button>
                </div>

                {/* Top 10 view */}
                {scorerView === 'top10' && (
                  <div className="scorer-results">
                    {scorerTop10.map((ev) => {
                      const statusBadge = salesStatusBadge(ev.sales_status, t)
                      const eventDate = formatEventDate(ev.start_time)
                      const isExpanded = expandedEventId === ev.event_id
                      const variantData = eventVariantCache[ev.event_id]
                      // Find the full scored event for breakdown data
                      const fullEvent = scoredEvents.find((e) => e.event_id === ev.event_id)
                      return (
                        <div key={ev.event_id} className={`scorer-card ${decisionClass(effectiveLabel(ev))}`}>
                          <div
                            className="scorer-card-header scorer-card-clickable"
                            onClick={() => handleToggleExpand(ev.event_id)}
                          >
                            <span className="scorer-rank">#{ev.rank}</span>
                            <div className="scorer-card-info">
                              <span className="scorer-event-name">{ev.name}</span>
                              <div className="scorer-event-meta">
                                {ev.organiser && <span className="scorer-organiser">{ev.organiser}</span>}
                                {statusBadge && <span className={`scorer-status-badge ${statusBadge.className}`}>{statusBadge.label}</span>}
                                {ev.likes_total != null && ev.likes_total > 0 && <span className="scorer-likes">{ev.likes_total}</span>}
                                {ev.base_price_eur != null && ev.base_price_eur > 0 && <span className="scorer-price">€{ev.base_price_eur}</span>}
                                {eventDate && <span className="scorer-date">{eventDate}</span>}
                              </div>
                              <span className="scorer-reason">{ev.reason}</span>
                            </div>
                            <div className="scorer-card-score">
                              <span className="scorer-score-value" style={{ color: scoreColor(ev.resell_score) }}>
                                {ev.resell_score}
                              </span>
                              <AiBadge ai={ev.ai_score} />
                              <span className={`scorer-decision-badge ${decisionClass(effectiveLabel(ev))}`}>
                                {effectiveLabel(ev)}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="scorer-breakdown">
                              {/* Event details */}
                              {fullEvent && (
                                <div className="event-detail-grid">
                                  {fullEvent.base_price_eur != null && fullEvent.max_price_eur != null && fullEvent.max_price_eur !== fullEvent.base_price_eur && (
                                    <div className="detail-item"><span className="detail-label">{t('priceRange')}</span><span className="detail-value">€{fullEvent.base_price_eur} – €{fullEvent.max_price_eur}</span></div>
                                  )}
                                  {fullEvent.availability_pct != null && (
                                    <div className="detail-item"><span className="detail-label">{t('availabilityLabel')}</span><span className="detail-value">{fullEvent.availability_pct}% {t('remaining')}</span></div>
                                  )}
                                  {fullEvent.sales_start_time && (
                                    <div className="detail-item"><span className="detail-label">{t('salesStart')}</span><span className="detail-value">{formatEventDate(fullEvent.sales_start_time) || fullEvent.sales_start_time}</span></div>
                                  )}
                                  {fullEvent.city && (
                                    <div className="detail-item"><span className="detail-label">{t('cityLabel')}</span><span className="detail-value">{fullEvent.city}</span></div>
                                  )}
                                  {fullEvent.hours_since_published != null && (
                                    <div className="detail-item"><span className="detail-label">{t('publishedAgo')}</span><span className="detail-value">{fullEvent.hours_since_published < 24 ? `${Math.round(fullEvent.hours_since_published)}h` : `${Math.round(fullEvent.hours_since_published / 24)}d`} {t('ago')}</span></div>
                                  )}
                                </div>
                              )}

                              {/* Ticket variants */}
                              <h4>{t('ticketOptions')}</h4>
                              {variantData?.loading && <p className="variants-loading">{t('loadingVariants')}</p>}
                              {variantData?.error && <p className="variants-error">{variantData.error}</p>}
                              {variantData && !variantData.loading && !variantData.error && (
                                <VariantList variants={variantData.variants} t={t} />
                              )}

                              {/* AI probabilities */}
                              {ev.ai_score && (
                                <div className="ai-probabilities">
                                  <h4>{t('scorerAiConfidence')}</h4>
                                  <div className="ai-prob-bars">
                                    <div className="ai-prob-item">
                                      <span className="ai-prob-label">BUY</span>
                                      <div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${ev.ai_score.buy_probability * 100}%`, backgroundColor: aiConfidenceColor(ev.ai_score.buy_probability) }} /></div>
                                      <span className="ai-prob-value">{pctStr(ev.ai_score.buy_probability)}</span>
                                    </div>
                                    <div className="ai-prob-item">
                                      <span className="ai-prob-label">MAYBE</span>
                                      <div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${ev.ai_score.maybe_probability * 100}%`, backgroundColor: 'var(--warning)' }} /></div>
                                      <span className="ai-prob-value">{pctStr(ev.ai_score.maybe_probability)}</span>
                                    </div>
                                    <div className="ai-prob-item">
                                      <span className="ai-prob-label">SKIP</span>
                                      <div className="breakdown-track"><div className="breakdown-fill" style={{ width: `${ev.ai_score.skip_probability * 100}%`, backgroundColor: 'var(--danger)' }} /></div>
                                      <span className="ai-prob-value">{pctStr(ev.ai_score.skip_probability)}</span>
                                    </div>
                                  </div>
                                  <span className="ai-model-version">model v{ev.ai_score.model_version}</span>
                                </div>
                              )}

                              {/* Score breakdown with explanations */}
                              {fullEvent && (
                                <>
                                  <h4>{t('scorerFeatures')}</h4>
                                  <div className="breakdown-grid">
                                    <BreakdownBarExplained label={t('scorerPopularity')} value={fullEvent.feature_breakdown.popularity} explainKey="popularity" t={t} />
                                    <BreakdownBarExplained label={t('scorerDemand')} value={fullEvent.feature_breakdown.demand} explainKey="demand" t={t} />
                                    <BreakdownBarExplained label={t('scorerPricing')} value={fullEvent.feature_breakdown.pricing} explainKey="pricing" t={t} />
                                    <BreakdownBarExplained label={t('scorerTiming')} value={fullEvent.feature_breakdown.timing} explainKey="timing" t={t} />
                                    <BreakdownBarExplained label={t('scorerOrganiser')} value={fullEvent.feature_breakdown.organiser} explainKey="organiser" t={t} />
                                  </div>
                                  <div className="score-weight-info">{t('scoreWeightsInfo')}</div>
                                </>
                              )}

                              {(effectiveLabel(ev) === 'BUY' || effectiveLabel(ev) === 'MAYBE') && (
                                <button
                                  type="button"
                                  className="btn-snipe"
                                  onClick={() => handleSnipeEvent(ev.event_id)}
                                >
                                  {t('scorerTriggerBot')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* AI-grouped view */}
                {scorerView === 'ai' && (
                  <div className="scorer-results ai-grouped-view">
                    {(['BUY', 'MAYBE', 'SKIP'] as const).map((group) => {
                      const groupEvents = scoredEvents.filter((ev) => effectiveLabel(ev) === group)
                      if (groupEvents.length === 0) return null
                      return (
                        <div key={group} className={`ai-group ai-group-${group.toLowerCase()}`}>
                          <h3 className={`ai-group-header ${decisionClass(group)}`}>
                            {t(`scorerAi${group[0] + group.slice(1).toLowerCase()}`)} ({groupEvents.length})
                          </h3>
                          {groupEvents
                            .sort((a, b) => (b.ai_score?.buy_probability ?? 0) - (a.ai_score?.buy_probability ?? 0) || b.resell_score - a.resell_score)
                            .map((ev) => {
                              const isExpanded = expandedEventId === ev.event_id
                              const statusBadge = salesStatusBadge(ev.sales_status, t)
                              const eventDate = formatEventDate(ev.start_time)
                              const variantData = eventVariantCache[ev.event_id]
                              return (
                                <div key={ev.event_id} className={`scorer-card ${decisionClass(effectiveLabel(ev))}`}>
                                  <div
                                    className="scorer-card-header scorer-card-clickable"
                                    onClick={() => handleToggleExpand(ev.event_id)}
                                  >
                                    <div className="scorer-card-info">
                                      <span className="scorer-event-name">{ev.name}</span>
                                      <div className="scorer-event-meta">
                                        {ev.organiser && <span className="scorer-organiser">{ev.organiser}</span>}
                                        {statusBadge && <span className={`scorer-status-badge ${statusBadge.className}`}>{statusBadge.label}</span>}
                                        {ev.likes_total != null && ev.likes_total > 0 && <span className="scorer-likes">{ev.likes_total}</span>}
                                        {ev.base_price_eur != null && ev.base_price_eur > 0 && <span className="scorer-price">€{ev.base_price_eur}</span>}
                                        {eventDate && <span className="scorer-date">{eventDate}</span>}
                                      </div>
                                      <span className="scorer-reason">{ev.reason}</span>
                                    </div>
                                    <div className="scorer-card-score">
                                      <span className="scorer-score-value" style={{ color: scoreColor(ev.resell_score) }}>
                                        {ev.resell_score}
                                      </span>
                                      <AiBadge ai={ev.ai_score} />
                                      <span className={`scorer-decision-badge ${decisionClass(effectiveLabel(ev))}`}>
                                        {effectiveLabel(ev)}
                                      </span>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="scorer-breakdown">
                                      {/* Event details */}
                                      <div className="event-detail-grid">
                                        {ev.base_price_eur != null && ev.max_price_eur != null && ev.max_price_eur !== ev.base_price_eur && (
                                          <div className="detail-item"><span className="detail-label">{t('priceRange')}</span><span className="detail-value">€{ev.base_price_eur} – €{ev.max_price_eur}</span></div>
                                        )}
                                        {ev.availability_pct != null && (
                                          <div className="detail-item"><span className="detail-label">{t('availabilityLabel')}</span><span className="detail-value">{ev.availability_pct}% {t('remaining')}</span></div>
                                        )}
                                        {ev.sales_start_time && (
                                          <div className="detail-item"><span className="detail-label">{t('salesStart')}</span><span className="detail-value">{formatEventDate(ev.sales_start_time) || ev.sales_start_time}</span></div>
                                        )}
                                        {ev.city && (
                                          <div className="detail-item"><span className="detail-label">{t('cityLabel')}</span><span className="detail-value">{ev.city}</span></div>
                                        )}
                                        {ev.hours_since_published != null && (
                                          <div className="detail-item"><span className="detail-label">{t('publishedAgo')}</span><span className="detail-value">{ev.hours_since_published < 24 ? `${Math.round(ev.hours_since_published)}h` : `${Math.round(ev.hours_since_published / 24)}d`} {t('ago')}</span></div>
                                        )}
                                      </div>

                                      {/* Ticket variants */}
                                      <h4>{t('ticketOptions')}</h4>
                                      {variantData?.loading && <p className="variants-loading">{t('loadingVariants')}</p>}
                                      {variantData?.error && <p className="variants-error">{variantData.error}</p>}
                                      {variantData && !variantData.loading && !variantData.error && (
                                        <VariantList variants={variantData.variants} t={t} />
                                      )}

                                      {/* AI probabilities */}
                                      {ev.ai_score && (
                                        <div className="ai-probabilities">
                                          <h4>{t('scorerAiConfidence')}</h4>
                                          <div className="ai-prob-bars">
                                            <div className="ai-prob-item">
                                              <span className="ai-prob-label">BUY</span>
                                              <div className="breakdown-track">
                                                <div className="breakdown-fill" style={{ width: `${ev.ai_score.buy_probability * 100}%`, backgroundColor: aiConfidenceColor(ev.ai_score.buy_probability) }} />
                                              </div>
                                              <span className="ai-prob-value">{pctStr(ev.ai_score.buy_probability)}</span>
                                            </div>
                                            <div className="ai-prob-item">
                                              <span className="ai-prob-label">MAYBE</span>
                                              <div className="breakdown-track">
                                                <div className="breakdown-fill" style={{ width: `${ev.ai_score.maybe_probability * 100}%`, backgroundColor: 'var(--warning)' }} />
                                              </div>
                                              <span className="ai-prob-value">{pctStr(ev.ai_score.maybe_probability)}</span>
                                            </div>
                                            <div className="ai-prob-item">
                                              <span className="ai-prob-label">SKIP</span>
                                              <div className="breakdown-track">
                                                <div className="breakdown-fill" style={{ width: `${ev.ai_score.skip_probability * 100}%`, backgroundColor: 'var(--danger)' }} />
                                              </div>
                                              <span className="ai-prob-value">{pctStr(ev.ai_score.skip_probability)}</span>
                                            </div>
                                          </div>
                                          <span className="ai-model-version">model v{ev.ai_score.model_version}</span>
                                        </div>
                                      )}

                                      {/* Score breakdown with explanations */}
                                      <h4>{t('scorerFeatures')}</h4>
                                      <div className="breakdown-grid">
                                        <BreakdownBarExplained label={t('scorerPopularity')} value={ev.feature_breakdown.popularity} explainKey="popularity" t={t} />
                                        <BreakdownBarExplained label={t('scorerDemand')} value={ev.feature_breakdown.demand} explainKey="demand" t={t} />
                                        <BreakdownBarExplained label={t('scorerPricing')} value={ev.feature_breakdown.pricing} explainKey="pricing" t={t} />
                                        <BreakdownBarExplained label={t('scorerTiming')} value={ev.feature_breakdown.timing} explainKey="timing" t={t} />
                                        <BreakdownBarExplained label={t('scorerOrganiser')} value={ev.feature_breakdown.organiser} explainKey="organiser" t={t} />
                                      </div>

                                      <div className="score-weight-info">{t('scoreWeightsInfo')}</div>

                                      {(effectiveLabel(ev) === 'BUY' || effectiveLabel(ev) === 'MAYBE') && (
                                        <button
                                          type="button"
                                          className="btn-snipe"
                                          onClick={() => handleSnipeEvent(ev.event_id)}
                                        >
                                          {t('scorerTriggerBot')}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* All events view */}
                {scorerView === 'all' && (
                  <div className="scorer-results">
                    {scoredEvents
                      .sort((a, b) => b.resell_score - a.resell_score)
                      .map((ev) => {
                        const isExpanded = expandedEventId === ev.event_id
                        const statusBadge = salesStatusBadge(ev.sales_status, t)
                        const eventDate = formatEventDate(ev.start_time)
                        const variantData = eventVariantCache[ev.event_id]
                        return (
                          <div key={ev.event_id} className={`scorer-card ${decisionClass(effectiveLabel(ev))}`}>
                            <div
                              className="scorer-card-header scorer-card-clickable"
                              onClick={() => handleToggleExpand(ev.event_id)}
                            >
                              <div className="scorer-card-info">
                                <span className="scorer-event-name">{ev.name}</span>
                                <div className="scorer-event-meta">
                                  {ev.organiser && <span className="scorer-organiser">{ev.organiser}</span>}
                                  {statusBadge && <span className={`scorer-status-badge ${statusBadge.className}`}>{statusBadge.label}</span>}
                                  {ev.likes_total != null && ev.likes_total > 0 && <span className="scorer-likes">{ev.likes_total}</span>}
                                  {ev.base_price_eur != null && ev.base_price_eur > 0 && <span className="scorer-price">€{ev.base_price_eur}</span>}
                                  {eventDate && <span className="scorer-date">{eventDate}</span>}
                                </div>
                                <span className="scorer-reason">{ev.reason}</span>
                              </div>
                              <div className="scorer-card-score">
                                <span className="scorer-score-value" style={{ color: scoreColor(ev.resell_score) }}>
                                  {ev.resell_score}
                                </span>
                                <AiBadge ai={ev.ai_score} />
                                <span className={`scorer-decision-badge ${decisionClass(effectiveLabel(ev))}`}>
                                  {effectiveLabel(ev)}
                                </span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="scorer-breakdown">
                                {/* Event details */}
                                <div className="event-detail-grid">
                                  {ev.base_price_eur != null && ev.max_price_eur != null && ev.max_price_eur !== ev.base_price_eur && (
                                    <div className="detail-item"><span className="detail-label">{t('priceRange')}</span><span className="detail-value">€{ev.base_price_eur} – €{ev.max_price_eur}</span></div>
                                  )}
                                  {ev.availability_pct != null && (
                                    <div className="detail-item"><span className="detail-label">{t('availabilityLabel')}</span><span className="detail-value">{ev.availability_pct}% {t('remaining')}</span></div>
                                  )}
                                  {ev.sales_start_time && (
                                    <div className="detail-item"><span className="detail-label">{t('salesStart')}</span><span className="detail-value">{formatEventDate(ev.sales_start_time) || ev.sales_start_time}</span></div>
                                  )}
                                  {ev.city && (
                                    <div className="detail-item"><span className="detail-label">{t('cityLabel')}</span><span className="detail-value">{ev.city}</span></div>
                                  )}
                                  {ev.hours_since_published != null && (
                                    <div className="detail-item"><span className="detail-label">{t('publishedAgo')}</span><span className="detail-value">{ev.hours_since_published < 24 ? `${Math.round(ev.hours_since_published)}h` : `${Math.round(ev.hours_since_published / 24)}d`} {t('ago')}</span></div>
                                  )}
                                </div>

                                {/* Ticket variants */}
                                <h4>{t('ticketOptions')}</h4>
                                {variantData?.loading && <p className="variants-loading">{t('loadingVariants')}</p>}
                                {variantData?.error && <p className="variants-error">{variantData.error}</p>}
                                {variantData && !variantData.loading && !variantData.error && (
                                  <VariantList variants={variantData.variants} t={t} />
                                )}

                                {/* AI probabilities */}
                                {ev.ai_score && (
                                  <div className="ai-probabilities">
                                    <h4>{t('scorerAiConfidence')}</h4>
                                    <div className="ai-prob-bars">
                                      <div className="ai-prob-item">
                                        <span className="ai-prob-label">BUY</span>
                                        <div className="breakdown-track">
                                          <div className="breakdown-fill" style={{ width: `${ev.ai_score.buy_probability * 100}%`, backgroundColor: aiConfidenceColor(ev.ai_score.buy_probability) }} />
                                        </div>
                                        <span className="ai-prob-value">{pctStr(ev.ai_score.buy_probability)}</span>
                                      </div>
                                      <div className="ai-prob-item">
                                        <span className="ai-prob-label">MAYBE</span>
                                        <div className="breakdown-track">
                                          <div className="breakdown-fill" style={{ width: `${ev.ai_score.maybe_probability * 100}%`, backgroundColor: 'var(--warning)' }} />
                                        </div>
                                        <span className="ai-prob-value">{pctStr(ev.ai_score.maybe_probability)}</span>
                                      </div>
                                      <div className="ai-prob-item">
                                        <span className="ai-prob-label">SKIP</span>
                                        <div className="breakdown-track">
                                          <div className="breakdown-fill" style={{ width: `${ev.ai_score.skip_probability * 100}%`, backgroundColor: 'var(--danger)' }} />
                                        </div>
                                        <span className="ai-prob-value">{pctStr(ev.ai_score.skip_probability)}</span>
                                      </div>
                                    </div>
                                    <span className="ai-model-version">model v{ev.ai_score.model_version}</span>
                                  </div>
                                )}

                                {/* Score breakdown with explanations */}
                                <h4>{t('scorerFeatures')}</h4>
                                <div className="breakdown-grid">
                                  <BreakdownBarExplained label={t('scorerPopularity')} value={ev.feature_breakdown.popularity} explainKey="popularity" t={t} />
                                  <BreakdownBarExplained label={t('scorerDemand')} value={ev.feature_breakdown.demand} explainKey="demand" t={t} />
                                  <BreakdownBarExplained label={t('scorerPricing')} value={ev.feature_breakdown.pricing} explainKey="pricing" t={t} />
                                  <BreakdownBarExplained label={t('scorerTiming')} value={ev.feature_breakdown.timing} explainKey="timing" t={t} />
                                  <BreakdownBarExplained label={t('scorerOrganiser')} value={ev.feature_breakdown.organiser} explainKey="organiser" t={t} />
                                </div>

                                <div className="score-weight-info">{t('scoreWeightsInfo')}</div>

                                {(effectiveLabel(ev) === 'BUY' || effectiveLabel(ev) === 'MAYBE') && (
                                  <button
                                    type="button"
                                    className="btn-snipe"
                                    onClick={() => handleSnipeEvent(ev.event_id)}
                                  >
                                    {t('scorerTriggerBot')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!scorerLoading && scoredEvents.length === 0 && !scorerError && !scanMeta && (
              <p className="scorer-empty">{t('scorerNoResults')}</p>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TIKETTI SECTION — Sniper + Events sub-tabs
            ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'tiketti' && (
          <section className="tiketti-panel">
            {/* ── Tiketti sub-tabs ── */}
            <div className="tab-bar">
              <button
                className={`tab-btn ${tikettiTab === 'sniper' ? 'tab-active' : ''}`}
                onClick={() => setTikettiTab('sniper')}
              >
                {t('tikettiSniperTab')}
              </button>
              <button
                className={`tab-btn ${tikettiTab === 'events' ? 'tab-active' : ''}`}
                onClick={() => setTikettiTab('events')}
              >
                {t('tikettiEventsTab')}
              </button>
            </div>

            {/* ═══ Tiketti SNIPER sub-tab ═══ */}
            {tikettiTab === 'sniper' && (
              <div className="tiketti-sniper tab-content-fade">
                <h2>{t('tikettiSniperTitle')}</h2>
                <p className="tiketti-sniper-subtitle">{t('tikettiSniperSubtitle')}</p>

                {/* Step 1: Event URL */}
                <div className="sniper-field">
                  <label>{t('tikettiSniperUrlLabel')}</label>
                  <div className="input-row">
                    <input
                      type="url"
                      value={tikettiSniperUrl}
                      onChange={(e) => setTikettiSniperUrl(e.target.value)}
                      placeholder="https://www.tiketti.fi/..."
                      disabled={tikettiSniperStatus === 'monitoring'}
                    />
                    <button
                      className="btn-primary"
                      onClick={handleFetchTikettiEvent}
                      disabled={!tikettiSniperUrl.trim() || tikettiSniperFetching || tikettiSniperStatus === 'monitoring'}
                    >
                      {tikettiSniperFetching ? t('tikettiSniperFetching') : t('tikettiSniperFetchBtn')}
                    </button>
                  </div>
                </div>

                {tikettiSniperError && <p className="tiketti-sniper-error">{tikettiSniperError}</p>}

                {/* Event info card */}
                {tikettiSniperEvent && (
                  <div className="tiketti-sniper-event-card">
                    <h3>{tikettiSniperEvent.title}</h3>
                    <div className="tiketti-sniper-event-meta">
                      {tikettiSniperEvent.date && <span>{tikettiSniperEvent.date}{tikettiSniperEvent.endDate && tikettiSniperEvent.endDate !== tikettiSniperEvent.date ? ` — ${tikettiSniperEvent.endDate}` : ''}</span>}
                      {tikettiSniperEvent.timeInfo && <span>{tikettiSniperEvent.timeInfo}</span>}
                      <span>{tikettiSniperEvent.venue}, {tikettiSniperEvent.city}</span>
                      {tikettiSniperEvent.ageInfo && <span>{tikettiSniperEvent.ageInfo}</span>}
                    </div>

                    {/* Ticket availability */}
                    <div className="tiketti-sniper-availability">
                      <span className={`availability-badge ${tikettiSniperEvent.soldOut ? 'sold-out' : tikettiSniperEvent.ticketsFree && tikettiSniperEvent.ticketsFree > 0 ? 'available' : 'waiting'}`}>
                        {tikettiSniperEvent.soldOut
                          ? t('tikettiSniperSoldOut')
                          : tikettiSniperEvent.cancelled
                            ? t('tikettiSniperCancelled')
                            : tikettiSniperEvent.ticketsFree && tikettiSniperEvent.ticketsFree > 0
                              ? `${tikettiSniperEvent.ticketsFree} / ${tikettiSniperEvent.ticketsTotal} ${t('tikettiSniperTicketsFree')}`
                              : t('tikettiSniperWaiting')}
                      </span>
                    </div>

                    {/* How it works info box */}
                    <div className="tiketti-sniper-info-box">
                      <p>{t('tikettiSniperHowItWorks')}</p>
                    </div>

                    {/* Session cookie (optional — for auto-cart) */}
                    <div className="sniper-field">
                      <label>{t('tikettiSniperCookieLabel')}</label>
                      <textarea
                        className="cookie-textarea"
                        value={tikettiSessionCookie}
                        onChange={(e) => setTikettiSessionCookie(e.target.value)}
                        placeholder={t('tikettiSniperCookiePlaceholder')}
                        disabled={tikettiSniperStatus === 'monitoring'}
                        rows={3}
                        spellCheck={false}
                      />
                      <p className="field-hint">{t('tikettiSniperCookieHint')}</p>
                    </div>

                    {/* Quantity + delay */}
                    <div className="sniper-row">
                      <div className="sniper-field sniper-field-small">
                        <label>{t('tikettiSniperQtyLabel')}</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={tikettiSniperQty}
                          onChange={(e) => setTikettiSniperQty(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                          disabled={tikettiSniperStatus === 'monitoring'}
                        />
                      </div>
                      <div className="sniper-field sniper-field-small">
                        <label>{t('tikettiSniperDelayLabel')}</label>
                        <input
                          type="number"
                          min={500}
                          max={30000}
                          step={100}
                          value={tikettiSniperDelayMs}
                          onChange={(e) => setTikettiSniperDelayMs(Math.max(500, parseInt(e.target.value) || 2000))}
                          disabled={tikettiSniperStatus === 'monitoring'}
                        />
                      </div>
                    </div>

                    {/* Start / Stop */}
                    <div className="sniper-actions">
                      {tikettiSniperStatus !== 'monitoring' ? (
                        <button
                          className="btn-primary btn-large"
                          onClick={handleTikettiSniperStart}
                        >
                          {t('tikettiSniperStartBtn')}
                        </button>
                      ) : (
                        <button className="btn-danger btn-large" onClick={handleTikettiSniperStop}>
                          {t('tikettiSniperStopBtn')}
                        </button>
                      )}
                    </div>

                    {tikettiSniperSuccess && (
                      <div className="tiketti-sniper-success">
                        <p>{t('tikettiSniperSuccessAlert')}</p>
                        <a
                          href={tikettiSniperEvent.url || tikettiSniperUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary btn-large tiketti-go-btn"
                        >
                          {t('tikettiSniperGoToTiketti')}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Logs */}
                <div className="tiketti-sniper-logs">
                  <h4>{t('tikettiSniperLogsTitle')}</h4>
                  <div className="log-panel">
                    {tikettiSniperLogs.map((log, i) => (
                      <div key={i} className="log-entry">{log}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Tiketti EVENTS sub-tab (admin-protected) ═══ */}
            {tikettiTab === 'events' && (
              <div className="tab-content-fade">
                {!adminToken ? (
                  /* ── Login form ── */
                  <div className="admin-login-card">
                    <h2>{t('adminLoginTitle')}</h2>
                    <p className="admin-login-subtitle">{t('adminLoginSubtitle')}</p>

                    <form
                      className="admin-login-form"
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleAdminLogin()
                      }}
                    >
                      <label>
                        {t('adminUsername')}
                        <input
                          type="text"
                          value={adminUsernameInput}
                          onChange={(e) => setAdminUsernameInput(e.target.value)}
                          autoComplete="username"
                          disabled={adminLoginLoading}
                        />
                      </label>

                      <label>
                        {t('adminPassword')}
                        <input
                          type="password"
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          autoComplete="current-password"
                          disabled={adminLoginLoading}
                        />
                      </label>

                      {adminLoginError && <p className="admin-login-error">{adminLoginError}</p>}

                      <button type="submit" className="btn-primary" disabled={adminLoginLoading || !adminUsernameInput || !adminPasswordInput}>
                        {adminLoginLoading ? t('adminLoggingIn') : t('adminLoginBtn')}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ── Tiketti event list ── */
                  <>
                    <div className="tiketti-header">
                      <div>
                        <h2>{t('tikettiTitle')}</h2>
                        <p className="tiketti-subtitle">{t('tikettiSubtitle')}</p>
                      </div>
                      <div className="tiketti-actions">
                        <span className="tiketti-user">{t('adminLoggedInAs', { user: adminUser })}</span>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleTikettiScrape}
                          disabled={tikettiScraping}
                        >
                          {tikettiScraping ? t('tikettiScraping') : t('tikettiScrapeBtn')}
                        </button>
                        <button type="button" className="btn-danger-sm" onClick={handleAdminLogout}>
                          {t('adminLogout')}
                        </button>
                      </div>
                    </div>

                    {tikettiLastMessage && <p className="tiketti-message">{tikettiLastMessage}</p>}
                    {tikettiError && <p className="tiketti-error">{tikettiError}</p>}

                    {tikettiLoading ? (
                      <p className="tiketti-loading">{t('tikettiLoading')}</p>
                    ) : tikettiEvents.length === 0 ? (
                      <p className="tiketti-empty">{t('tikettiNoEvents')}</p>
                    ) : (
                      <>
                        <p className="tiketti-count">{t('tikettiEventCount', { count: tikettiEvents.length })}</p>
                        <div className="tiketti-grid">
                          {tikettiEvents.map((ev) => (
                            <div key={ev.id} className="tiketti-card">
                              {ev.imageUrl && (
                                <div className="tiketti-card-img">
                                  <img src={ev.imageUrl} alt={ev.title} loading="lazy" />
                                </div>
                              )}
                              <div className="tiketti-card-body">
                                <h3 className="tiketti-card-title">{ev.title}</h3>
                                {ev.artist && <p className="tiketti-card-artist">{ev.artist}</p>}
                                <div className="tiketti-card-meta">
                                  {ev.date && (
                                    <span className="tiketti-meta-item">
                                      {new Date(ev.date).toLocaleDateString('fi-FI', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                  <span className="tiketti-meta-item">{ev.venue}</span>
                                  <span className="tiketti-meta-item">{ev.city}</span>
                                </div>
                                {/* Ticket status badge */}
                                {ev.availableCount != null && ev.totalCount != null && ev.totalCount > 0 ? (
                                  <span className={`tiketti-status-badge ${ev.availableCount === 0 ? 'sold-out' : ev.availableCount < ev.totalCount * 0.2 ? 'limited' : 'available'}`}>
                                    {ev.availableCount === 0
                                      ? t('tikettiSoldOut')
                                      : ev.availableCount < ev.totalCount * 0.2
                                        ? `${ev.availableCount} / ${ev.totalCount} ${t('tikettiLimitedLeft')}`
                                        : `${ev.availableCount} / ${ev.totalCount} ${t('tikettiAvailable')}`}
                                  </span>
                                ) : ev.availableCount === 0 ? (
                                  <span className="tiketti-status-badge sold-out">{t('tikettiSoldOut')}</span>
                                ) : null}
                                <div className="tiketti-card-footer">
                                  <span className="tiketti-price">
                                    {ev.price > 0 ? `${ev.price.toFixed(2)} \u20AC` : 'Free'}
                                    {ev.maxPrice && ev.maxPrice !== ev.price && ` — ${ev.maxPrice.toFixed(2)} \u20AC`}
                                  </span>
                                  <a
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="tiketti-link"
                                  >
                                    {t('tikettiViewOnSite')}
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            COMING SOON SECTION
            ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === 'coming-soon' && (
          <section className="coming-soon-panel">
            <h2>{t('comingSoonTitle')}</h2>
            <p className="coming-soon-subtitle">{t('comingSoonSubtitle')}</p>

            <div className="coming-soon-grid">
              <div className="coming-soon-card">
                <div className="coming-soon-card-icon">L</div>
                <h3>{t('comingSoonLippu')}</h3>
                <p>{t('comingSoonLippuDesc')}</p>
              </div>
              <div className="coming-soon-card">
                <div className="coming-soon-card-icon">LP</div>
                <h3>{t('comingSoonLippupiste')}</h3>
                <p>{t('comingSoonLippupisteDesc')}</p>
              </div>
            </div>

            <p className="coming-soon-footer">{t('comingSoonStayTuned')}</p>
          </section>
        )}
      </main>
    </>
  )
}

export default App
