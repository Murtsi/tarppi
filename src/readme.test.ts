import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)

test('public README explains Tarppi with the real logo asset and current usage details', () => {
  const readme = readFileSync(new URL('README.md', frontendRoot), 'utf8')
  const hero = new URL('public/readme/tarppi-readme-hero.svg', frontendRoot)

  assert.ok(existsSync(hero), 'README hero asset is missing')
  assert.ok(readme.includes('./public/readme/tarppi-readme-hero.svg'))
  assert.ok(readme.includes('Kide.app-token'))
  assert.ok(readme.includes('Telegram Chat ID'))
  assert.ok(readme.includes('Maksu tehdään aina itse Kide.appissa'))

  for (const route of [
    '/',
    '/miten-toimii',
    '/kide-app-token',
    '/kide-app-lippujen-seuranta',
    '/ukk',
    '/tietoa',
  ]) {
    assert.ok(readme.includes(`\`${route}\``), `README is missing ${route}`)
  }
})
