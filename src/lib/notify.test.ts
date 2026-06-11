import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  NOTIFY_ENABLED_KEY,
  notificationsEnabled,
  setNotificationsEnabled,
} from './notify'

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

test('notifications are enabled by default', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  })

  assert.equal(notificationsEnabled(), true)
})

test('setNotificationsEnabled persists the mute toggle', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new LocalStorageStub(),
    configurable: true,
  })

  setNotificationsEnabled(false)

  assert.equal(globalThis.localStorage.getItem(NOTIFY_ENABLED_KEY), '0')
  assert.equal(notificationsEnabled(), false)
})
