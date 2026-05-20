import type {
  EventResponse,
  ReserveResponse,
  ValidateTokenResponse,
  DeobfuscateResponse,
  EventFeatures,
  ScorerResponse,
  ScanResponse,
  AuthLoginResponse,
  AuthVerifyResponse,
  DiscussResponse,
} from './types'

const API_URL = import.meta.env.VITE_API_URL || ''
const KIDE_MEDIA_BASE = 'https://portalvhdsp62n0yt356llm.blob.core.windows.net/bailataan-mediaitems/'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

export async function fetchEventProducts(eventUrl: string): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl })
}

export async function fetchEventDetail(eventId: string): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl: `https://kide.app/events/${eventId}` })
}

export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  return apiCall<ValidateTokenResponse>('/api/validate-token', { token })
}

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

export async function fetchExtraProperties(): Promise<DeobfuscateResponse> {
  return apiCall<DeobfuscateResponse>('/api/deobfuscate', {})
}

export async function fetchKideTime(): Promise<{ offsetMs: number }> {
  const url = `${API_URL}/api/kide-time`
  const res = await fetch(url)
  if (!res.ok) return { offsetMs: 0 }
  const data = await res.json() as { offsetMs?: number }
  return { offsetMs: data.offsetMs ?? 0 }
}

export async function scoreEvents(events: EventFeatures[]): Promise<ScorerResponse> {
  return apiCall<ScorerResponse>('/api/score', { events })
}

export async function scanCity(city: string): Promise<ScanResponse> {
  return apiCall<ScanResponse>('/api/scan', { city, productType: 1 })
}

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

export function maskToken(token: string): string {
  const trimmed = token.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

export function buildMediaUrl(mediaFilename?: string | null): string | null {
  if (!mediaFilename) return null
  if (mediaFilename.startsWith('http')) return mediaFilename
  return `${KIDE_MEDIA_BASE}${mediaFilename}`
}

export async function adminLogin(username: string, password: string): Promise<AuthLoginResponse> {
  return apiCall<AuthLoginResponse>('/api/auth/login', { username, password })
}

export async function adminVerify(token: string): Promise<AuthVerifyResponse> {
  const url = `${API_URL}/api/auth/verify`
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json() as Promise<AuthVerifyResponse>
}

export async function discussEvent(event: Record<string, unknown>): Promise<DiscussResponse> {
  return apiCall<DiscussResponse>('/api/discuss', { event })
}
