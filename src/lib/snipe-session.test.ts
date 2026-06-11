import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ACTIVE_SNIPE_KEY,
  clearStoredSnipeSession,
  readStoredSnipeSession,
  writeStoredSnipeSession,
} from './snipe-session'
import type { SnipeSession } from './lt/types'

class LocalStorageStub {
  private store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }
}

test('writeStoredSnipeSession stores enough state to restore after reload', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  })
  const session: SnipeSession = {
    id: 's1',
    eventId: 'event-1',
    eventName: 'Testibileet',
    variantId: 'variant-1',
    variantName: 'Peruslippu',
    quantity: 2,
    phase: 'waiting',
    startedAt: 1,
    attempts: 3,
  }

  writeStoredSnipeSession(session, 'job-1')

  assert.equal(globalThis.localStorage.getItem(ACTIVE_SNIPE_KEY)?.includes('Testibileet'), true)
  assert.deepEqual(readStoredSnipeSession(), { session, serverJobId: 'job-1' })
})

test('clearStoredSnipeSession removes restored state', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  })

  clearStoredSnipeSession()

  assert.equal(readStoredSnipeSession(), null)
})
