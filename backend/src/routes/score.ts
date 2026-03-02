/**
 * POST /api/score — Score a batch of events for resell potential
 */
import { Router } from 'express'
import { scoreEvents } from '../scorer.js'
import type { EventFeatures, ScorerConfig } from '../types.js'

export const scoreRouter = Router()

scoreRouter.post('/score', (req, res) => {
  try {
    const { events, config } = req.body as {
      events?: EventFeatures[]
      config?: Partial<ScorerConfig>
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or empty "events" array in request body',
      })
      return
    }

    if (events.length > 500) {
      res.status(400).json({
        success: false,
        error: 'Maximum 500 events per batch',
      })
      return
    }

    // Validate each event has at minimum event_id and name
    const invalid = events.filter((e) => !e.event_id || !e.name)
    if (invalid.length > 0) {
      res.status(400).json({
        success: false,
        error: `${invalid.length} event(s) missing required fields (event_id, name)`,
      })
      return
    }

    const result = scoreEvents(events, config)
    res.json(result)
  } catch (error) {
    console.error('[/api/score] Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Scoring failed',
    })
  }
})
