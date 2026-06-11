import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeJwtExpiryMs } from './token-expiry'

function b64url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

test('decodeJwtExpiryMs reads exp claim from a JWT without verifying it', () => {
  const token = `${b64url('{}')}.${b64url(JSON.stringify({ exp: 1_700_000_000 }))}.sig`

  assert.equal(decodeJwtExpiryMs(token), 1_700_000_000_000)
})

test('decodeJwtExpiryMs returns null for malformed tokens', () => {
  assert.equal(decodeJwtExpiryMs('not-a-jwt'), null)
})
