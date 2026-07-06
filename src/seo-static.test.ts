import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)

function readFrontendFile(path: string): string {
  return readFileSync(new URL(path, frontendRoot), 'utf8')
}

test('sitemap.xml is a static XML sitemap for the canonical Tarppi URL', () => {
  const sitemap = readFrontendFile('public/sitemap.xml')

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.match(sitemap, /<loc>https:\/\/tarppi\.site\/<\/loc>/)
  assert.match(sitemap, /<changefreq>daily<\/changefreq>/)
  assert.match(sitemap, /<priority>1\.0<\/priority>/)
  assert.doesNotMatch(sitemap.toLowerCase(), /<!doctype html|<html/)
})

test('robots.txt allows indexing and points to sitemap.xml', () => {
  const robots = readFrontendFile('public/robots.txt')

  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Allow: \//)
  assert.match(robots, /Sitemap: https:\/\/tarppi\.site\/sitemap\.xml/)
})

test('index.html has indexable SEO metadata', () => {
  const indexHtml = readFrontendFile('index.html')

  assert.doesNotMatch(indexHtml, /<meta\s+name=["']robots["'][^>]*noindex/i)
  assert.match(indexHtml, /<meta name="robots" content="index,follow" \/>/)
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/tarppi\.site\/" \/>/)
  assert.match(indexHtml, /<title>Tarppi - Kide\.app tapahtumien seuranta opiskelijoille<\/title>/)
  assert.match(
    indexHtml,
    /<meta name="description" content="Tarppi auttaa opiskelijoita seuraamaan Kide\.app tapahtumia ja pysymään mukana nopeissa lipunmyynneissä\." \/>/,
  )
})

test('Vercel serves sitemap.xml and robots.txt before the SPA fallback', () => {
  const vercelConfig = JSON.parse(readFrontendFile('vercel.json')) as {
    rewrites?: Array<{ source: string, destination: string }>
  }
  const rewrites = vercelConfig.rewrites ?? []
  const fallbackIndex = rewrites.findIndex((rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html')

  assert.notEqual(fallbackIndex, -1)
  assert.ok(
    rewrites.findIndex((rewrite) => rewrite.source === '/sitemap.xml' && rewrite.destination === '/sitemap.xml') > -1,
  )
  assert.ok(
    rewrites.findIndex((rewrite) => rewrite.source === '/robots.txt' && rewrite.destination === '/robots.txt') > -1,
  )
  assert.ok(
    rewrites.findIndex((rewrite) => rewrite.source === '/sitemap.xml') < fallbackIndex,
  )
  assert.ok(
    rewrites.findIndex((rewrite) => rewrite.source === '/robots.txt') < fallbackIndex,
  )
})
