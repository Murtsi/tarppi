/**
 * Kidehiiri Backend — Express API Server
 *
 * Proxies Kide.app API calls from the frontend to avoid CORS/bot detection.
 * Handles deobfuscation of dynamic anti-bot values server-side.
 */
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { reserveRouter } from './routes/reserve.js'
import { eventRouter } from './routes/event.js'
import { validateRouter } from './routes/validate.js'
import { deobfuscateRouter } from './routes/deobfuscate.js'
import { scoreRouter } from './routes/score.js'
import { scanRouter } from './routes/scan.js'
import { adminRouter } from './routes/admin.js'
import { authRouter } from './routes/auth.js'
import { tikettiRouter } from './routes/tiketti.js'
import { refreshExtraProperties } from './deobfuscator.js'
import { initDb } from './db.js'
import { startPoller, stopPoller } from './poller.js'
import { startTikettiCron, stopTikettiCron } from './tiketti-cron.js'
import { closeBrowser } from './tiketti-browser.js'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'

// ─── Security warnings ─────────────────────────────────────────────────────

if (ALLOWED_ORIGIN === '*') {
  console.warn('[Security] ⚠️  ALLOWED_ORIGIN is *, accepting all origins. Set ALLOWED_ORIGIN in production!')
}

// ─── Middleware ──────────────────────────────────────────────────────────────

// Security headers (disable frameguard/csp for API-only server)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: ALLOWED_ORIGIN === '*' ? true : ALLOWED_ORIGIN.split(',').map(s => s.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '1mb' }))

// Global rate limiter: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
})
app.use(globalLimiter)

// Strict rate limiter for sensitive endpoints: 10 requests per minute per IP
const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded for this endpoint' },
})

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ─── Routes ─────────────────────────────────────────────────────────────────

app.use('/api', reserveRouter)
app.use('/api', eventRouter)
app.use('/api', validateRouter)
app.use('/api', strictLimiter, deobfuscateRouter)  // strict: anti-bot refresh
app.use('/api', scoreRouter)
app.use('/api', scanRouter)
app.use('/api', strictLimiter, adminRouter)         // strict: admin endpoints
app.use('/api', authRouter)
app.use('/api', tikettiRouter)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Global error handler ───────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]', err.message, err.stack?.split('\n')[1]?.trim())
  res.status(500).json({ error: 'Internal server error' })
})

// ─── Process-level error handlers ───────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection]', reason)
})

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err)
  process.exit(1)
})

// ─── Boot ───────────────────────────────────────────────────────────────────

let server: ReturnType<typeof app.listen> | null = null

async function boot() {
  // Initialise database (if DATABASE_URL is set)
  if (process.env.DATABASE_URL) {
    console.log('[Boot] Initialising database...')
    try {
      await initDb()
      console.log('[Boot] Database ready')
    } catch (err) {
      console.warn('[Boot] Database init failed (pipeline disabled):', err)
    }
  } else {
    console.log('[Boot] DATABASE_URL not set, self-training pipeline disabled')
  }

  // Pre-fetch anti-bot properties on startup
  console.log('[Boot] Fetching initial anti-bot properties...')
  try {
    const props = await refreshExtraProperties()
    if (props.hash && props.headerKey) {
      console.log(`[Boot] Loaded: key=${props.headerKey}, hash=${props.hash}`)
    } else {
      console.warn('[Boot] Could not extract properties, using defaults')
    }
  } catch (err) {
    console.warn('[Boot] Failed to fetch properties:', err)
  }

  server = app.listen(PORT, () => {
    console.log(`[Kidehiiri API] Running on port ${PORT}`)
    console.log(`[Kidehiiri API] CORS origin: ${ALLOWED_ORIGIN}`)

    // Start background poller after server is listening
    startPoller()

    // Start Tiketti.fi scraper cron
    startTikettiCron()
  })
}

// ─── Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`)
  stopPoller()
  stopTikettiCron()
  await closeBrowser().catch((err) => console.error('[Shutdown] Browser cleanup error:', err))
  if (server) {
    server.close(() => {
      console.log('[Shutdown] HTTP server closed')
      process.exit(0)
    })
    // Force exit after 10s if graceful shutdown stalls
    setTimeout(() => {
      console.warn('[Shutdown] Forced exit after timeout')
      process.exit(1)
    }, 10_000)
  } else {
    process.exit(0)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

boot()
