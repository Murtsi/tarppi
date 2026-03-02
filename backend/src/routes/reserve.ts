/**
 * POST /api/reserve — Add tickets to cart via Kide.app API
 */
import { Router } from 'express'
import { z } from 'zod'
import { addToCart } from '../kide-api.js'

export const reserveRouter = Router()

const reserveSchema = z.object({
  variantId: z.string().min(1),
  authorizationToken: z.string().min(1),
  amount: z.number().int().min(1).max(50),
})

reserveRouter.post('/reserve', async (req, res) => {
  try {
    const parsed = reserveSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: `Validation error: ${parsed.error.issues.map(i => i.message).join(', ')}`,
      })
      return
    }

    const { variantId, authorizationToken, amount } = parsed.data
    const result = await addToCart(authorizationToken, variantId, amount)
    res.json(result)
  } catch (error) {
    console.error('[/api/reserve] Error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})
