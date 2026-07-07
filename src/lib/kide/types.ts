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
  retryAfterMs?: number
}

export type ValidateTokenResponse = {
  valid: boolean
  user?: KideUser
  info?: {
    email?: string
    expiresAt?: string
  }
}

export type ConnectionValuesResponse = {
  hash: string
  headerKey: string
  extractedAt: string
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

export type BackendServiceStatus = 'ok' | 'degraded' | 'disabled' | 'error'

export type BackendHealthResponse = {
  status: 'ok' | 'degraded'
  timestamp: string
  services: {
    database: {
      configured: boolean
      status: BackendServiceStatus
    }
    ai: {
      configured: boolean
      status: BackendServiceStatus
    }
  }
}

// ─── Server-side Snipe Job Types ─────────────────────────────────────────────

export type SnipeJobStatus = 'scheduled' | 'firing' | 'success' | 'failed' | 'cancelled'

export type SnipeJobResponse = {
  jobId: string
  status: SnipeJobStatus
  attempts: number
  quantity?: number
  variantIds?: string[]
  scheduledFor?: number | null   // epoch ms
  firedAt?: number | null
  completedAt?: number | null
  lastAttemptAt?: number | null
  message?: string | null
  result?: ReserveResponse | null
}

export type CreateSnipeJobResponse = {
  success: boolean
  jobId: string
  variantIds?: string[]
  scheduledFor?: number | null
  status: SnipeJobStatus
}

// ─── Event Discussion ────────────────────────────────────────────────────────

/** Finnish-language sections returned by POST /api/discuss */
export type DiscussSections = {
  suosio?: string
  hinta?: string
  ajoitus?: string
  järjestäjä?: string
  trendi?: string
  yhteenveto?: string
}

export type DiscussResponse = {
  sections: DiscussSections
  generated_at: string
}
