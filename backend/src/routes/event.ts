/**
 * POST /api/event — Fetch event details + variants from Kide.app
 */
import { Router } from 'express'
import { z } from 'zod'
import { fetchEventProducts, extractEventId } from '../kide-api.js'
import type { EventResponse } from '../types.js'

export const eventRouter = Router()

const eventSchema = z.object({
  eventUrl: z.string().min(1).trim(),
})

eventRouter.post('/event', async (req, res) => {
  try {
    const parsed = eventSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}` })
      return
    }

    const { eventUrl } = parsed.data

    const eventId = extractEventId(eventUrl)
    if (!eventId) {
      res.status(400).json({ success: false, error: 'Could not extract event ID from URL' })
      return
    }

    const model = await fetchEventProducts(eventUrl)
    const response: EventResponse = {
      product: model.product,
      variants: model.variants,
    }

    res.json(response)
  } catch (error) {
    console.error('[/api/event] Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch event',
    })
  }
})
