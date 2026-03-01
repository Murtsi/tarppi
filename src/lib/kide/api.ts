/**
 * Frontend API client — calls the Railway backend instead of Kide.app directly.
 *
 * No more Tauri imports, no more axios, no more direct kide.app calls.
 * Everything goes through the backend proxy.
 */
import type {
  EventResponse,
  ReserveResponse,
  ValidateTokenResponse,
  DeobfuscateResponse,
} from './types'

const API_URL = import.meta.env.kidehiiri.railway.internal || ''

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
 * Trigger a refresh of the anti-bot deobfuscated values on the backend.
 */
export async function fetchExtraProperties(): Promise<DeobfuscateResponse> {
  return apiCall<DeobfuscateResponse>('/api/deobfuscate', {})
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
