/**
 * Types used by the frontend — mirrors shared/interfaces.ts
 * but kept local to avoid cross-package import issues with Vercel.
 */

export type KideVariant = {
  inventoryId: string
  name: string
  availability: number
  price?: number
  pricePerItem?: number
  dateProductVariantSalesFrom?: string | null
  productVariantMaximumReservableQuantity?: number
}

export type KideUser = {
  id: string
  firstName?: string
  lastName?: string
  email?: string
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

export type ReserveResponse = {
  success: boolean
  message: string
  retryWithQuantity?: number
}

export type ValidateTokenResponse = {
  valid: boolean
  user?: KideUser
  info?: {
    email?: string
    expiresAt?: string
  }
}

export type BackendStatusResponse = {
  ready: boolean
  cached: boolean
}

// ─── Sales Status ────────────────────────────────────────────────────────────

export type SalesStatus = 'upcoming' | 'on_sale' | 'selling_fast' | 'almost_sold_out' | 'paused' | 'sold_out' | 'ended'

// ─── AI Score Types ──────────────────────────────────────────────────────────

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
  availability_pct?: number | null
  tickets_total?: number | null
  tickets_sold_estimate?: number | null
  is_sold_out?: boolean
  sellout_minutes?: number | null
  sales_status?: SalesStatus
  city?: string | null
  category?: string | null
  media_url?: string | null
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

// ─── Scan Types ──────────────────────────────────────────────────────────────

export type ScanResponse = ScorerResponse & {
  scanned_count: number
  filtered_count: number
  filtered_out_sold_out: number
  filtered_out_free: number
  city: string
}

// ─── Tiketti Types ───────────────────────────────────────────────────────────

export type TikettiEvent = {
  id: string
  title: string
  artist?: string
  venue: string
  city: string
  date: string
  price: number
  maxPrice?: number
  availableCount?: number
  totalCount?: number
  url: string
  imageUrl?: string
  source: 'tiketti'
  fetchedAt: string
}

export type TikettiEventsResponse = {
  success: boolean
  events: TikettiEvent[]
  count: number
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export type AuthLoginResponse = {
  token: string
  expiresIn: string
}

export type AuthVerifyResponse = {
  valid: boolean
  user?: string
  expiresAt?: string
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

export type TikettiEventResponse = {
  success: boolean
  event?: TikettiEventDetail
  error?: string
}

export type TikettiReserveResponse = {
  success: boolean
  message: string
}

// ─── Tiketti Browser Automation Types ────────────────────────────────────────

export type TikettiBrowserSessionStatus =
  | 'launching'
  | 'navigating'
  | 'queue-it'
  | 'ready'
  | 'buying'
  | 'success'
  | 'failed'
  | 'closed'

export type TikettiBrowserSSEEvent = {
  sessionId: string
  status: TikettiBrowserSessionStatus
  message: string
  done?: boolean
}

export type TikettiBrowserBuyResponse = {
  success: boolean
  message: string
}

export type TikettiBrowserSessionInfo = {
  id: string
  eventId: string
  status: TikettiBrowserSessionStatus
  statusMessage: string
  createdAt: number
}
