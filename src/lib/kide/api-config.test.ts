import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApiUrl, getApiConfig, normaliseApiUrl } from './api-config'

test('normaliseApiUrl trims whitespace and trailing slashes', () => {
  assert.equal(normaliseApiUrl(' https://api.example.com/// '), 'https://api.example.com')
})

test('production config uses same-origin API paths to avoid bundling service hosts', () => {
  const config = getApiConfig('https://api.example.com/', true)

  assert.equal(config.configured, true)
  assert.equal(config.apiUrl, '')
  assert.equal(buildApiUrl(config, '/api/scan'), '/api/scan')
})

test('development config can use same-origin API paths', () => {
  const config = getApiConfig('', false)

  assert.equal(config.configured, true)
  assert.equal(buildApiUrl(config, '/api/scan'), '/api/scan')
})

test('development API URL is joined without duplicate slashes', () => {
  const config = getApiConfig('https://api.example.com/', false)

  assert.equal(buildApiUrl(config, '/health'), 'https://api.example.com/health')
})
