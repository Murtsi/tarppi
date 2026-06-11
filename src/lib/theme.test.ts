import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isThemeMode, THEME_STORAGE_KEY } from './theme'

test('isThemeMode accepts only supported theme modes', () => {
  assert.equal(isThemeMode('light'), true)
  assert.equal(isThemeMode('dark'), true)
  assert.equal(isThemeMode('system'), false)
  assert.equal(isThemeMode(''), false)
})

test('THEME_STORAGE_KEY uses the Kidehiiri namespace', () => {
  assert.equal(THEME_STORAGE_KEY, 'kh.theme')
})
