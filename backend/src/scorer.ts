/**
 * Scorer Engine � Adaptive weighted scoring for event demand/resell potential.
 *
 * Key design principles:
 *   1. Only score based on data that IS available (no penalty for missing fields)
 *   2. Use percentile-based relative scoring within the batch
 *   3. Favorited count (likes_total) is the strongest signal from the listing API
 *   4. Events with upcoming sales get a boost (prime sniping targets)
 *
 * Decision thresholds:
 *   >= 65 -> BUY   (strong indicators - worth sniping)
 *   >= 40 -> MAYBE (moderate potential)
 *   <  40 -> SKIP  (low interest)
 */
import type { EventFeatures, ScoredEvent, ScorerResponse, ScorerConfig } from './types.js'

// --- Default config ---

const DEFAULT_CONFIG: ScorerConfig = {
  weights: {
    popularity: 0.35,     // favorites / likes - strongest available signal
    demand: 0.25,         // availability / sell-through rate
    pricing: 0.15,        // price positioning relative to batch
    timing: 0.15,         // sales upcoming + event timing urgency
    organiser: 0.10,      // known organiser bonus
  },
  thresholds: {
    buy: 65,
    maybe: 40,
  },
}

// --- Utility: percentile rank within a pre-sorted batch ---

function percentileRank(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 50
  // Binary search to find position
  let lo = 0, hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] < value) lo = mid + 1
    else hi = mid
  }
  const below = lo
  let equal = 0
  while (lo + equal < sorted.length && sorted[lo + equal] === value) equal++
  return ((below + equal * 0.5) / sorted.length) * 100
}

// --- Feature scoring functions (each returns 0-100) ---

/**
 * Popularity score: combines absolute like benchmarks with batch-relative percentile.
 * This is the most reliable signal from the listing API.
 */
function scorePopularity(
  event: EventFeatures,
  batchLikes: number[],
): { score: number; available: boolean } {
  const likes = event.likes_total ?? 0

  // No likes data at all - not available
  if (likes <= 0 && (event.likes_total === null || event.likes_total === undefined)) {
    return { score: 0, available: false }
  }

  // Absolute benchmarks (calibrated for Finnish Kide.app scene)
  let absoluteScore: number
  if (likes >= 500) absoluteScore = 100
  else if (likes >= 300) absoluteScore = 90
  else if (likes >= 150) absoluteScore = 80
  else if (likes >= 80) absoluteScore = 70
  else if (likes >= 40) absoluteScore = 60
  else if (likes >= 20) absoluteScore = 50
  else if (likes >= 10) absoluteScore = 40
  else if (likes >= 5) absoluteScore = 30
  else if (likes >= 1) absoluteScore = 20
  else absoluteScore = 10

  // Percentile within batch
  const pctRank = percentileRank(batchLikes, likes)

  // Blend: 40% absolute benchmark, 60% batch percentile
  const score = Math.round(absoluteScore * 0.4 + pctRank * 0.6)
  return { score: Math.min(100, Math.max(0, score)), available: true }
}

/**
 * Demand score: based on how many tickets are sold / availability remaining.
 * Lower availability = higher demand signal.
 */
function scoreDemand(event: EventFeatures): { score: number; available: boolean } {
  const availability = event.availability_pct ?? null
  const salesStatus = event.sales_status

  // If we have availability percentage
  if (availability !== null && availability !== undefined) {
    // Upcoming events with no sales yet - neutral demand (cant measure yet)
    if (salesStatus === 'upcoming') {
      return { score: 50, available: true }
    }

    const soldPct = 100 - availability

    let score: number
    if (soldPct >= 95) score = 100
    else if (soldPct >= 80) score = 90
    else if (soldPct >= 60) score = 75
    else if (soldPct >= 40) score = 60
    else if (soldPct >= 20) score = 45
    else if (soldPct >= 5) score = 30
    else score = 15

    return { score, available: true }
  }

  // Legacy: use is_sold_out / tickets data
  if (event.is_sold_out) {
    const selloutMin = event.sellout_minutes
    if (selloutMin !== null && selloutMin !== undefined && selloutMin > 0) {
      if (selloutMin <= 1) return { score: 100, available: true }
      if (selloutMin <= 5) return { score: 90, available: true }
      if (selloutMin <= 15) return { score: 75, available: true }
      if (selloutMin <= 60) return { score: 60, available: true }
    }
    return { score: 70, available: true }
  }

  if (event.tickets_total && event.tickets_sold_estimate) {
    const sellThrough = event.tickets_sold_estimate / event.tickets_total
    return { score: Math.round(sellThrough * 80), available: true }
  }

  return { score: 0, available: false }
}

