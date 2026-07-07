import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)
const checkedFiles = [
  'README.md',
  '.env.example',
  'vite.config.ts',
  'api/[...path].ts',
  'src/App.tsx',
  'src/lib/kide/api.ts',
  'src/lib/kide/types.ts',
  'src/pages/AboutPage.tsx',
] as const

const forbiddenPublicTerms = [
  /deobfuscate/i,
  /anti-bot/i,
  /Railway/i,
  /public-deploy/i,
  /subtree split/i,
  /Julkiseen repoon julkaisu/i,
] as const

test('public frontend files do not expose internal deployment or anti-abuse wording', () => {
  for (const path of checkedFiles) {
    const content = readFileSync(new URL(path, frontendRoot), 'utf8')
    for (const term of forbiddenPublicTerms) {
      assert.doesNotMatch(content, term, `${path} contains ${term}`)
    }
  }
})
