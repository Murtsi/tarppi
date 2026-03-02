/**
 * Admin routes for the self-training pipeline.
 *
 * POST /api/admin/poll          — Trigger a manual poll cycle
 * POST /api/admin/label         — Run the auto-labeler
 * GET  /api/admin/export-csv    — Export training data as CSV
 * GET  /api/admin/stats         — Get pipeline statistics
 */

import { Router } from 'express'
import { requireAuth } from './auth.js'
import { triggerPoll } from '../poller.js'
import { runLabeler } from '../labeler.js'
import { buildTrainingCsv } from '../trainer-export.js'
import {
  getSnapshotCount,
  getLabelCount,
  getLabelDistribution,
  getNewLabelCount,
  markLabelsUsed,
} from '../db.js'

export const adminRouter = Router()

// All admin routes require JWT authentication
adminRouter.use('/admin', requireAuth)

// ─── Manual poll trigger ────────────────────────────────────────────────────

adminRouter.post('/admin/poll', async (_req, res) => {
  try {
    console.log('[admin] Manual poll triggered')
    const result = await triggerPoll()
    res.json({
      success: true,
      products_fetched: result.products,
      snapshots_saved: result.snapshots,
    })
  } catch (error) {
    console.error('[admin] Poll error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Poll failed',
    })
  }
})

// ─── Auto-labeler trigger ───────────────────────────────────────────────────

adminRouter.post('/admin/label', async (_req, res) => {
  try {
    console.log('[admin] Auto-labeler triggered')
    const result = await runLabeler()
    res.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[admin] Labeler error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Labeler failed',
    })
  }
})

// ─── Export training CSV ────────────────────────────────────────────────────

adminRouter.get('/admin/export-csv', async (_req, res) => {
  try {
    const csv = await buildTrainingCsv()

    if (!csv) {
      res.status(404).json({ error: 'No training data available' })
      return
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="training_data.csv"')
    res.send(csv)
  } catch (error) {
    console.error('[admin] Export error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Export failed',
    })
  }
})

// ─── Pipeline stats ─────────────────────────────────────────────────────────

adminRouter.get('/admin/stats', async (_req, res) => {
  try {
    const [snapshotCount, labelCount, newLabels, distribution] = await Promise.all([
      getSnapshotCount(),
      getLabelCount(),
      getNewLabelCount(),
      getLabelDistribution(),
    ])

    res.json({
      snapshots: snapshotCount,
      labels: {
        total: labelCount,
        new_since_last_train: newLabels,
        distribution,
      },
      poller: {
        interval_ms: parseInt(process.env.POLL_INTERVAL_MS || '900000', 10),
        cities: (process.env.POLL_CITIES || '').split(',').filter(Boolean),
      },
    })
  } catch (error) {
    console.error('[admin] Stats error:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Stats failed',
    })
  }
})

// ─── Mark labels as used after successful retrain ───────────────────────────

adminRouter.post('/admin/mark-labels-used', async (_req, res) => {
  try {
    await markLabelsUsed()
    console.log('[admin] Labels marked as used in training')
    res.json({ success: true })
  } catch (error) {
    console.error('[admin] Mark labels used error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Mark labels failed',
    })
  }
})
