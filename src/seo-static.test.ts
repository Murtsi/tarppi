import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)
const canonicalOrigin = 'https://www.tarppi.site'
const seoTitle = 'Tarppi - Kide.app tapahtumien seuranta opiskelijoille'
const seoDescription = 'Tarppi auttaa opiskelijoita seuraamaan Kide.app tapahtumia ja pysymään mukana nopeissa lipunmyynneissä.'

function readFrontendFile(path: string): string {
  return readFileSync(new URL(path, frontendRoot), 'utf8')
}

test('sitemap.xml is a static XML sitemap for the canonical Tarppi URL', () => {
  const sitemap = readFrontendFile('public/sitemap.xml')

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.ok(sitemap.includes(`<loc>${canonicalOrigin}/</loc>`))
  assert.match(sitemap, /<changefreq>daily<\/changefreq>/)
  assert.match(sitemap, /<priority>1\.0<\/priority>/)
  assert.doesNotMatch(sitemap.toLowerCase(), /<!doctype html|<html/)
})

test('robots.txt allows indexing and points to the canonical sitemap.xml', () => {
  const robots = readFrontendFile('public/robots.txt')

  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Allow: \//)
  assert.ok(robots.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`))
})

test('index.html has indexable SEO metadata for the canonical domain', () => {
  const indexHtml = readFrontendFile('index.html')

  assert.doesNotMatch(indexHtml, /<meta\s+name=["']robots["'][^>]*noindex/i)
  assert.ok(indexHtml.includes('<meta name="robots" content="index,follow" />'))
  assert.ok(indexHtml.includes(`<link rel="canonical" href="${canonicalOrigin}/" />`))
  assert.ok(indexHtml.includes(`<meta property="og:url" content="${canonicalOrigin}/" />`))
  assert.ok(indexHtml.includes(`<title>${seoTitle}</title>`))
  assert.ok(indexHtml.includes(`<meta name="description" content="${seoDescription}" />`))
  assert.ok(indexHtml.includes('<meta name="twitter:card" content="summary" />'))
  assert.ok(indexHtml.includes(`<meta name="twitter:title" content="${seoTitle}" />`))
  assert.ok(indexHtml.includes(`<meta name="twitter:description" content="${seoDescription}" />`))
})

type HeaderRule = {
  source: string
  has?: Array<{ type: string, value?: string }>
  headers: Array<{ key: string, value: string }>
}

test('Vercel serves sitemap.xml and robots.txt before the SPA fallback without app-level domain redirects', () => {
  const vercelConfig = JSON.parse(readFrontendFile('vercel.json')) as {
    rewrites?: Array<{ source: string, destination: string }>
    redirects?: Array<unknown>
  }
  const rewrites = vercelConfig.rewrites ?? []
  const fallbackIndex = rewrites.findIndex((rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html')

  assert.equal(vercelConfig.redirects, undefined)
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

test('Vercel app preview hosts receive X-Robots-Tag noindex', () => {
  const vercelConfig = JSON.parse(readFrontendFile('vercel.json')) as { headers?: HeaderRule[] }
  const headers = vercelConfig.headers ?? []
  const vercelAppNoindexRule = headers.find((rule) => {
    const targetsVercelAppHost = rule.has?.some(
      (condition) => condition.type === 'host' && condition.value?.includes('vercel\\.app'),
    ) ?? false
    const sendsNoindex = rule.headers.some(
      (header) => header.key.toLowerCase() === 'x-robots-tag' && header.value.toLowerCase() === 'noindex',
    )
    return rule.source === '/(.*)' && targetsVercelAppHost && sendsNoindex
  })

  assert.ok(vercelAppNoindexRule)
})
