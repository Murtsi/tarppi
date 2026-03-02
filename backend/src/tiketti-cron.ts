/**
 * Tiketti Cron — scrapes tiketti.fi every 10 minutes and upserts to DB.
 *
 * Uses node-cron for scheduling. Only runs if DATABASE_URL is set.
 */
import cron, { type ScheduledTask } from 'node-cron'
import { scrapeTikettiEvents } from './scrapers/tiketti.js'
import { upsertTikettiEvents } from './db.js'

let task: ScheduledTask | null = null

async function runScrape() {
  try {
    const events = await scrapeTikettiEvents()
    if (events.length > 0) {
      const upserted = await upsertTikettiEvents(events)
      console.log(`[tiketti-cron] Upserted ${upserted} events`)
    } else {
      console.log('[tiketti-cron] No events scraped')
    }
  } catch (err) {
    console.error('[tiketti-cron] Scrape cycle failed:', err instanceof Error ? err.message : err)
  }
}

/**
 * Start the Tiketti.fi scraper cron job.
 * Runs every 10 minutes. Also runs once immediately on start.
 */
export function startTikettiCron() {
  if (!process.env.DATABASE_URL) {
    console.log('[tiketti-cron] DATABASE_URL not set, skipping tiketti scraper')
    return
  }

  console.log('[tiketti-cron] Starting Tiketti.fi scraper (every 10 min)')

  // Run initial scrape after a short delay (let DB init finish)
  setTimeout(() => {
    runScrape().catch(err => console.error('[tiketti-cron] Initial scrape failed:', err))
  }, 5_000)

  // Schedule: every 10 minutes
  task = cron.schedule('*/10 * * * *', () => {
    runScrape().catch(err => console.error('[tiketti-cron] Scheduled scrape failed:', err))
  })
}

/**
 * Stop the cron job (useful for graceful shutdown).
 */
export function stopTikettiCron() {
  if (task) {
    task.stop()
    task = null
    console.log('[tiketti-cron] Stopped')
  }
}
