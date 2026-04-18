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
  DiscussResponse,
} from './types'

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

// ─── Event Discussion API ────────────────────────────────────────────────────

/**
 * Fetch a Finnish-language structured analysis for a scored event.
 * On-demand only — called when the user clicks "Analysoi".
 */
export async function discussEvent(event: Record<string, unknown>): Promise<DiscussResponse> {
  return apiCall<DiscussResponse>('/api/discuss', { event })
}
