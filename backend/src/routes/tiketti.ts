/**
 * Tiketti routes — event listing + sniper endpoints.
 *
 * /api/tiketti/events, /stats, /scrape → admin-protected DB/scraper routes
 * /api/tiketti/event, /reserve → sniper endpoints (no admin auth, user provides their own session)
 * /api/tiketti/browser/* → Playwright browser automation endpoints (SSE status updates)
 */
import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from './auth.js'
import { getTikettiEvents, getTikettiEventCount, upsertTikettiEvents } from '../db.js'
import { scrapeTikettiEvents } from '../scrapers/tiketti.js'
import { fetchTikettiEvent, addToTikettiCart, normalizeTikettiUrl, extractEventId, checkTikettiAvailability } from '../tiketti-api.js'
import { createSession, triggerBuy, getSessionInfo, closeSession, listSessions, cleanupStaleSessions, type SessionStatus } from '../tiketti-browser.js'

export const tikettiRouter = Router()

// Admin-only routes (DB listing, stats, manual scrape)
tikettiRouter.use('/tiketti/events', requireAuth)
tikettiRouter.use('/tiketti/stats', requireAuth)
tikettiRouter.use('/tiketti/scrape', requireAuth)

/**
 * GET /api/tiketti/events — List all Tiketti events from DB.
 * Query params: ?city=Helsinki (optional filter)
 */
tikettiRouter.get('/tiketti/events', async (req: Request, res: Response) => {
  try {
    const city = typeof req.query.city === 'string' ? req.query.city : undefined
    const events = await getTikettiEvents(city)
    res.json({ success: true, events, count: events.length })
  } catch (err) {
    console.error('[tiketti] Failed to fetch events:', err)
    res.status(500).json({ success: false, error: 'Failed to fetch Tiketti events' })
  }
})

/**
 * GET /api/tiketti/stats — Event count and last update.
 */
tikettiRouter.get('/tiketti/stats', async (_req: Request, res: Response) => {
  try {
    const count = await getTikettiEventCount()
    res.json({ success: true, count })
  } catch (err) {
    console.error('[tiketti] Failed to get stats:', err)
    res.status(500).json({ success: false, error: 'Failed to get stats' })
  }
})

/**
 * POST /api/tiketti/scrape — Trigger a manual scrape (admin-only).
 */
tikettiRouter.post('/tiketti/scrape', async (_req: Request, res: Response) => {
  try {
    console.log('[tiketti] Manual scrape triggered')
    const events = await scrapeTikettiEvents()

    if (events.length > 0) {
      const upserted = await upsertTikettiEvents(events)
      res.json({ success: true, scraped: events.length, upserted })
    } else {
      res.json({ success: true, scraped: 0, upserted: 0, message: 'No events found' })
    }
  } catch (err) {
    console.error('[tiketti] Manual scrape failed:', err)
    res.status(500).json({ success: false, error: 'Scrape failed' })
  }
})

// ─── Sniper endpoints (no admin auth required) ─────────────────────────────

const tikettiEventSchema = z.object({
  eventUrl: z.string().min(1),
})

const tikettiReserveSchema = z.object({
  eventUrl: z.string().min(1),
  quantity: z.number().int().min(1).max(10).optional().default(1),
  sessionCookie: z.string().min(1),
})

/**
 * POST /api/tiketti/event — Fetch Tiketti.fi event details + ticket variants.
 * Body: { eventUrl: string }
 */
