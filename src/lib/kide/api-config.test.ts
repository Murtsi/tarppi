import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiConfigurationError, buildApiUrl, getApiConfig, normaliseApiUrl } from './api-config'

test('normaliseApiUrl trims whitespace and trailing slashes', () => {
  assert.equal(normaliseApiUrl(' https://api.example.com/// '), 'https://api.example.com')
})

test('production config requires VITE_API_URL', () => {
  const config = getApiConfig('', true)

  assert.equal(config.configured, false)
  assert.match(config.error ?? '', /VITE_API_URL/)
  assert.throws(() => buildApiUrl(config, '/health'), ApiConfigurationError)
})

test('development config can use same-origin API paths', () => {
  const config = getApiConfig('', false)

  assert.equal(config.configured, true)
  assert.equal(buildApiUrl(config, '/api/scan'), '/api/scan')
})

test('configured API URL is joined without duplicate slashes', () => {
  const config = getApiConfig('https://backend.railway.app/', true)

  assert.equal(buildApiUrl(config, '/health'), 'https://backend.railway.app/health')
})
