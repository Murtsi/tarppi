/**
 * Background poller — periodically snapshots Kide.app event data.
 *
 * Runs on a configurable interval (default 15 min). For each configured city
 * it fetches the public event listing, converts to features, and persists
 * a snapshot row per event to event_snapshots.
 *
 * Environment:
 *   POLL_INTERVAL_MS — polling interval in milliseconds (default: 900000 = 15 min)
 *   POLL_CITIES      — comma-separated list of Kide cities (default: "")
 *                      Empty string = fetch all products without city filter.
 */

import { fetchAllProducts } from './kide-api.js'
import { mapToEventFeatures } from './routes/scan.js'
import { insertSnapshots, type SnapshotRow } from './db.js'
import { runLabeler } from './labeler.js'
import type { KideListingProduct } from './types.js'

function safeParseInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const POLL_INTERVAL_MS = safeParseInt(process.env.POLL_INTERVAL_MS, 900_000)
const LABEL_INTERVAL_MS = safeParseInt(process.env.LABEL_INTERVAL_MS, 21_600_000) // default 6 hours
const POLL_CITIES = (process.env.POLL_CITIES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

let pollTimer: ReturnType<typeof setInterval> | null = null
let labelTimer: ReturnType<typeof setInterval> | null = null
let isPolling = false

/**
 * Convert a KideListingProduct to a SnapshotRow for DB storage.
 */
function toSnapshotRow(product: KideListingProduct): SnapshotRow {
  const features = mapToEventFeatures(product)
  return {
    event_id: features.event_id,
    name: features.name,
    organiser: features.organiser ?? null,
    organiser_id: features.organiser_id ?? null,
    city: features.city ?? null,
    sales_status: features.sales_status ?? null,
    availability_pct: features.availability_pct ?? null,
    likes_total: features.likes_total ?? null,
    base_price_eur: features.base_price_eur ?? null,
    max_price_eur: features.max_price_eur ?? null,
    start_time: features.start_time ?? null,
    sales_start_time: features.sales_start_time ?? null,
    hours_since_published: features.hours_since_published ?? null,
    media_url: features.media_url ?? null,
  }
}

/**
 * Run a single poll cycle: fetch products for all configured cities and save snapshots.
 */
async function pollOnce(): Promise<void> {
  if (isPolling) {
    console.log('[poller] Previous poll still running, skipping')
    return
  }

  isPolling = true
  const startTime = Date.now()

  try {
    // If no cities configured, do a single global fetch
    const cities = POLL_CITIES.length > 0 ? POLL_CITIES : [undefined]
    let totalProducts = 0
    let totalInserted = 0

    for (const city of cities) {
      try {
        const cityLabel = city ?? 'ALL'
        const products = await fetchAllProducts(city, 1) // productType=1 (events)
        totalProducts += products.length

        if (products.length === 0) {
          console.log(`[poller] ${cityLabel}: 0 products`)
          continue
        }

        // Convert to snapshot rows — include ALL products (even sold-out)
        // for accurate sell-through tracking
        const rows = products.map(toSnapshotRow)
        const inserted = await insertSnapshots(rows)
        totalInserted += inserted

        console.log(`[poller] ${cityLabel}: ${products.length} products → ${inserted} snapshots`)
      } catch (err) {
        const cityLabel = city ?? 'ALL'
        console.error(`[poller] Error fetching ${cityLabel}:`, err instanceof Error ? err.message : err)
      }
    }

    const elapsed = Date.now() - startTime
    console.log(`[poller] Cycle complete: ${totalInserted} snapshots from ${totalProducts} products (${elapsed}ms)`)
  } catch (err) {
    console.error('[poller] Unexpected error:', err instanceof Error ? err.message : err)
  } finally {
    isPolling = false
  }
}

/**
 * Start the background polling loop and labeler schedule.
 */
export function startPoller(): void {
  if (!process.env.DATABASE_URL) {
    console.log('[poller] DATABASE_URL not set, poller disabled')
    return
  }

  console.log(`[poller] Starting with interval=${POLL_INTERVAL_MS}ms, cities=[${POLL_CITIES.join(', ') || 'ALL'}]`)
  console.log(`[labeler] Auto-label interval=${LABEL_INTERVAL_MS}ms (${(LABEL_INTERVAL_MS / 3600000).toFixed(1)}h)`)

  // Run first poll immediately (with small delay to let server start)
  setTimeout(() => {
    pollOnce().catch((err) => console.error('[poller] Initial poll error:', err))
  }, 5_000)

  // Then on interval
  pollTimer = setInterval(() => {
    pollOnce().catch((err) => console.error('[poller] Poll error:', err))
  }, POLL_INTERVAL_MS)

  // Run labeler after initial data collection (2 min delay to allow first snapshots)
  setTimeout(() => {
    runLabeler().catch((err) => console.error('[labeler] Initial label error:', err))
  }, 120_000)

  // Then on interval (default every 6 hours)
  labelTimer = setInterval(() => {
    console.log('[labeler] Scheduled auto-label run starting...')
    runLabeler().catch((err) => console.error('[labeler] Scheduled label error:', err))
  }, LABEL_INTERVAL_MS)
}

/**
 * Stop the background polling loop and labeler schedule.
 */
export function stopPoller(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[poller] Stopped')
  }
  if (labelTimer) {
    clearInterval(labelTimer)
    labelTimer = null
    console.log('[labeler] Stopped')
  }
}

/**
 * Trigger a single manual poll (for admin endpoint).
 * Reuses pollOnce logic with metrics tracking.
 */
export async function triggerPoll(): Promise<{ products: number; snapshots: number }> {
  if (isPolling) {
    return { products: 0, snapshots: 0 }
  }

  isPolling = true
  const cities = POLL_CITIES.length > 0 ? POLL_CITIES : [undefined]
  let totalProducts = 0
  let totalInserted = 0

  try {
    for (const city of cities) {
      try {
        const products = await fetchAllProducts(city, 1)
        totalProducts += products.length
        const rows = products.map(toSnapshotRow)
        const inserted = await insertSnapshots(rows)
        totalInserted += inserted
      } catch (err) {
        const cityLabel = city ?? 'ALL'
        console.error(`[poller] triggerPoll error for ${cityLabel}:`, err instanceof Error ? err.message : err)
      }
    }
  } finally {
    isPolling = false
  }

  return { products: totalProducts, snapshots: totalInserted }
}
