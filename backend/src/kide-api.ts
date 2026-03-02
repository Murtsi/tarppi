/**
 * Kide.app API client — server-side HTTP calls with spoofed headers.
 *
 * All external Kide.app traffic goes through here.
 * The frontend never hits kide.app directly.
 */
import axios from 'axios'
import { decodeJwt, errors as joseErrors } from 'jose'
import { buildKideHeaders, randomDelay } from './headers.js'
import { calculateXRequestedId, getExtraProperties } from './deobfuscator.js'
import type {
  KideProductModel,
  KideUser,
  ReserveResponse,
  ValidateTokenResponse,
  KideListingProduct,
  KideProductListResponse,
} from './types.js'

const KIDE_API = 'https://api.kide.app/api'

// ─── Token utilities ─────────────────────────────────────────────────────────

function isValidJwt(token: string): boolean {
  try {
    decodeJwt(token)
    return true
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) return false
    throw error
  }
}

function reverseString(str: string): string {
  return str.split('').reverse().join('')
}

/**
 * Normalize token: try both directions, return valid JWT direction.
 * Kide.app sometimes stores tokens reversed in localStorage.
 */
export function normalizeToken(token: string): string | null {
  const trimmed = token.trim()
  if (!trimmed) return null
  if (isValidJwt(trimmed)) return trimmed
  const reversed = reverseString(trimmed)
  if (isValidJwt(reversed)) return reversed
  return null
}

/**
 * Extract JWT from full localStorage value (removes warning text prefix).
 */
export function extractJwt(value: string): string {
  const trimmed = value.trim()
  const unquoted =
    trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed
  const jwtStart = unquoted.lastIndexOf('!')
  if (jwtStart !== -1) {
    const afterWarning = unquoted.slice(jwtStart + 1).trim()
    if (afterWarning.includes('.')) return afterWarning
  }
  return unquoted
}

function prepareToken(rawToken: string): string | null {
  const jwt = extractJwt(rawToken)
  return jwt ? normalizeToken(jwt) : null
}

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
    // No UUID found — return null instead of a non-UUID slug
    return null
  } catch {
    return null
  }
}

// ─── API calls ──────────────────────────────────────────────────────────────

export async function fetchEventProducts(eventIdOrUrl: string): Promise<KideProductModel> {
  const eventId = extractEventId(eventIdOrUrl)
  if (!eventId) throw new Error('Invalid event URL or ID')

  await randomDelay(50, 200)

  const headers = buildKideHeaders(undefined, undefined, eventId)
  const response = await axios.get(`${KIDE_API}/products/${eventId}`, { headers, timeout: 15_000 })

  const model = response.data?.model
  if (!model?.product || !Array.isArray(model.variants)) {
    throw new Error('Invalid product response shape')
  }
  return model as KideProductModel
}

/**
 * Fetch products from the Kide.app public listing API.
 * Supports server-side filtering via Kide's own query parameters.
 *
 * @param city — Kide city ID (e.g. "Helsinki", "capitalAreaFinlandCities"). Empty/undefined = all.
 * @param productType — 1 = events (default), 2 = merch, etc.
 * @param order — Sort order (e.g. 'favorited' for most popular). Maps to Kide's order param.
 */
export async function fetchAllProducts(
  city?: string,
  productType?: number,
  order?: string,
): Promise<KideListingProduct[]> {
  await randomDelay(50, 200)

  const params = new URLSearchParams()
  if (city) params.set('city', city)
  if (productType != null) params.set('productType', String(productType))
  if (order) params.set('order', order)

  const qs = params.toString()
  const url = `${KIDE_API}/products${qs ? `?${qs}` : ''}`

  const headers = buildKideHeaders()
  const response = await axios.get(url, { headers, timeout: 20_000 })

  const data = response.data as KideProductListResponse | undefined
  if (!data?.model || !Array.isArray(data.model)) {
    throw new Error('Invalid product list response shape')
  }
  return data.model
}

