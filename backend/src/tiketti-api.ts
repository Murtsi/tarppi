/**
 * Tiketti.fi API client — homepage data extraction + cart actions.
 *
 * Tiketti.fi protects ALL event detail pages with Cloudflare + Queue-it
 * virtual waiting room, so direct page scraping is impossible.
 *
 * Strategy:
 * 1. Homepage (no Queue-it) has a massive embedded JSON blob with ALL events
 *    inside: `const events = JSON.parse('[...]')` — 1300+ events.
 * 2. We extract eventID from the user's URL, then find the event in that blob.
 * 3. For cart actions we use tiketti.fi's internal `/json/add2cart` endpoint
 *    with the user's browser cookies (must include QueueIT-Accepted cookies).
 *
 * Authentication: Tiketti uses session cookies + Queue-it cookies.
 * Users must supply their full cookie string from browser DevTools.
 */
import axios from 'axios'

const TIKETTI_BASE = 'https://www.tiketti.fi'
const TIKETTI_IMG_BASE = 'https://www.tiketti.fi/img/hartikel'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ─── Raw homepage event shape ───────────────────────────────────────────────

type RawTikettiEvent = {
  eventID: string
  name: string
  name_en: string
  short_name: string
  short_name_en: string
  ageinfo: string
  timeinfo: string
  quota_total: string
  cancelled: string
  sold_out: string
  start_date: string
  end_date: string
  start_weekday: string
  end_weekday: string
  location_string: string
  location_name: string
  location_city: string
  locationID: string
  tags: number[]
  is_product: string
  tickets_total: string
  tickets_free: string
  tickets_sold: string
  tickets_reserved: string
  net_sales: string
  img_ev_filename: string
  images: {
    EV: { filename: string; size: string; modified: string }
    EVBG: { filename: string | null; size: string | null; modified: string | null }
  }
}

// ─── Exported types ─────────────────────────────────────────────────────────

export type TikettiVariant = {
  id: string
  name: string
  price: number
  available: boolean
  maxQuantity: number
}

export type TikettiEventDetail = {
  id: string
  title: string
  url: string
  date: string
  venue: string
  city: string
  variants: TikettiVariant[]
  imageUrl?: string
  /** Extra metadata from homepage blob */
  ticketsFree?: number
  ticketsTotal?: number
  soldOut?: boolean
  cancelled?: boolean
  ageInfo?: string
  timeInfo?: string
  endDate?: string
}

export type TikettiReserveResponse = {
  success: boolean
  message: string
}

// ─── Homepage events cache ──────────────────────────────────────────────────

let cachedEvents: RawTikettiEvent[] = []
let cacheTimestamp = 0
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

/**
 * Fetch and parse the homepage events JSON blob.
 * The homepage embeds all events as:
 *   `const events = JSON.parse('[...]')`
 */
async function fetchHomepageEvents(): Promise<RawTikettiEvent[]> {
  if (cachedEvents.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedEvents
  }

  console.log('[tiketti-api] Fetching homepage events...')

  const response = await axios.get(TIKETTI_BASE + '/', {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
    },
    timeout: 30_000,
    maxRedirects: 5,
  })

  const html = response.data as string
  console.log(`[tiketti-api] Homepage: ${(html.length / 1024).toFixed(0)} KB`)

  // Find the events array: `[{"eventID"...`
  const startPattern = '[{"eventID"'
  let startIdx = html.indexOf(startPattern)

  if (startIdx === -1) {
    // Fallback: search backwards from any eventID reference
    const anyEvent = html.indexOf('"eventID":"')
    if (anyEvent === -1) throw new Error('No event data found on tiketti.fi homepage')

    for (let i = anyEvent - 1; i > Math.max(0, anyEvent - 500_000); i--) {
      if (html[i] === '[' && html[i + 1] === '{') {
        const peek = html.substring(i + 2, i + 20)
        if (peek.includes('eventID')) {
          startIdx = i
          break
        }
      }
    }
    if (startIdx === -1) throw new Error('Could not locate events array in homepage')
  }

  // Find matching end bracket
  let depth = 0
  let endIdx = startIdx
  for (let i = startIdx; i < html.length; i++) {
    if (html[i] === '[') depth++
    if (html[i] === ']') {
      depth--
      if (depth === 0) {
        endIdx = i + 1
        break
      }
    }
  }

  const jsonStr = html.substring(startIdx, endIdx)

  // Fix invalid JSON escape sequences (the blob uses JS-style escapes like \')
  // Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
  const fixed = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, '\\\\')

  const events = JSON.parse(fixed) as RawTikettiEvent[]
  console.log(`[tiketti-api] Parsed ${events.length} events from homepage`)

  cachedEvents = events
  cacheTimestamp = Date.now()
  return events
}

