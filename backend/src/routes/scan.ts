/**
 * POST /api/scan -- Scrape events from Kide.app by city, extract features, and score them.
 *
 * Fetches the public product listing, filters by city and productType,
 * maps raw Kide data to EventFeatures, and runs the scorer.
 *
 * Filtering logic:
 *   - REMOVE: events where sales have ended (salesEnded === true)
 *   - REMOVE: sold-out events (availability === 0 AND salesStarted === true)
 *   - KEEP:   events with upcoming sales (even if availability === 0, sales not started)
 *   - KEEP:   events with active/paused sales
 */
import { Router } from 'express'
import { z } from 'zod'
import { fetchAllProducts } from '../kide-api.js'
import { scoreEvents } from '../scorer.js'
import { rerankEvents } from '../ai-reranker.js'
import type { KideListingProduct, EventFeatures, SalesStatus, ScanResponse } from '../types.js'

export const scanRouter = Router()

// ─── Simple TTL cache for scan results (prevents hammering Kide API) ────────

const SCAN_CACHE_TTL_MS = 45_000 // 45 seconds
const scanCache = new Map<string, { data: ScanResponse; timestamp: number }>()

function getCachedScan(key: string): ScanResponse | null {
  const entry = scanCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > SCAN_CACHE_TTL_MS) {
    scanCache.delete(key)
    return null
  }
  return entry.data
}

function setCachedScan(key: string, data: ScanResponse): void {
  scanCache.set(key, { data, timestamp: Date.now() })
  // Evict old entries (keep max 20)
  if (scanCache.size > 20) {
    const oldest = scanCache.keys().next().value
    if (oldest) scanCache.delete(oldest)
  }
}

const scanSchema = z.object({
  city: z.string().max(100).optional().default(''),
  productType: z.number().int().min(1).max(10).optional().default(1),
  order: z.string().max(50).optional(),
})

/**
 * Determine the sales status of a product from its listing flags.
 */
export function deriveSalesStatus(product: KideListingProduct): SalesStatus {
  if (product.salesEnded) return 'ended'

  // Not started yet
  if (!product.salesStarted) return 'upcoming'

  // Sold out (sales started but availability is 0)
  if (product.availability === 0) return 'sold_out'

  // Sales paused
  if (product.salesPaused) return 'paused'

  // Active sales - check how much is left
  if (product.salesOngoing) {
    if (product.availability !== undefined && product.availability !== null) {
      if (product.availability <= 5) return 'almost_sold_out'
      if (product.availability <= 30) return 'selling_fast'
    }
    return 'on_sale'
  }

  return 'on_sale'
}

/**
 * Map a Kide.app listing product to our scorer EventFeatures format.
 */
export function mapToEventFeatures(product: KideListingProduct): EventFeatures {
  const now = new Date()

  // Calculate hours since published
  let hoursSincePublished: number | null = null
  if (product.datePublishFrom) {
    const published = new Date(product.datePublishFrom)
    hoursSincePublished = Math.max(0, (now.getTime() - published.getTime()) / (1000 * 60 * 60))
    hoursSincePublished = Math.round(hoursSincePublished * 10) / 10
  }

  // Price in EUR (API returns cents)
  const basePriceEur = product.minPrice?.eur != null
    ? product.minPrice.eur / 100
    : null
  const maxPriceEur = product.maxPrice?.eur != null
    ? product.maxPrice.eur / 100
    : null

  const salesStatus = deriveSalesStatus(product)

  return {
    event_id: product.id,
    name: product.name,
    organiser: product.companyName ?? undefined,
    organiser_id: product.companyId ?? undefined,
    start_time: product.dateActualFrom ?? undefined,
    sales_start_time: product.dateSalesFrom ?? undefined,
    base_price_eur: basePriceEur,
    max_price_eur: maxPriceEur,
    likes_total: product.favoritedTimes ?? 0,
    hours_since_published: hoursSincePublished,
    availability_pct: product.availability ?? null,
    is_sold_out: product.availability === 0 && product.salesStarted === true,
    sales_status: salesStatus,
    city: product.place ?? null,
    media_url: product.mediaFilename ?? null,
  }
}

/**
 * Check if an event should be filtered OUT.
 * Returns true if the event should be REMOVED from results.
 */
export function shouldFilterOut(product: KideListingProduct): boolean {
  // Always remove events where sales have ended
  if (product.salesEnded) return true

  // Remove sold-out events (sales already started and no availability)
  if (product.availability === 0 && product.salesStarted === true) return true

  // Keep everything else: upcoming, active, paused, etc.
  return false
}

/**
 * Check if an event is free (all ticket options are €0).
 */