/**
 * Pricing score: events in the sweet spot price range score highest.
 * Very cheap = low resell margin, very expensive = harder to move.
 */
function scorePricing(
  event: EventFeatures,
  batchMedianPrice: number,
): { score: number; available: boolean } {
  const price = event.base_price_eur ?? null
  if (price === null || price === undefined) return { score: 0, available: false }

  if (price <= 0) return { score: 20, available: true } // Free events - low resell value

  const median = batchMedianPrice || 15

  // Score based on absolute price tiers (Finnish event market)
  let absoluteScore: number
  if (price >= 10 && price <= 80) absoluteScore = 80      // Sweet spot
  else if (price >= 5 && price <= 120) absoluteScore = 65  // Decent range
  else if (price >= 3 && price <= 200) absoluteScore = 50  // Acceptable
  else if (price > 200) absoluteScore = 35                 // Premium - harder to resell
  else absoluteScore = 25                                  // Very cheap

  // Relative to batch median
  const ratio = price / median
  let relativeBonus = 0
  if (ratio >= 0.5 && ratio <= 2.0) relativeBonus = 15    // Near median = most liquid
  else if (ratio >= 0.3 && ratio <= 3.0) relativeBonus = 5

  // Price spread bonus (max - base indicates tiered demand)
  const maxPrice = event.max_price_eur ?? price
  const spread = maxPrice - price
  let spreadBonus = 0
  if (spread > 30) spreadBonus = 10
  else if (spread > 15) spreadBonus = 7
  else if (spread > 5) spreadBonus = 3

  const score = Math.min(100, absoluteScore + relativeBonus + spreadBonus)
  return { score, available: true }
}

/**
 * Timing score: events with upcoming sales are prime sniping targets.
 * Events happening soon with active sales also score well.
 */
function scoreTiming(event: EventFeatures): { score: number; available: boolean } {
  const salesStatus = event.sales_status
  const startTime = event.start_time
  const salesStartTime = event.sales_start_time

  let score = 50 // Neutral baseline
  let hasData = false

  // Sales status is the most relevant timing signal
  if (salesStatus) {
    hasData = true
    switch (salesStatus) {
      case 'upcoming':
        score = 90  // Prime target - sales havent started yet
        break
      case 'on_sale':
        score = 70  // Active sales - still worth sniping
        break
      case 'selling_fast':
        score = 85  // High demand, selling fast
        break
      case 'almost_sold_out':
        score = 80  // Urgency signal
        break
      case 'paused':
        score = 60  // Paused - might resume, watch it
        break
      default:
        score = 50
    }
  }

  // Upcoming sales boost: if sales start in the future
  if (salesStartTime) {
    hasData = true
    const now = new Date()
    const salesStart = new Date(salesStartTime)
    const hoursUntilSales = (salesStart.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilSales > 0 && hoursUntilSales <= 2) {
      score = Math.max(score, 95)  // Sales starting very soon!
    } else if (hoursUntilSales > 0 && hoursUntilSales <= 24) {
      score = Math.max(score, 85)  // Within a day
    } else if (hoursUntilSales > 0 && hoursUntilSales <= 72) {
      score = Math.max(score, 75)  // Within 3 days
    }
  }

  // Event date proximity: events happening soon are more urgent
  if (startTime) {
    hasData = true
    const now = new Date()
    const eventDate = new Date(startTime)
    const daysUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    if (daysUntilEvent > 0 && daysUntilEvent <= 7) {
      score = Math.min(100, score + 10) // Happening this week
    } else if (daysUntilEvent > 0 && daysUntilEvent <= 30) {
      score = Math.min(100, score + 5)  // Within a month
    }
  }

  return { score, available: hasData }
}

/**
 * Organiser score: known organisers with names get a baseline bonus.
 * If an organiser ID exists, it means they have a Kide.app company page.
 */