/** Force-invalidate the events cache (used before monitoring polls). */
export function invalidateTikettiCache(): void {
  cacheTimestamp = 0
}

// ─── URL helpers ────────────────────────────────────────────────────────────

/**
 * Normalise a tiketti.fi URL — accept full URL or path.
 */
export function normalizeTikettiUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('https://www.tiketti.fi/') || trimmed.startsWith('https://tiketti.fi/')) {
    return trimmed
  }

  if (trimmed.startsWith('/')) {
    return `${TIKETTI_BASE}${trimmed}`
  }

  if (trimmed.startsWith('tiketti.fi/') || trimmed.startsWith('www.tiketti.fi/')) {
    return `https://${trimmed}`
  }

  return null
}

/**
 * Extract eventID from a tiketti.fi URL.
 * URL pattern: https://www.tiketti.fi/{slug}/{eventID}
 * e.g. /flow-festival-2026-suvilahti-helsinki-lippuja/111027
 */
export function extractEventId(urlOrInput: string): string | null {
  const url = normalizeTikettiUrl(urlOrInput)
  if (!url) return null

  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    // Last segment should be the numeric eventID
    const last = segments[segments.length - 1]
    if (last && /^\d+$/.test(last)) return last

    // Maybe it's in a different format; check second-to-last
    const secondLast = segments[segments.length - 2]
    if (secondLast && /^\d+$/.test(secondLast)) return secondLast
  } catch {
    // Not a valid URL
  }

  // Last resort: regex for any numeric ID in the input
  const match = urlOrInput.match(/\/(\d{4,})(?:[/?#]|$)/)
  return match?.[1] ?? null
}

/**
 * Build a tiketti.fi event URL from eventID and event name.
 */
function buildEventUrl(event: RawTikettiEvent): string {
  const slug = (event.name || 'event')
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const location = (event.location_name || '')
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const city = (event.location_city || '')
    .toLowerCase()
    .replace(/[äå]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `${TIKETTI_BASE}/${slug}-${location}-${city}-lippuja/${event.eventID}`
}

/**
 * Build image URL from the raw event data.
 */
function buildImageUrl(event: RawTikettiEvent): string | undefined {
  const fn = event.img_ev_filename || event.images?.EV?.filename
  if (!fn) return undefined
  return `${TIKETTI_IMG_BASE}/${fn}`
}

// ─── Map raw event to TikettiEventDetail ────────────────────────────────────

function mapRawToDetail(raw: RawTikettiEvent, originalUrl?: string): TikettiEventDetail {
  const ticketsFree = parseInt(raw.tickets_free || '0', 10)
  const ticketsTotal = parseInt(raw.tickets_total || '0', 10)
  const isSoldOut = raw.sold_out === '1'

  // We don't have variant/price data from the homepage.
  // Create a "General" variant reflecting overall availability.
  const variants: TikettiVariant[] = []

  if (ticketsTotal > 0 || !isSoldOut) {
    variants.push({
      id: `ev-${raw.eventID}`,
      name: 'Pääsylippu / General Admission',
      price: 0, // Price not available from homepage
      available: ticketsFree > 0 && !isSoldOut,
      maxQuantity: Math.min(ticketsFree || 10, 10),
    })
  }

  return {
    id: raw.eventID,
    title: raw.name || raw.name_en || raw.short_name || 'Unknown event',
    url: originalUrl || buildEventUrl(raw),
    date: raw.start_date || '',
    venue: raw.location_name || raw.location_string || 'Unknown venue',
    city: raw.location_city || '',
    variants,
    imageUrl: buildImageUrl(raw),
    ticketsFree,
    ticketsTotal,
    soldOut: isSoldOut,
    cancelled: raw.cancelled === '1',
    ageInfo: raw.ageinfo || undefined,
    timeInfo: raw.timeinfo || undefined,
    endDate: raw.end_date || undefined,
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch event details from tiketti.fi homepage data.
 * Bypasses Queue-it by reading from the homepage's embedded JSON blob.
 */
export async function fetchTikettiEvent(eventUrl: string): Promise<TikettiEventDetail> {
  const eventId = extractEventId(eventUrl)
  if (!eventId) throw new Error('Could not extract eventID from URL')

  console.log(`[tiketti-api] Looking up event ID: ${eventId}`)

  const events = await fetchHomepageEvents()
  const raw = events.find((e) => e.eventID === eventId)

  if (!raw) {
    throw new Error(
      `Event ${eventId} not found among ${events.length} events on tiketti.fi homepage`,
    )
  }

  const normalized = normalizeTikettiUrl(eventUrl)
  return mapRawToDetail(raw, normalized ?? undefined)
}

/**
 * Check current availability for an event (quick poll).
 * Invalidates cache first to get fresh data.
 */
export async function checkTikettiAvailability(
  eventId: string,
): Promise<{ ticketsFree: number; soldOut: boolean }> {
  invalidateTikettiCache()
  const events = await fetchHomepageEvents()
  const raw = events.find((e) => e.eventID === eventId)

  if (!raw) {
    return { ticketsFree: 0, soldOut: true }
  }

  return {
    ticketsFree: parseInt(raw.tickets_free || '0', 10),
    soldOut: raw.sold_out === '1',
  }
}

/**
 * List all events from homepage data.
 */
export async function listTikettiHomepageEvents(): Promise<TikettiEventDetail[]> {
  const events = await fetchHomepageEvents()
  return events.map((e) => mapRawToDetail(e))
}

/**
 * Attempt to add tickets to Tiketti.fi cart via their internal JSON API.
 *
 * Uses tiketti.fi's `nemJSONRequest` pattern:
 * - POST to /json/add2cart
 * - Content-Type: text/plain
 * - Body: JSON string of { action: 'add2cart', items: [...] }
 * - Requires full browser cookies (session + QueueIT-Accepted-*)
 */
export async function addToTikettiCart(
  eventId: string,
  quantity: number,
  sessionCookie: string,
): Promise<TikettiReserveResponse> {
  if (!sessionCookie?.trim()) {
    return { success: false, message: 'Browser cookies are required (including QueueIT cookies)' }
  }

  console.log(`[tiketti-api] Adding to cart: event=${eventId} x ${quantity}`)

  // Use the nemJSONRequest-style call to /json/add2cart
  const requestData = {
    action: 'add2cart',
    items: [
      {
        eventID: eventId,
        sectionID: '0',
        categoryID: '0',
        price_group_name: '',
        amount: quantity,
        require_multiticket: 0,
        multiticket_list: [],
      },
    ],
  }

  try {
    const response = await axios.post(
      `${TIKETTI_BASE}/json/add2cart`,
      JSON.stringify(requestData),
      {
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'text/plain',
          Accept: '*/*',
          Cookie: sessionCookie,
          Referer: `${TIKETTI_BASE}/`,
          Origin: TIKETTI_BASE,
        },
        timeout: 15_000,
        withCredentials: true,
        maxRedirects: 0,
        validateStatus: (s) => s < 500,
      },
    )

    const data = response.data as Record<string, unknown>
    console.log(`[tiketti-api] Cart response (${response.status}):`, JSON.stringify(data).substring(0, 200))

    // Only treat explicitly successful statuses as success.
    // tiketti.fi returns "ok" or "ok_show_message" for real success.
    // "unknown action" or anything else is NOT a success.
    const status = data.status as string | undefined
    if (response.status === 200 && (status === 'ok' || status === 'ok_show_message')) {
      return {
        success: true,
        message: `Added ${quantity} ticket(s) to cart! Complete checkout at tiketti.fi`,
      }
    }

    return {
      success: false,
      message: (data.text_message as string) || (data.message as string) || status || `Unexpected response: ${response.status}`,
    }
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status
      if (status === 302 || status === 301) {
        return {
          success: false,
          message: 'Redirected to Queue-it — your cookies may have expired. Pass through Queue-it in your browser first, then update your cookie string.',
        }
      }
      if (status === 401 || status === 403) {
        return {
          success: false,
          message: 'Authentication failed — check that your browser cookies are current.',
        }
      }
    }

    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti-api] Cart error:', msg)
    return { success: false, message: `Cart request failed: ${msg}` }
  }
}
