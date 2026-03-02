/**
 * Auto-labeler — generates BUY/MAYBE/SKIP labels from snapshot analysis.
 *
 * Labeling criteria (based on sell-through velocity and availability change):
 *
 * BUY:
 *   - Sold out in <6 hours after sales start (confidence: 0.95)
 *   - Sold out in <48 hours (confidence: 0.75)
 *   - Availability dropped >80% within observation window (confidence: 0.80)
 *
 * MAYBE:
 *   - Sold out between 48–120 hours (confidence: 0.60)
 *   - Availability dropped 20–60% (confidence: 0.50)
 *   - Significant like growth (>50%) but still available (confidence: 0.45)
 *
 * SKIP:
 *   - >40% remaining after event ended or sales closed (confidence: 0.85)
 *   - No availability change observed over 72+ hours of snapshots (confidence: 0.70)
 *   - Sales ended with >60% remaining (confidence: 0.90)
 */

import { getSnapshotRanges, upsertLabels, type LabelRow } from './db.js'

type LabelDecision = {
  label: 'BUY' | 'MAYBE' | 'SKIP'
  confidence: number
  reason: string
}

/**
 * Determine the label for an event based on its snapshot range.
 */
function classifyEvent(range: {
  event_id: string
  name: string
  first_availability: number | null
  last_availability: number | null
  first_sales_status: string | null
  last_sales_status: string | null
  first_snapshot: Date
  last_snapshot: Date
  snapshot_count: number
  first_likes: number | null
  last_likes: number | null
  base_price_eur: number | null
}): LabelDecision | null {
  const {
    first_availability,
    last_availability,
    last_sales_status,
    first_snapshot,
    last_snapshot,
    snapshot_count,
    first_likes,
    last_likes,
  } = range

  // Need at least 2 snapshots to compare
  if (snapshot_count < 2) return null

  const observationHours =
    (new Date(last_snapshot).getTime() - new Date(first_snapshot).getTime()) / (1000 * 60 * 60)

  // Need at least 1 hour of observation
  if (observationHours < 1) return null

  const firstAvail = first_availability ?? 100
  const lastAvail = last_availability ?? first_availability ?? 100
  const availDrop = firstAvail - lastAvail
  const availDropPct = firstAvail > 0 ? (availDrop / firstAvail) * 100 : 0

  const isSoldOut = lastAvail === 0 || last_sales_status === 'sold_out'
  const isEnded = last_sales_status === 'ended'

  // ── BUY conditions ──────────────────────────────────────────────────

  // Sold out very quickly (<6 hours)
  if (isSoldOut && observationHours < 6) {
    return {
      label: 'BUY',
      confidence: 0.95,
      reason: `Sold out in ${observationHours.toFixed(1)}h (very fast)`,
    }
  }

  // Sold out within 48 hours
  if (isSoldOut && observationHours < 48) {
    return {
      label: 'BUY',
      confidence: 0.75,
      reason: `Sold out in ${observationHours.toFixed(1)}h`,
    }
  }

  // Massive availability drop (>80%) even if not fully sold out
  if (availDropPct > 80 && !isEnded) {
    return {
      label: 'BUY',
      confidence: 0.80,
      reason: `Availability dropped ${availDropPct.toFixed(0)}% (${firstAvail}% → ${lastAvail}%)`,
    }
  }

  // ── SKIP conditions ─────────────────────────────────────────────────

  // Event ended with lots of tickets remaining
  if (isEnded && lastAvail > 60) {
    return {
      label: 'SKIP',
      confidence: 0.90,
      reason: `Event ended with ${lastAvail}% remaining`,
    }
  }

  // Event ended or sales closed with >40% remaining
  if ((isEnded || last_sales_status === 'ended') && lastAvail > 40) {
    return {
      label: 'SKIP',
      confidence: 0.85,
      reason: `Sales closed with ${lastAvail}% remaining`,
    }
  }

  // No availability change over 72+ hours
  if (observationHours >= 72 && Math.abs(availDrop) < 3) {
    return {
      label: 'SKIP',
      confidence: 0.70,
      reason: `No significant change over ${observationHours.toFixed(0)}h (${firstAvail}% → ${lastAvail}%)`,
    }
  }

  // ── MAYBE conditions ────────────────────────────────────────────────

  // Sold out between 48–120 hours
  if (isSoldOut && observationHours >= 48 && observationHours <= 120) {
    return {
      label: 'MAYBE',
      confidence: 0.60,
      reason: `Sold out in ${observationHours.toFixed(1)}h (moderate pace)`,
    }
  }

  // Availability dropped 20–60%
  if (availDropPct >= 20 && availDropPct <= 60) {
    return {
      label: 'MAYBE',
      confidence: 0.50,
      reason: `Availability dropped ${availDropPct.toFixed(0)}% (${firstAvail}% → ${lastAvail}%)`,
    }
  }

  // Significant like growth but still available
  const likeGrowth =
    first_likes && last_likes && first_likes > 0
      ? ((last_likes - first_likes) / first_likes) * 100
      : 0
  if (likeGrowth > 50 && lastAvail > 30) {
    return {
      label: 'MAYBE',
      confidence: 0.45,
      reason: `Likes grew ${likeGrowth.toFixed(0)}% but ${lastAvail}% still available`,
    }
  }

  // Not enough signal to label
  return null
}

/**
 * Run the auto-labeler on all unlabelled events with sufficient snapshot data.
 * Returns the number of new labels generated.
 */
export async function runLabeler(): Promise<{
  processed: number
  labelled: number
  skipped: number
  labels: { buy: number; maybe: number; skip: number }
}> {
  const ranges = await getSnapshotRanges()
  console.log(`[labeler] Analyzing ${ranges.length} unlabelled events`)

  const newLabels: LabelRow[] = []
  let skipped = 0
  const counts = { buy: 0, maybe: 0, skip: 0 }

  for (const range of ranges) {
    const decision = classifyEvent(range)

    if (!decision) {
      skipped++
      continue
    }

    newLabels.push({
      event_id: range.event_id,
      name: range.name,
      label: decision.label,
      confidence: decision.confidence,
      reason: decision.reason,
    })

    counts[decision.label.toLowerCase() as 'buy' | 'maybe' | 'skip']++
  }

  if (newLabels.length > 0) {
    await upsertLabels(newLabels)
  }

  console.log(
    `[labeler] Result: ${newLabels.length} labelled, ${skipped} skipped ` +
    `(BUY=${counts.buy}, MAYBE=${counts.maybe}, SKIP=${counts.skip})`,
  )

  return {
    processed: ranges.length,
    labelled: newLabels.length,
    skipped,
    labels: counts,
  }
}
