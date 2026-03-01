import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { extractEventId, fetchEventProducts, fetchEventDetail, maskToken, validateToken, addToCart, fetchExtraProperties, scanCity } from './lib/kide/api'
import { getTranslation, type LanguageCode } from './lib/translations'
import type { ScoredEvent, TopEvent, SalesStatus, AiScore, KideVariant } from './lib/kide/types'
import CityPicker from './components/CityPicker'
import './App.css'

type AppTab = 'sniper' | 'scorer'

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

const TokenGuideContent = ({ onClose, t }: { onClose: () => void; t: (key: string) => string }) => (
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

// ─── Info Modal Component ──────────────────────────────────────────────────────

const InfoModalContent = ({ onClose, t }: { onClose: () => void; t: (key: string) => string }) => (
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

// ─── App ──────────────────────────────────────────────────────────────────────



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

function salesStatusBadge(status?: SalesStatus): { label: string; className: string } | null {
  if (!status) return null
  switch (status) {
    case 'upcoming': return { label: 'Upcoming', className: 'status-upcoming' }
    case 'on_sale': return { label: 'On sale', className: 'status-on-sale' }
    case 'selling_fast': return { label: 'Selling fast', className: 'status-selling-fast' }
    case 'almost_sold_out': return { label: 'Almost sold out', className: 'status-almost-sold-out' }
    case 'paused': return { label: 'Paused', className: 'status-paused' }
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
  const [activeTab, setActiveTab] = useState<AppTab>('sniper')
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
  const [eventVariants, setEventVariants] = useState<Array<{ inventoryId: string; name: string; price: number }>>([])
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [fetchingEvent, setFetchingEvent] = useState(false)
  const [showTokenGuide, setShowTokenGuide] = useState(false)

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
        const variants = data.variants.map((v) => ({
          inventoryId: v.inventoryId,
          name: v.name,
          price: v.pricePerItem ?? v.price ?? 0,
        }))
        setEventVariants(variants)
        if (variants.length > 0 && !selectedVariantId) {
          setSelectedVariantId(variants[0].inventoryId)
        }
      } catch {
        setEventName('')
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
    setActiveTab('sniper')
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

  const steps = [t('step1'), t('step2'), t('step3'), t('step4'), t('step5')]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {infoPanelOpen && <InfoModalContent onClose={() => setInfoPanelOpen(false)} t={t} />}
      {showTokenGuide && <TokenGuideContent onClose={() => setShowTokenGuide(false)} t={t} />}

      <main className="app-shell">
        <header className="app-header">
          <div className="header-left">
            <h1>{t('appTitle')}</h1>
            <p>{t('appSubtitle')}</p>
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

        {/* ── Tab switcher ── */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'sniper' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('sniper')}
          >
            {t('sniperTab')}
          </button>
          <button
            className={`tab-btn ${activeTab === 'scorer' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('scorer')}
          >
            {t('scorerTab')}
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SNIPER TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'sniper' && (
          <>
            <ol className="stepper" aria-label="Setup steps">
              {steps.map((label, index) => (
                <li
                  key={label}
                  className={[
                    'step',
                    step === index ? 'step-active' : '',
                    step > index ? 'step-complete' : '',
                  ].join(' ')}
                >
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>

        <section className="panel">
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

              {fetchingEvent && <p className="loading-text">{t('loadingEvent')}</p>}

              {eventName && !fetchingEvent && (
                <div className="event-card">
                  <p className="event-card-label">Event</p>
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
                          <option key={v.inventoryId} value={v.inventoryId}>
                            {v.name} — €{(v.price / 100).toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
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
                          Expires: {tokenExpiresAt.toLocaleDateString()}
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

              <label>
                {t('quantity')}
                <input type="number" min={1} max={50} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} />
              </label>

              <label>
                {t('proxyUrl')} <span className="label-hint">{t('proxyUrlOptional')}</span>
                <input type="text" placeholder={t('proxyUrlPlaceholder')} value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} />
                <div className="hint-text">{t('proxyUrlHint')}</div>
              </label>
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
                <div><strong>{t('quantityLabel')}</strong><p>{quantity} ticket(s)</p></div>
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
                <div><strong>{t('statusLabel')}</strong><p>{status}</p></div>
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
        </section>

        <footer className="button-row footer-nav">
          <button type="button" onClick={moveBack} disabled={step === 0} className="btn-secondary">
            {t('back')}
          </button>
          <button type="button" onClick={moveNext} disabled={!canGoNext || step === 4} className="btn-primary">
            {step === 3 ? t('reviewMonitor') : t('next')}
          </button>
        </footer>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            AI SCORER TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'scorer' && (
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
                    {' · '}{scanMeta.filtered_out_sold_out} sold-out filtered out
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
                      const statusBadge = salesStatusBadge(ev.sales_status)
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
                              const statusBadge = salesStatusBadge(ev.sales_status)
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
                        const statusBadge = salesStatusBadge(ev.sales_status)
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
      </main>
    </>
  )
}

export default App