export function isFreeEvent(product: KideListingProduct): boolean {
  // If max price is 0 or not set, and the event has free inventory items → free
  const maxPriceEur = product.maxPrice?.eur ?? 0
  if (maxPriceEur === 0 && product.hasFreeInventoryItems) return true
  // Also filter if both min and max are explicitly 0
  const minPriceEur = product.minPrice?.eur ?? 0
  if (maxPriceEur === 0 && minPriceEur === 0) return true
  return false
}

scanRouter.post('/scan', async (req, res) => {
  try {
    const parsed = scanSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      })
      return
    }

    const { city, productType, order } = parsed.data
    const filterCity = city.trim()
    const filterType = productType
    const sortOrder = order ?? undefined

    // Check cache first
    const cacheKey = `${filterCity}|${filterType}|${sortOrder || ''}`
    const cached = getCachedScan(cacheKey)
    if (cached) {
      console.log(`[/api/scan] Cache hit for "${cacheKey}"`)
      res.json(cached)
      return
    }

    console.log(`[/api/scan] Scanning city="${filterCity || 'ALL'}", type=${filterType}, order=${sortOrder || 'default'}`)

    // Fetch products from Kide.app with server-side city + type filtering
    const allProducts = await fetchAllProducts(filterCity || undefined, filterType, sortOrder)
    console.log(`[/api/scan] Fetched ${allProducts.length} products from Kide API`)

    // Filter: remove sold-out and ended events, keep upcoming
    const soldOutCount = allProducts.filter((p) => shouldFilterOut(p)).length
    const afterSoldOut = allProducts.filter((p) => !shouldFilterOut(p))

    // Filter: remove free events (no resell value)
    const freeCount = afterSoldOut.filter((p) => isFreeEvent(p)).length
    const filtered = afterSoldOut.filter((p) => !isFreeEvent(p))

    console.log(`[/api/scan] After filtering: ${filtered.length} events (removed ${soldOutCount} sold-out/ended, ${freeCount} free)`)

    if (filtered.length === 0) {
      const result: ScanResponse = {
        events: [],
        top_10: [],
        stats: { total: 0, buy_count: 0, maybe_count: 0, skip_count: 0, avg_score: 0 },
        scanned_count: allProducts.length,
        filtered_count: 0,
        filtered_out_sold_out: soldOutCount,
        filtered_out_free: freeCount,
        city: filterCity || 'ALL',
      }
      res.json(result)
      return
    }

    // Map to EventFeatures
    const features = filtered.map(mapToEventFeatures)

    // Log some stats about the data we have
    const withLikes = features.filter((f) => (f.likes_total ?? 0) > 0).length
    const withPrices = features.filter((f) => (f.base_price_eur ?? 0) > 0).length
    const upcoming = features.filter((f) => f.sales_status === 'upcoming').length
    console.log(`[/api/scan] Data quality: ${withLikes}/${features.length} have likes, ${withPrices} have prices, ${upcoming} upcoming`)

    // Score them
    const scored = scoreEvents(features)

    // AI reranking — enrich with ML model scores (graceful fallback)
    const rerankedEvents = await rerankEvents(scored.events)

    // Rebuild top 10 from reranked order
    const top10 = rerankedEvents.slice(0, 10).map((ev, i) => ({
      rank: i + 1,
      event_id: ev.event_id,
      name: ev.name,
      organiser: ev.organiser,
      sales_status: ev.sales_status,
      start_time: ev.start_time,
      base_price_eur: ev.base_price_eur,
      likes_total: ev.likes_total,
      resell_score: ev.resell_score,
      decision: ev.decision,
      reason: ev.reason,
      ai_score: ev.ai_score,
    }))

    // Recompute stats from reranked events
    const aiLabelOf = (ev: (typeof rerankedEvents)[0]) => ev.ai_score?.label ?? ev.decision
    const aiStats = {
      total: rerankedEvents.length,
      buy_count: rerankedEvents.filter((e) => aiLabelOf(e) === 'BUY').length,
      maybe_count: rerankedEvents.filter((e) => aiLabelOf(e) === 'MAYBE').length,
      skip_count: rerankedEvents.filter((e) => aiLabelOf(e) === 'SKIP').length,
      avg_score: scored.stats.avg_score, // Heuristic avg stays the same
    }

    const result: ScanResponse = {
      events: rerankedEvents,
      top_10: top10,
      stats: aiStats,
      scanned_count: allProducts.length,
      filtered_count: filtered.length,
      filtered_out_sold_out: soldOutCount,
      filtered_out_free: freeCount,
      city: filterCity || 'ALL',
    }

    setCachedScan(cacheKey, result)
    res.json(result)
  } catch (error) {
    console.error('[/api/scan] Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scan failed',
    })
  }
})
