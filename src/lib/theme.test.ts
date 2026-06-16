import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isThemeMode, THEME_STORAGE_KEY } from './theme'

test('isThemeMode accepts only supported theme modes', () => {
  assert.equal(isThemeMode('light'), true)
  assert.equal(isThemeMode('dark'), true)
  assert.equal(isThemeMode('system'), false)
  assert.equal(isThemeMode(''), false)
})

test('THEME_STORAGE_KEY keeps the legacy browser key stable', () => {
  assert.equal(THEME_STORAGE_KEY, 'kh.theme')
})
