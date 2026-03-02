/**
 * AI Reranker client — calls the Python FastAPI inference service.
 *
 * Falls back gracefully if the service is unavailable:
 *   - Events keep their heuristic scores
 *   - ai_score remains undefined
 *
 * Environment variable:
 *   AI_RERANKER_URL — default: http://localhost:8100
 */

import type { ScoredEvent, AiScore } from './types.js'

const RERANKER_URL = process.env.AI_RERANKER_URL || 'http://localhost:8100'
const RERANKER_TIMEOUT_MS = 5_000

type RerankerEventInput = {
  id: string
  name: string
  likes_total: number | null | undefined
  base_price_eur: number | null | undefined
  max_price_eur: number | null | undefined
  availability_pct: number | null | undefined
  hours_since_published: number | null | undefined
  start_time: string | undefined
  sales_start_time: string | undefined
  sales_status: string | undefined
  organiser: string | undefined
  organiser_id: string | undefined
  resell_score: number
  feature_breakdown: Record<string, number>
}

type RerankerResponse = {
  scores: Array<{
    label: 'BUY' | 'MAYBE' | 'SKIP'
    buy_probability: number
    maybe_probability: number
    skip_probability: number
    model_version: string
  }>
  model_version: string
}

/**
 * Build the payload the Python service expects from a ScoredEvent.
 */
function toRerankerInput(ev: ScoredEvent): RerankerEventInput {
  return {
    id: ev.event_id,
    name: ev.name,
    likes_total: ev.likes_total,
    base_price_eur: ev.base_price_eur,
    max_price_eur: ev.max_price_eur,
    availability_pct: ev.availability_pct,
    hours_since_published: ev.hours_since_published,
    start_time: ev.start_time,
    sales_start_time: undefined, // not on ScoredEvent, OK — Python handles null
    sales_status: ev.sales_status,
    organiser: ev.organiser,
    organiser_id: ev.organiser_id,
    resell_score: ev.resell_score,
    feature_breakdown: ev.feature_breakdown,
  }
}

/**
 * Check if the reranker service is healthy. Returns the model version or null.
 */
export async function rerankerHealth(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RERANKER_TIMEOUT_MS)

    const resp = await fetch(`${RERANKER_URL}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) return null
    const data = (await resp.json()) as { status: string; model_version: string | null }
    return data.model_version ?? null
  } catch {
    return null
  }
}

/**
 * Send a batch of scored events to the reranker and return the AI scores.
 * Returns null if the service is unavailable or errors.
 */
async function fetchAiScores(events: ScoredEvent[]): Promise<AiScore[] | null> {
  if (events.length === 0) return []

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RERANKER_TIMEOUT_MS)

    const payload = { events: events.map(toRerankerInput) }

    const resp = await fetch(`${RERANKER_URL}/scoreEvents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!resp.ok) {
      console.warn(`[ai-reranker] Service returned ${resp.status}`)
      return null
    }

    const data = (await resp.json()) as RerankerResponse
    return data.scores.map((s) => ({
      label: s.label,
      buy_probability: s.buy_probability,
      maybe_probability: s.maybe_probability,
      skip_probability: s.skip_probability,
      model_version: s.model_version,
    }))
  } catch (err) {
    console.warn(`[ai-reranker] Service unavailable:`, err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Enrich scored events with AI reranking scores.
 *
 * - Calls the Python reranker service in batch
 * - Attaches ai_score to each event
 * - Re-sorts: AI BUY first (by buy_probability desc), then MAYBE, then SKIP
 * - Falls back gracefully to original order if service is down
 */
export async function rerankEvents(events: ScoredEvent[]): Promise<ScoredEvent[]> {
  const aiScores = await fetchAiScores(events)

  if (!aiScores) {
    // Service unavailable — return events unchanged
    console.log('[ai-reranker] Skipping (service unavailable), using heuristic only')
    return events
  }

  // Attach AI scores
  const enriched = events.map((ev, i) => ({
    ...ev,
    ai_score: aiScores[i] ?? undefined,
  }))

  // Sort: AI label group order → buy_probability desc → heuristic score desc
  const labelOrder: Record<string, number> = { BUY: 0, MAYBE: 1, SKIP: 2 }

  enriched.sort((a, b) => {
    const aLabel = a.ai_score?.label ?? a.decision
    const bLabel = b.ai_score?.label ?? b.decision

    const groupDiff = (labelOrder[aLabel] ?? 2) - (labelOrder[bLabel] ?? 2)
    if (groupDiff !== 0) return groupDiff

    // Within same group: sort by buy probability desc
    const aProb = a.ai_score?.buy_probability ?? 0
    const bProb = b.ai_score?.buy_probability ?? 0
    if (aProb !== bProb) return bProb - aProb

    // Fallback: heuristic score desc
    return b.resell_score - a.resell_score
  })

  console.log(`[ai-reranker] Reranked ${enriched.length} events (model: ${aiScores[0]?.model_version ?? 'unknown'})`)
  return enriched
}