export async function validateToken(rawToken: string): Promise<ValidateTokenResponse> {
  if (!rawToken?.trim()) return { valid: false }

  const normalized = prepareToken(rawToken)
  if (!normalized) return { valid: false }

  // Check local expiry first
  try {
    const decoded = decodeJwt(normalized)
    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : undefined
    if (expiresAt && expiresAt < new Date()) {
      return {
        valid: false,
        info: {
          email: typeof decoded.sub === 'string' ? decoded.sub : undefined,
          expiresAt: expiresAt.toISOString(),
        },
      }
    }
  } catch {
    // Ignore decode errors, let API validate
  }

  await randomDelay(50, 150)

  const masked = `${normalized.slice(0, 4)}...${normalized.slice(-4)}`
  console.log(`[Kide] Validating token: ${masked}`)

  const headers = buildKideHeaders(normalized)

  try {
    const response = await axios.get(`${KIDE_API}/authentication/user`, { headers, timeout: 10_000 })
    const user = response.data?.model as KideUser | undefined

    let expiresAt: string | undefined
    let email: string | undefined
    try {
      const decoded = decodeJwt(normalized)
      expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
      email = typeof decoded.sub === 'string' ? decoded.sub : undefined
    } catch {
      // ignore
    }

    return {
      valid: true,
      user,
      info: { email, expiresAt },
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return { valid: false }
    }
    throw error
  }
}

export async function addToCart(
  rawToken: string,
  inventoryId: string,
  quantity: number,
): Promise<ReserveResponse> {
  if (!rawToken || !inventoryId) {
    return { success: false, message: 'Missing token or inventory ID' }
  }

  const normalized = prepareToken(rawToken)
  if (!normalized) {
    return { success: false, message: 'Token is not a valid JWT' }
  }

  const { headerKey } = getExtraProperties()
  const xRequestedId = calculateXRequestedId(inventoryId)

  const requestBody = {
    toCreate: [{ inventoryId, quantity, productVariantUserForm: null }],
    toCancel: [],
  }

  const extraHeaders: Record<string, string> = {
    [headerKey]: xRequestedId,
  }

  const headers = buildKideHeaders(normalized, extraHeaders)

  const masked = `${normalized.slice(0, 4)}...${normalized.slice(-4)}`
  console.log(`[Kide] Adding to cart: ${inventoryId} x ${quantity} (token: ${masked})`)

  // No artificial delay on the cart path — speed is critical for sniping

  try {
    await axios.post(`${KIDE_API}/reservations`, requestBody, {
      headers,
      timeout: 15_000,
    })
    console.log(`[Kide] Cart success: ${quantity}x ${inventoryId} added`)
    return { success: true, message: `Added ${quantity} ticket(s) to cart!` }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const errorData = error.response?.data as Record<string, unknown> | undefined
      const errorObj = errorData?.error as Record<string, unknown> | undefined
      const errorType = errorObj?.type as number | undefined

      console.error(`[Kide] Cart error: status=${status}, type=${errorType}`, errorData)

      if (status === 401) return { success: false, message: 'Token expired or invalid' }
      if (status === 409) return { success: false, message: 'Already in cart or unavailable' }

      if (status === 400) {
        const errorMap: Record<number, string> = {
          12: 'Invalid quantity',
          13: 'Variant not available',
          14: 'Quantity exceeds availability - retrying with less',
          18: 'Quantity exceeds maximum limit - retrying with less',
          19: 'Token validation failed',
          20: 'Invalid inventory ID',
        }

        const friendlyMsg = errorType && errorMap[errorType] ? errorMap[errorType] : `Error code: ${errorType}`

        if ((errorType === 14 || errorType === 18) && quantity > 1) {
          const nextQuantity = Math.ceil(quantity / 2)
          if (nextQuantity < quantity) {
            return {
              success: false,
              message: `Quantity too high, retrying with ${nextQuantity}...`,
              retryWithQuantity: nextQuantity,
            }
          }
        }

        return { success: false, message: `Bad request: ${friendlyMsg}` }
      }

      return { success: false, message: `Failed: ${error.message}` }
    }
    return { success: false, message: 'Network error' }
  }
}
