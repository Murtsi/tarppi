import type { SnipeSession } from './lt/types'

export const ACTIVE_SNIPE_KEY = 'kh.activeSnipe'

export type StoredSnipeSession = {
  session: SnipeSession
  serverJobId: string | null
}

const MAX_RESTORABLE_SESSION_AGE_MS = 6 * 60 * 60 * 1000

function isSession(value: unknown): value is SnipeSession {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (
    typeof row.id === 'string'
    && typeof row.eventId === 'string'
    && typeof row.eventName === 'string'
    && typeof row.quantity === 'number'
    && typeof row.startedAt === 'number'
    && typeof row.attempts === 'number'
    && (row.phase === 'hunting' || row.phase === 'waiting' || row.phase === 'landed' || row.phase === 'error')
  )
}

function isRestorableSession(session: SnipeSession, now = Date.now()): boolean {
  if (now - session.startedAt > MAX_RESTORABLE_SESSION_AGE_MS) return false
  if (session.phase === 'error') return false
  if (session.phase !== 'landed') return true

  return Boolean(session.paymentExpiresAt && session.paymentExpiresAt > now)
}

export function readStoredSnipeSession(): StoredSnipeSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SNIPE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { session?: unknown; serverJobId?: unknown }
    if (!isSession(parsed.session)) return null
    if (!isRestorableSession(parsed.session)) {
      clearStoredSnipeSession()
      return null
    }
    return {
      session: parsed.session,
      serverJobId: typeof parsed.serverJobId === 'string' ? parsed.serverJobId : null,
    }
  } catch {
    return null
  }
}

export function writeStoredSnipeSession(session: SnipeSession, serverJobId: string | null): void {
  try {
    localStorage.setItem(ACTIVE_SNIPE_KEY, JSON.stringify({ session, serverJobId }))
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoredSnipeSession(): void {
  try { localStorage.removeItem(ACTIVE_SNIPE_KEY) } catch { /* ignore */ }
}

export function snipeMatchesEvent(session: SnipeSession | null | undefined, eventId: string | undefined): boolean {
  return Boolean(session && eventId && session.eventId === eventId)
}