function scoreOrganiser(event: EventFeatures): { score: number; available: boolean } {
  const name = event.organiser
  const orgId = event.organiser_id

  // Legacy enriched data (from /api/score endpoint)
  const historicalEvents = event.organiser_historical_events ?? null
  const selloutRate = event.organiser_historical_sellout_rate ?? null

  // If we have enriched historical data, use it
  if (historicalEvents !== null && historicalEvents > 0) {
    let score = 0
    if (selloutRate !== null) {
      score += Math.round(selloutRate * 60)
    }
    if (historicalEvents >= 20) score += 25
    else if (historicalEvents >= 10) score += 20
    else if (historicalEvents >= 5) score += 15
    else score += 5
    return { score: Math.min(100, score), available: true }
  }

  // Basic organiser recognition from listing data
  if (!name && !orgId) return { score: 0, available: false }

  let score = 40 // Has a named organiser - baseline

  // Having a company ID means theyre registered on Kide.app
  if (orgId) score += 15

  // Named organiser bonus
  if (name && name.trim().length > 0) {
    score += 10
    // Longer/more detailed names suggest established organisations
    if (name.length > 15) score += 5
  }

  return { score: Math.min(100, score), available: true }
}

// --- Adaptive weight redistribution ---

type FeatureResult = {
  key: string
  score: number
  available: boolean
  baseWeight: number
}

function computeAdaptiveScore(features: FeatureResult[]): number {
  const available = features.filter((f) => f.available)
  const unavailable = features.filter((f) => !f.available)

  if (available.length === 0) return 30 // No data at all - give a neutral score

  // Total weight to redistribute from unavailable features
  const redistributeWeight = unavailable.reduce((sum, f) => sum + f.baseWeight, 0)
  const availableWeight = available.reduce((sum, f) => sum + f.baseWeight, 0)

  // Each available feature gets a proportional share of the redistributed weight
  let totalScore = 0
  for (const f of available) {
    const adjustedWeight = f.baseWeight + (f.baseWeight / availableWeight) * redistributeWeight
    totalScore += f.score * adjustedWeight
  }

  return Math.round(totalScore * 10) / 10
}

// --- Main scoring function ---

function scoreEvent(
  event: EventFeatures,
  batchLikes: number[],
  batchMedianPrice: number,
  config: ScorerConfig,
): ScoredEvent {
  const w = config.weights

  const popularity = scorePopularity(event, batchLikes)
  const demand = scoreDemand(event)
  const pricing = scorePricing(event, batchMedianPrice)
  const timing = scoreTiming(event)
  const organiser = scoreOrganiser(event)

  const features: FeatureResult[] = [
    { key: 'popularity', score: popularity.score, available: popularity.available, baseWeight: w.popularity },
    { key: 'demand', score: demand.score, available: demand.available, baseWeight: w.demand },
    { key: 'pricing', score: pricing.score, available: pricing.available, baseWeight: w.pricing },
    { key: 'timing', score: timing.score, available: timing.available, baseWeight: w.timing },
    { key: 'organiser', score: organiser.score, available: organiser.available, baseWeight: w.organiser },
  ]

  const resell_score = computeAdaptiveScore(features)

  // Decision
  let decision: 'BUY' | 'MAYBE' | 'SKIP'
  if (resell_score >= config.thresholds.buy) decision = 'BUY'
  else if (resell_score >= config.thresholds.maybe) decision = 'MAYBE'
  else decision = 'SKIP'

  // Generate reason
  const reason = generateReason(event, {
    popularity: popularity.score,
    demand: demand.score,
    pricing: pricing.score,
    timing: timing.score,
    organiser: organiser.score,
  }, resell_score, decision)

  return {
    event_id: event.event_id,
    name: event.name,
    organiser: event.organiser,
    organiser_id: event.organiser_id,
    sales_status: event.sales_status,
    start_time: event.start_time,
    sales_start_time: event.sales_start_time,
    base_price_eur: event.base_price_eur,
    max_price_eur: event.max_price_eur,
    likes_total: event.likes_total,
    availability_pct: event.availability_pct,
    hours_since_published: event.hours_since_published,
    city: event.city,
    media_url: event.media_url,
    resell_score,
    decision,
    should_trigger_ticket_bot: decision === 'BUY' || (decision === 'MAYBE' && event.sales_status === 'upcoming'),
    reason,
    feature_breakdown: {
      popularity: popularity.score,
      demand: demand.score,
      pricing: pricing.score,
      timing: timing.score,
      organiser: organiser.score,
    },
  }
}

// --- Reason generation ---

