/**
 * POST /api/deobfuscate — Refresh anti-bot values from Kide.app
 */
import { Router } from 'express'
import { refreshExtraProperties } from '../deobfuscator.js'

export const deobfuscateRouter = Router()

deobfuscateRouter.post('/deobfuscate', async (_req, res) => {
  try {
    const result = await refreshExtraProperties(true)
    res.json(result)
  } catch (error) {
    console.error('[/api/deobfuscate] Error:', error)
    res.status(500).json({
      hash: null,
      headerKey: null,
      extractedAt: new Date().toISOString(),
      cached: false,
      error: error instanceof Error ? error.message : 'Deobfuscation failed',
    })
  }
})
