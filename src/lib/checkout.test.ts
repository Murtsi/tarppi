import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KIDE_CHECKOUT_URL } from './checkout'

test('KIDE_CHECKOUT_URL points to Kide checkout', () => {
  assert.equal(KIDE_CHECKOUT_URL, 'https://kide.app/checkout')
})
