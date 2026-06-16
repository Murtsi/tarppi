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
  SnipeJobResponse,
  CreateSnipeJobResponse,
  BackendHealthResponse,
} from './types'
import { ApiConfigurationError, buildApiUrl, getApiConfig } from './api-config'
export { ApiConfigurationError }

const API_CONFIG = getApiConfig(import.meta.env.VITE_API_URL, import.meta.env.PROD)
export const API_URL = API_CONFIG.apiUrl
const KIDE_MEDIA_BASE = 'https://portalvhdsp62n0yt356llm.blob.core.windows.net/bailataan-mediaitems/'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getApiStatus() {
  return {
    configured: API_CONFIG.configured,
    apiUrl: API_CONFIG.apiUrl,
    error: API_CONFIG.error,
    isProduction: API_CONFIG.isProduction,
  }
}

async function apiCall<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const url = buildApiUrl(API_CONFIG, path)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
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

export async function fetchEventProducts(eventUrl: string, signal?: AbortSignal): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl }, signal)
}

export async function fetchEventDetail(eventId: string, signal?: AbortSignal): Promise<EventResponse> {
  return apiCall<EventResponse>('/api/event', { eventUrl: `https://kide.app/events/${eventId}` }, signal)
}

export async function validateToken(token: string): Promise<ValidateTokenResponse> {
  return apiCall<ValidateTokenResponse>('/api/validate-token', { token })
}

export async function addToCart(
  token: string,
  variantId: string,
  quantity: number,
  eventId?: string,
): Promise<ReserveResponse> {
  return apiCall<ReserveResponse>('/api/reserve', {
    variantId,
    authorizationToken: token,
    amount: quantity,
    ...(eventId && { eventId }),
  })
}

export async function fetchExtraProperties(signal?: AbortSignal): Promise<DeobfuscateResponse> {
  return apiCall<DeobfuscateResponse>('/api/deobfuscate', {}, signal)
}

export async function fetchKideTime(): Promise<{ offsetMs: number }> {
  const url = buildApiUrl(API_CONFIG, '/api/kide-time')
  const res = await fetch(url)
  if (!res.ok) return { offsetMs: 0 }
  const data = await res.json() as { offsetMs?: number }
  return { offsetMs: data.offsetMs ?? 0 }
}

export async function fetchBackendHealth(): Promise<BackendHealthResponse> {
  const response = await fetch(buildApiUrl(API_CONFIG, '/health'))
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const msg = (errorData as Record<string, string>).error
      || (errorData as Record<string, string>).message
      || `HTTP ${response.status}`
    throw new Error(msg)
  }
  return response.json() as Promise<BackendHealthResponse>
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
  const url = buildApiUrl(API_CONFIG, '/api/auth/verify')
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.json() as Promise<AuthVerifyResponse>
}

export async function discussEvent(event: Record<string, unknown>): Promise<DiscussResponse> {
  return apiCall<DiscussResponse>('/api/discuss', { event })
}

// ─── Server-side Snipe Jobs ──────────────────────────────────────────────────

export async function createServerSnipe(
  authorizationToken: string,
  variantId: string,
  quantity: number,
  salesStartMs?: number,
  eventId?: string,
  eventName?: string,
  telegramChatId?: string,
  variantIds?: string[],
): Promise<CreateSnipeJobResponse> {
  return apiCall<CreateSnipeJobResponse>('/api/snipe', {
    authorizationToken,
    variantId,
    quantity,
    ...(variantIds && variantIds.length > 0 && { variantIds }),
    ...(salesStartMs != null && { salesStartMs }),
    ...(eventId && { eventId }),
    ...(eventName && { eventName }),
    ...(telegramChatId && { telegramChatId }),
  })
}

export async function getServerSnipe(jobId: string): Promise<SnipeJobResponse> {
  const url = buildApiUrl(API_CONFIG, `/api/snipe/${encodeURIComponent(jobId)}`)
  const response = await fetch(url)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const msg = (errorData as Record<string, string>).error || `HTTP ${response.status}`
    const error = new Error(msg) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.json() as Promise<SnipeJobResponse>
}

export async function cancelServerSnipe(jobId: string): Promise<{ success: boolean }> {
  const url = buildApiUrl(API_CONFIG, `/api/snipe/${encodeURIComponent(jobId)}`)
  const response = await fetch(url, { method: 'DELETE' })
  return response.json() as Promise<{ success: boolean }>
}
