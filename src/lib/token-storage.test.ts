import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readStoredKideToken, writeStoredKideToken } from './token-storage'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key: string) {
      return values.get(key) ?? null
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    removeItem(key: string) {
      values.delete(key)
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
  }
}

function installStorage() {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage(),
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: memoryStorage(),
  })
}

test('readStoredKideToken migrates the legacy localStorage token to sessionStorage', () => {
  installStorage()
  localStorage.setItem('kh.token', 'legacy.jwt.token')

  assert.equal(readStoredKideToken(), 'legacy.jwt.token')
  assert.equal(sessionStorage.getItem('kh.token'), 'legacy.jwt.token')
  assert.equal(localStorage.getItem('kh.token'), null)
})

test('writeStoredKideToken stores the token only for the browser session', () => {
  installStorage()
  localStorage.setItem('kh.token', 'old.jwt.token')

  writeStoredKideToken(' next.jwt.token ')

  assert.equal(sessionStorage.getItem('kh.token'), 'next.jwt.token')
  assert.equal(localStorage.getItem('kh.token'), null)
})
