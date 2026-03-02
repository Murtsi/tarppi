/**
 * Backend-local type definitions — mirrors shared/interfaces.ts
 * Kept local to avoid rootDir/cross-package import issues on Railway.
 */

// ─── Kide.app API Types ──────────────────────────────────────────────────────

export type KideVariant = {
  inventoryId: string
  name: string
  availability: number
  price?: number
  pricePerItem?: number
  dateProductVariantSalesFrom?: string | null
  productVariantMaximumReservableQuantity?: number
}

export type KideProductModel = {
  product: {
    name: string
    timeUntilSalesStart?: number
    dateSalesFrom?: string
    salesEnded?: boolean
    mediaFilename?: string
  }
  variants: KideVariant[]
  company?: unknown
  categories?: unknown[]
}

export type KideUser = {
  id: string
  firstName?: string
  lastName?: string
  email?: string
}

// ─── API Request/Response Types ──────────────────────────────────────────────

export type ReserveRequest = {
  variantId: string
  authorizationToken: string
  amount: number
  proxyUrl?: string
}

export type ReserveResponse = {
  success: boolean
  message: string
  retryWithQuantity?: number
}

export type EventRequest = {
  eventUrl: string
  proxyUrl?: string
}

export type EventResponse = {
  product: {
    name: string
    timeUntilSalesStart?: number
    dateSalesFrom?: string
    salesEnded?: boolean
    mediaFilename?: string
  }
  variants: KideVariant[]
}

export type ValidateTokenRequest = {
  token: string
  proxyUrl?: string
}

export type ValidateTokenResponse = {
  valid: boolean
  user?: KideUser
  info?: {
    email?: string
    expiresAt?: string // ISO date string
  }
}

export type DeobfuscateResponse = {
  hash: string | null
  headerKey: string | null
  extractedAt: string
  cached: boolean
}

// ─── Sales Status ────────────────────────────────────────────────────────────

export type SalesStatus = 'upcoming' | 'on_sale' | 'selling_fast' | 'almost_sold_out' | 'paused' | 'sold_out' | 'ended'

// ─── AI Reranker (ML model) Types ────────────────────────────────────────────

export type AiScore = {
  label: 'BUY' | 'MAYBE' | 'SKIP'
  buy_probability: number
  maybe_probability: number
  skip_probability: number
  model_version: string
}

// ─── AI Scorer Types ─────────────────────────────────────────────────────────

export type EventFeatures = {
  event_id: string
  name: string
  organiser?: string
  organiser_id?: string
  start_time?: string
  sales_start_time?: string
  base_price_eur?: number | null
  max_price_eur?: number | null
  likes_total?: number | null
  hours_since_published?: number | null
  availability_pct?: number | null // 0–100 percentage remaining
  tickets_total?: number | null
  tickets_sold_estimate?: number | null
  is_sold_out?: boolean
  sellout_minutes?: number | null
  sales_status?: SalesStatus
  city?: string | null
  category?: string | null
  media_url?: string | null
  // Legacy fields — still accepted for backward compat with /api/score
  organiser_historical_events?: number | null
  organiser_historical_sellout_rate?: number | null
  organiser_social_ig_post_likes?: number | null
  organiser_social_ig_post_comments?: number | null
}

export type ScoredEvent = {
  event_id: string
  name: string
  organiser?: string
  organiser_id?: string
  sales_status?: SalesStatus
  start_time?: string
  sales_start_time?: string
  base_price_eur?: number | null
  max_price_eur?: number | null
  likes_total?: number | null
  availability_pct?: number | null
  hours_since_published?: number | null
  city?: string | null
  media_url?: string | null
  resell_score: number
  decision: 'BUY' | 'MAYBE' | 'SKIP'
  should_trigger_ticket_bot: boolean
  reason: string
  feature_breakdown: {
    popularity: number
    demand: number
    pricing: number
    timing: number
    organiser: number
  }
  ai_score?: AiScore
}

export type TopEvent = {
  rank: number
  event_id: string
  name: string
  organiser?: string
  sales_status?: SalesStatus
  start_time?: string
  base_price_eur?: number | null
  likes_total?: number | null
  resell_score: number
  decision: 'BUY' | 'MAYBE' | 'SKIP'
  reason: string
  ai_score?: AiScore
}

export type ScorerResponse = {
  events: ScoredEvent[]
  top_10: TopEvent[]
  stats: {
    total: number
    buy_count: number
    maybe_count: number
    skip_count: number
    avg_score: number
  }
}

export type ScorerConfig = {
  weights: {
    popularity: number
    demand: number
    pricing: number
    timing: number
    organiser: number
  }
  thresholds: {
    buy: number
    maybe: number
  }
}

// ─── Kide.app Product Listing Types ──────────────────────────────────────────

export type KideListingProduct = {
  id: string
  productType: number // 1 = event, 2 = merch, 3 = membership
  companyName?: string
  companyId?: string
  name: string
  place?: string
  mediaFilename?: string
  dateSalesFrom?: string
  dateSalesUntil?: string
  dateActualFrom?: string
  dateActualUntil?: string
  datePublishFrom?: string
  maxPrice?: { eur?: number }
  minPrice?: { eur?: number }
  availability?: number // 0-100 percentage
  favoritedTimes?: number
  salesStarted?: boolean
  salesEnded?: boolean
  salesOngoing?: boolean
  salesPaused?: boolean
  hasFreeInventoryItems?: boolean
  hasInventoryItems?: boolean
  isLong?: boolean
  isActual?: boolean
}

export type KideProductListResponse = {
  model: KideListingProduct[]
}

// ─── Scan Request/Response Types ─────────────────────────────────────────────

export type ScanRequest = {
  city?: string
  productType?: number // default 1 (events)
  order?: string // e.g. 'favorited' to sort by most favorited
}

export type ScanResponse = ScorerResponse & {
  scanned_count: number
  filtered_count: number
  filtered_out_sold_out: number
  filtered_out_free: number
  city: string
}

// ─── Tiketti.fi Types ────────────────────────────────────────────────────────

export type TikettiEvent = {
  id: string
  title: string
  artist?: string
  venue: string
  city: string
  date: string              // ISO 8601
  price: number             // lowest price in EUR
  maxPrice?: number         // highest price if multiple
  availableCount?: number
  totalCount?: number
  url: string
  imageUrl?: string
  source: 'tiketti'
  fetchedAt: string         // ISO 8601 timestamp
}

// ─── Tiketti Sniper Types ────────────────────────────────────────────────────

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
  ticketsFree?: number
  ticketsTotal?: number
  soldOut?: boolean
  cancelled?: boolean
  ageInfo?: string
  timeInfo?: string
  endDate?: string
}

export type TikettiEventRequest = {
  eventUrl: string
}

export type TikettiEventResponse = {
  success: boolean
  event?: TikettiEventDetail
  error?: string
}

export type TikettiReserveRequest = {
  eventUrl: string
  quantity: number
  sessionCookie: string
}

export type TikettiReserveResponse = {
  success: boolean
  message: string
}
