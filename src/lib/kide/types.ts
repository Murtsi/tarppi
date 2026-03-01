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

export type DeobfuscateResponse = {
  hash: string | null
  headerKey: string | null
  extractedAt: string
  cached: boolean
}

// ─── AI Scorer Types ─────────────────────────────────────────────────────────

export type EventFeatures = {
  event_id: string
  name: string
  organiser?: string
  start_time?: string
  base_price_eur?: number | null
  max_price_eur?: number | null
  likes_total?: number | null
  hours_since_published?: number | null
  tickets_total?: number | null
  tickets_sold_estimate?: number | null
  is_sold_out?: boolean
  sellout_minutes?: number | null
  city?: string | null
  category?: string | null
  organiser_historical_events?: number | null
  organiser_historical_sellout_rate?: number | null
  organiser_social_ig_post_likes?: number | null
  organiser_social_ig_post_comments?: number | null
}

export type ScoredEvent = {
  event_id: string
  name: string
  resell_score: number
  decision: 'BUY' | 'MAYBE' | 'SKIP'
  should_trigger_ticket_bot: boolean
  reason: string
  feature_breakdown: {
    likes_velocity: number
    sellout_dynamics: number
    price_attractiveness: number
    organiser_track_record: number
    social_proof: number
    data_completeness: number
  }
}

export type TopEvent = {
  rank: number
  event_id: string
  name: string
  resell_score: number
  decision: 'BUY' | 'MAYBE' | 'SKIP'
  reason: string
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
