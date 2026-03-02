/**
 * POST /api/validate-token — Validate a Kide.app bearer token
 */
import { Router } from 'express'
import { z } from 'zod'
import { validateToken } from '../kide-api.js'

export const validateRouter = Router()

const validateSchema = z.object({
  token: z.string().min(1).trim(),
})

validateRouter.post('/validate-token', async (req, res) => {
  try {
    const parsed = validateSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ valid: false, error: 'Token is required' })
      return
    }

    const result = await validateToken(parsed.data.token)
    res.json(result)
  } catch (error) {
    console.error('[/api/validate-token] Error:', error)
    res.status(500).json({
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    })
  }
})
