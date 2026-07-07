import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)
const ignoredDirs = new Set(['.git', '.vercel', 'dist', 'node_modules'])
const textExtensions = new Set([
  '',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yml',
])

function literalPattern(...parts: string[]): RegExp {
  const escaped = parts
    .join('')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(escaped, 'i')
}

function frontendFiles(dir = frontendRoot): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) return []
      return frontendFiles(new URL(`${entry.name}/`, dir))
    }

    if (!entry.isFile()) return []
    const dot = entry.name.lastIndexOf('.')
    const ext = dot >= 0 ? entry.name.slice(dot) : ''
    if (!textExtensions.has(ext)) return []

    const fileUrl = new URL(entry.name, dir)
    return [fileUrl.pathname.replace(frontendRoot.pathname, '').replace(/^\//, '')]
  })
}

const forbiddenPublicTerms = [
  literalPattern('de', 'obfuscate'),
  literalPattern('anti', '-', 'bot'),
  literalPattern('Rail', 'way'),
  literalPattern('public', '-', 'deploy'),
  literalPattern('subtree', ' ', 'split'),
  literalPattern('x', '-', 'internal', '-', 'api', '-', 'key'),
  literalPattern('Julkiseen', ' repoon', ' julkaisu'),
  literalPattern('Kide', 'hiiri', '-', 'public'),
  literalPattern('kide', 'hiiri', '.', 'vercel', '.', 'app'),
  literalPattern('/api/', 'auth'),
  literalPattern('/api/', 'admin'),
] as const

test('public frontend files do not expose internal deployment or anti-abuse wording', () => {
  for (const path of frontendFiles()) {
    const content = readFileSync(new URL(path, frontendRoot), 'utf8')
    for (const term of forbiddenPublicTerms) {
      assert.doesNotMatch(content, term, `${path} contains ${term}`)
    }
  }
})
