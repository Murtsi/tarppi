/**
 * Frontend API client — all requests go through the backend.
 */
import type {
  EventResponse,
  ReserveResponse,
  ValidateTokenResponse,
  BackendStatusResponse,
  EventFeatures,
  ScorerResponse,
  ScanResponse,
  AuthLoginResponse,
  AuthVerifyResponse,
  TikettiEventsResponse,
  TikettiEventResponse,
  TikettiReserveResponse,
  TikettiBrowserBuyResponse,
} from './types'
import type { TikettiBrowserSSEEvent } from './types'

const API_URL = import.meta.env.VITE_API_URL || ''

async function apiCall<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = `${API_URL}${path}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const msg = (errorData as Record<string, string>).error
      || (errorData as Record<string, string>).message
      || `HTTP ${response.status}`
    throw new Error(msg)
  }

  return response.json() as Promise<T>
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch event details and ticket variants from the backend.
 */
export async function fetchEventProducts(eventUrl: string): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl })
}

/**
 * Fetch event detail by event ID (for scorer expanded view).
 */
export async function fetchEventDetail(eventId: string): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl: `https://kide.app/events/${eventId}` })
}

/**
 * Validate a Kide.app bearer token via the backend.
 */
export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  return apiCall<ValidateTokenResponse>('/api/validate-token', { token })
}

/**
 * Add tickets to cart via the backend (proxied to Kide.app).
 */
export async function addToCart(
  token: string,
  variantId: string,
  quantity: number,
): Promise<ReserveResponse> {
  return apiCall<ReserveResponse>('/api/reserve', {
    variantId,
    authorizationToken: token,
    amount: quantity,
  })
}

/**
 * Check backend readiness and warm up session.
 */
export async function fetchExtraProperties(): Promise<BackendStatusResponse> {
  return apiCall<BackendStatusResponse>('/api/deobfuscate', {})
}

/**
 * Score a batch of events for resell potential.
 */
export async function scoreEvents(events: EventFeatures[]): Promise<ScorerResponse> {
  return apiCall<ScorerResponse>('/api/score', { events })
}

/**
 * Scan events by city, extract features, and score them.
 */
export async function scanCity(city: string): Promise<ScanResponse> {
  return apiCall<ScanResponse>('/api/scan', { city, productType: 1 })
}

/**
 * Extract event ID from URL (client-side utility).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function extractEventId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (UUID_RE.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const segments = url.pathname.split('/').filter(Boolean)
    for (let i = segments.length - 1; i >= 0; i--) {
      if (UUID_RE.test(segments[i])) return segments[i]
    }
    return segments[segments.length - 1] ?? null
  } catch {
    return null
  }
}

/**
 * Mask a token for display: first4...last4
 */
export function maskToken(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

// ─── Auth API ───────────────────────────────────────────────────────────────

/**
 * Admin login — returns JWT token.
 */
export async function adminLogin(username: string, password: string): Promise<AuthLoginResponse> {
  return apiCall<AuthLoginResponse>('/api/auth/login', { username, password })
}

/**
 * Verify admin JWT token.
 */
export async function adminVerify(token: string): Promise<AuthVerifyResponse> {
  const url = `${API_URL}/api/auth/verify`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json() as Promise<AuthVerifyResponse>
}

// ─── Tiketti API ────────────────────────────────────────────────────────────

/**
 * Fetch Tiketti events (requires admin JWT).
 */
export async function fetchTikettiEvents(adminToken: string, city?: string): Promise<TikettiEventsResponse> {
  const url = `${API_URL}/api/tiketti/events${city ? `?city=${encodeURIComponent(city)}` : ''}`
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error((errorData as Record<string, string>).error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<TikettiEventsResponse>
}

/**
 * Trigger manual event refresh (admin only).
 */
export async function triggerTikettiScrape(adminToken: string): Promise<{ success: boolean; scraped: number; upserted: number }> {
  const url = `${API_URL}/api/tiketti/scrape`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error((errorData as Record<string, string>).error || `HTTP ${response.status}`)
  }

  return response.json() as Promise<{ success: boolean; scraped: number; upserted: number }>
}

// ─── Tiketti Sniper API ─────────────────────────────────────────────────────

/**
 * Fetch Tiketti.fi event details + ticket variants.
 */
export async function fetchTikettiEvent(eventUrl: string): Promise<TikettiEventResponse> {
  return apiCall<TikettiEventResponse>('/api/tiketti/event', { eventUrl })
}

/**
 * Add tickets to Tiketti.fi cart.
 */
export async function addToTikettiCart(
  eventUrl: string,
  quantity: number,
  sessionCookie: string,
): Promise<TikettiReserveResponse> {
  return apiCall<TikettiReserveResponse>('/api/tiketti/reserve', {
    eventUrl,
    quantity,
    sessionCookie,
  })
}

// ─── Tiketti Browser Automation API ─────────────────────────────────────────

/**
 * Start a Playwright browser session for a Tiketti event.
 * Returns an EventSource-like reader that streams status updates via SSE.
 * The browser navigates to the event, handles Queue-it, and parks ready to buy.
 */
export function startTikettiBrowserSession(
  eventUrl: string,
  quantity: number,
  onEvent: (event: TikettiBrowserSSEEvent) => void,
  onError: (error: string) => void,
): AbortController {
  const controller = new AbortController()
  const url = `${API_URL}/api/tiketti/browser/session`

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventUrl, quantity }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        onError((err as Record<string, string>).error || 'Failed to start browser session')
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError('No SSE stream from server')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as TikettiBrowserSSEEvent
              onEvent(data)
            } catch {
              // Malformed SSE line, skip
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return
      onError(err instanceof Error ? err.message : 'Network error')
    })

  return controller
}

/**
 * Trigger the buy action on an active browser session.
 */
export async function triggerTikettiBrowserBuy(
  sessionId: string,
): Promise<TikettiBrowserBuyResponse> {
  return apiCall<TikettiBrowserBuyResponse>('/api/tiketti/browser/buy', { sessionId })
}

/**
 * Close a browser session.
 */
export async function closeTikettiBrowserSession(sessionId: string): Promise<void> {
  const url = `${API_URL}/api/tiketti/browser/session/${sessionId}`
  await fetch(url, { method: 'DELETE' }).catch(() => {})
}
