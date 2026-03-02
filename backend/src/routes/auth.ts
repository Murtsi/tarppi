/**
 * Admin authentication route — POST /api/auth/login
 *
 * Validates ADMIN_USERNAME + ADMIN_PASSWORD from env vars
 * and returns a JWT token for protected Tiketti routes.
 * Uses jose (already in deps) for JWT signing.
 */
import { Router } from 'express'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { Request, Response, NextFunction } from 'express'

export const authRouter = Router()

const JWT_SECRET_RAW = process.env.JWT_SECRET || 'kidehiiri-dev-secret-change-me'
if (JWT_SECRET_RAW === 'kidehiiri-dev-secret-change-me') {
  console.warn('[Security] ⚠️  Using default JWT_SECRET — set JWT_SECRET env var in production!')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW)
const TOKEN_EXPIRY = '24h'

// ─── Login endpoint ─────────────────────────────────────────────────────────

authRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string }

    const adminUser = process.env.ADMIN_USERNAME?.trim()
    const adminPass = process.env.ADMIN_PASSWORD?.trim()

    if (!adminUser || !adminPass) {
      console.error('[auth] ADMIN_USERNAME or ADMIN_PASSWORD not configured')
      res.status(500).json({ error: 'Admin authentication not configured' })
      return
    }

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' })
      return
    }

    if (username !== adminUser || password !== adminPass) {
      console.log(`[auth] Failed login attempt for user: ${username}`)
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    // Generate JWT
    const token = await new SignJWT({ sub: username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(JWT_SECRET)

    console.log(`[auth] Admin login successful: ${username}`)
    res.json({ token, expiresIn: TOKEN_EXPIRY })
  } catch (error) {
    console.error('[auth] Login error:', error)
    res.status(500).json({ error: 'Internal server error during login' })
  }
})

// ─── Internal API key for service-to-service auth ───────────────────────────

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ''
if (!INTERNAL_API_KEY) {
  console.warn('[Security] ⚠️  INTERNAL_API_KEY not set — AI reranker auto-retrain will not be able to authenticate')
}

// ─── JWT verification middleware ────────────────────────────────────────────

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Allow service-to-service calls via internal API key
  const apiKey = req.headers['x-internal-api-key'] as string | undefined
  if (INTERNAL_API_KEY && apiKey === INTERNAL_API_KEY) {
    ;(req as Request & { auth?: JWTPayload }).auth = { sub: 'internal-service', role: 'admin' }
    next()
    return
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token required' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    // Attach user info to request for downstream use
    ;(req as Request & { auth?: JWTPayload }).auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// ─── Token validation endpoint ──────────────────────────────────────────────

authRouter.get('/auth/verify', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.json({ valid: false })
    return
  }

  const token = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    res.json({ valid: true, user: payload.sub, expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null })
  } catch {
    res.json({ valid: false })
  }
})