tikettiRouter.post('/tiketti/event', async (req: Request, res: Response) => {
  try {
    const parsed = tikettiEventSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}` })
      return
    }

    const { eventUrl } = parsed.data
    const normalized = normalizeTikettiUrl(eventUrl)
    if (!normalized) {
      res.status(400).json({ success: false, error: 'Invalid Tiketti.fi URL' })
      return
    }

    const event = await fetchTikettiEvent(normalized)
    res.json({ success: true, event })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti] Failed to fetch event:', message)
    res.status(500).json({ success: false, error: `Failed to fetch event: ${message}` })
  }
})

/**
 * POST /api/tiketti/reserve — Add tickets to Tiketti.fi cart.
 * Body: { eventUrl, quantity, sessionCookie }
 */
tikettiRouter.post('/tiketti/reserve', async (req: Request, res: Response) => {
  try {
    const parsed = tikettiReserveSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      })
      return
    }

    const { eventUrl, quantity, sessionCookie } = parsed.data
    const eventId = extractEventId(eventUrl)
    if (!eventId) {
      res.status(400).json({ success: false, error: 'Could not extract eventID from URL' })
      return
    }

    const result = await addToTikettiCart(eventId, quantity, sessionCookie)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti] Failed to add to cart:', message)
    res.status(500).json({ success: false, error: `Cart error: ${message}` })
  }
})

/**
 * POST /api/tiketti/check — Quick availability check for an event.
 * Body: { eventUrl: string }
 */
tikettiRouter.post('/tiketti/check', async (req: Request, res: Response) => {
  try {
    const parsed = tikettiEventSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'eventUrl is required' })
      return
    }

    const eventId = extractEventId(parsed.data.eventUrl)
    if (!eventId) {
      res.status(400).json({ success: false, error: 'Could not extract eventID from URL' })
      return
    }

    const availability = await checkTikettiAvailability(eventId)
    res.json({ success: true, ...availability })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti] Availability check failed:', message)
    res.status(500).json({ success: false, error: message })
  }
})

// ─── Browser automation endpoints ───────────────────────────────────────────

const browserSessionSchema = z.object({
  eventUrl: z.string().min(1),
  quantity: z.number().int().min(1).max(10).optional().default(1),
})

const browserBuySchema = z.object({
  sessionId: z.string().min(1),
})

/**
 * POST /api/tiketti/browser/session — Create a Playwright browser session.
 * Launches a headless Chromium, navigates to the event page, handles Queue-it.
 * Returns SSE stream with real-time status updates.
 */
tikettiRouter.post('/tiketti/browser/session', async (req: Request, res: Response) => {
  try {
    const parsed = browserSessionSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}` })
      return
    }

    const { eventUrl, quantity } = parsed.data
    const normalized = normalizeTikettiUrl(eventUrl)
    if (!normalized) {
      res.status(400).json({ success: false, error: 'Invalid Tiketti.fi URL' })
      return
    }

    const eventId = extractEventId(eventUrl)
    if (!eventId) {
      res.status(400).json({ success: false, error: 'Could not extract eventID from URL' })
      return
    }

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    })

    const sendSSE = (data: { sessionId?: string; status: SessionStatus; message: string }) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch {
        // Connection might be closed
      }
    }

    // Clean up stale sessions before creating a new one
    await cleanupStaleSessions()

    const sessionId = await createSession(normalized, eventId, quantity, (status, message) => {
      sendSSE({ sessionId, status, message })

      // Close SSE when session reaches a terminal state during setup
      if (status === 'ready' || status === 'failed') {
        try {
          res.write(`data: ${JSON.stringify({ sessionId, status, message, done: true })}\n\n`)
          res.end()
        } catch { /* already closed */ }
      }
    })

    // Send the initial session ID
    sendSSE({ sessionId, status: 'launching', message: 'Browser session starting...' })

    // If client disconnects, clean up the session
    req.on('close', () => {
      const info = getSessionInfo(sessionId)
      if (info && info.status !== 'ready' && info.status !== 'success') {
        closeSession(sessionId).catch(() => {})
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti] Browser session error:', message)
    // Only send JSON error if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: `Browser session error: ${message}` })
    }
  }
})

/**
 * POST /api/tiketti/browser/buy — Trigger the buy action on a browser session.
 * The session must be in "ready" state (already past Queue-it).
 */
tikettiRouter.post('/tiketti/browser/buy', async (req: Request, res: Response) => {
  try {
    const parsed = browserBuySchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'sessionId is required' })
      return
    }

    const { sessionId } = parsed.data
    const info = getSessionInfo(sessionId)

    if (!info) {
      res.status(404).json({ success: false, error: 'Session not found' })
      return
    }

    if (info.status !== 'ready') {
      res.status(400).json({ success: false, error: `Session not ready (status: ${info.status})` })
      return
    }

    const result = await triggerBuy(sessionId)
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[tiketti] Browser buy error:', message)
    res.status(500).json({ success: false, error: message })
  }
})

/**
 * GET /api/tiketti/browser/session/:id — Get session status.
 */
tikettiRouter.get('/tiketti/browser/session/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const info = getSessionInfo(id)
  if (!info) {
    res.status(404).json({ success: false, error: 'Session not found' })
    return
  }
  res.json({ success: true, session: info })
})

/**
 * DELETE /api/tiketti/browser/session/:id — Close and cleanup a browser session.
 */
tikettiRouter.delete('/tiketti/browser/session/:id', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await closeSession(id)
  res.json({ success: true, message: 'Session closed' })
})

/**
 * GET /api/tiketti/browser/sessions — List all active browser sessions.
 */
tikettiRouter.get('/tiketti/browser/sessions', (_req: Request, res: Response) => {
  res.json({ success: true, sessions: listSessions() })
})