function generateReason(
  event: EventFeatures,
  scores: Record<string, number>,
  totalScore: number,
  decision: string,
): string {
  const parts: string[] = []

  // Popularity
  const likes = event.likes_total ?? 0
  if (scores.popularity >= 80) {
    parts.push(`${likes} favorites - very popular`)
  } else if (scores.popularity >= 60) {
    parts.push(`${likes} favorites - good interest`)
  } else if (likes > 0 && scores.popularity >= 40) {
    parts.push(`${likes} favorites - moderate interest`)
  } else if (likes === 0) {
    parts.push('no favorites yet')
  }

  // Demand
  if (event.sales_status === 'upcoming') {
    parts.push('sales opening soon')
  } else if (scores.demand >= 80) {
    parts.push('high demand - selling fast')
  } else if (scores.demand >= 60) {
    parts.push('good sell-through')
  } else if (event.availability_pct !== null && event.availability_pct !== undefined) {
    const soldPct = 100 - (event.availability_pct ?? 100)
    if (soldPct > 0) parts.push(`${soldPct}% sold`)
  }

  // Timing
  if (event.sales_start_time) {
    const now = new Date()
    const salesStart = new Date(event.sales_start_time)
    const hoursUntil = (salesStart.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (hoursUntil > 0 && hoursUntil <= 24) {
      parts.push(`sales start in ${Math.round(hoursUntil)}h`)
    }
  }

  // Price
  if (event.base_price_eur && event.base_price_eur > 0) {
    if (scores.pricing >= 70) {
      parts.push(`EUR${event.base_price_eur} - good price point`)
    }
  } else if (event.base_price_eur === 0) {
    parts.push('free event')
  }

  // Organiser
  if (event.organiser && scores.organiser >= 50) {
    parts.push(`by ${event.organiser}`)
  }

  if (parts.length === 0) {
    if (decision === 'BUY') return `Score ${totalScore} — multiple signals suggest strong demand.`
    if (decision === 'MAYBE') return `Score ${totalScore} — some potential, worth watching.`
    return 'Limited data available.'
  }

  // Capitalize first part, join the rest
  const joined = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) +
    (parts.length > 1 ? ', ' + parts.slice(1).join(', ') : '') + '.'

  return joined
}

// --- Public API ---

export function scoreEvents(
  events: EventFeatures[],
  configOverrides?: Partial<ScorerConfig>,
): ScorerResponse {
  const config: ScorerConfig = {
    weights: { ...DEFAULT_CONFIG.weights, ...configOverrides?.weights },
    thresholds: { ...DEFAULT_CONFIG.thresholds, ...configOverrides?.thresholds },
  }

  // Precompute batch statistics for relative scoring
  const batchLikes = events
    .map((e) => e.likes_total ?? 0)
    .filter((l) => l >= 0)
    .sort((a, b) => a - b) // Pre-sort once for percentileRank binary search

  const prices = events
    .map((e) => e.base_price_eur ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b)

  const batchMedianPrice = prices.length > 0
    ? prices[Math.floor(prices.length / 2)]
    : 15

  console.log(`[Scorer] Scoring ${events.length} events (median price: EUR${batchMedianPrice}, max likes: ${Math.max(0, ...batchLikes)})`)

  const scored = events.map((e) => scoreEvent(e, batchLikes, batchMedianPrice, config))

  // Sort by score descending
  const sorted = [...scored].sort((a, b) => b.resell_score - a.resell_score)
  const top_10 = sorted.slice(0, 10).map((e, i) => ({
    rank: i + 1,
    event_id: e.event_id,
    name: e.name,
    organiser: e.organiser,
    sales_status: e.sales_status,
    start_time: e.start_time,
    base_price_eur: e.base_price_eur,
    likes_total: e.likes_total,
    resell_score: e.resell_score,
    decision: e.decision,
    reason: e.reason,
  }))

  const stats = {
    total: scored.length,
    buy_count: scored.filter((e) => e.decision === 'BUY').length,
    maybe_count: scored.filter((e) => e.decision === 'MAYBE').length,
    skip_count: scored.filter((e) => e.decision === 'SKIP').length,
    avg_score: Math.round((scored.reduce((sum, e) => sum + e.resell_score, 0) / scored.length) * 10) / 10 || 0,
  }

  console.log(`[Scorer] Results: ${stats.buy_count} BUY, ${stats.maybe_count} MAYBE, ${stats.skip_count} SKIP (avg: ${stats.avg_score})`)

  return { events: scored, top_10, stats }
}
