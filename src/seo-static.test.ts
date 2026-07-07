import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const frontendRoot = new URL('..', import.meta.url)
const canonicalOrigin = 'https://www.tarppi.site'
const seoTitle = 'Tärppi - Kide.app-ohjelma opiskelijatapahtumiin'
const seoDescription = 'Lisää Kide.app-token, valitse tapahtuma ja laita Tärppi vahtimaan. Telegram-ilmoitukset ovat vapaaehtoinen lisä. Maksu tehdään itse Kide.appissa.'
const staticRoutes = ['/miten-toimii', '/ukk', '/tietoa'] as const

function readFrontendFile(path: string): string {
  return readFileSync(new URL(path, frontendRoot), 'utf8')
}

test('sitemap.xml is a static XML sitemap for the canonical Tarppi URL', () => {
  const sitemap = readFrontendFile('public/sitemap.xml')

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.ok(sitemap.includes(`<loc>${canonicalOrigin}/</loc>`))
  for (const route of staticRoutes) {
    assert.ok(sitemap.includes(`<loc>${canonicalOrigin}${route}</loc>`))
  }
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
  assert.ok(indexHtml.includes(`<link data-rh="true" rel="canonical" href="${canonicalOrigin}/" />`))
  assert.ok(indexHtml.includes(`<meta data-rh="true" property="og:url" content="${canonicalOrigin}/" />`))
  assert.ok(indexHtml.includes(`<title data-rh="true">${seoTitle}</title>`))
  assert.ok(indexHtml.includes(`<meta data-rh="true" name="description" content="${seoDescription}" />`))
  assert.ok(indexHtml.includes('<meta name="keywords" content="kide.app ohjelma'))
  assert.ok(indexHtml.includes('<meta name="twitter:card" content="summary" />'))
  assert.ok(indexHtml.includes(`<meta data-rh="true" name="twitter:title" content="${seoTitle}" />`))
  assert.ok(indexHtml.includes(`<meta data-rh="true" name="twitter:description" content="${seoDescription}" />`))
  assert.ok(indexHtml.includes('<script type="application/ld+json">'))
  assert.ok(indexHtml.includes('"@type": "WebApplication"'))
  assert.ok(indexHtml.includes('"name": "Tärppi"'))
})

test('React app exposes the SEO routes and page-level metadata', () => {
  const app = readFrontendFile('src/App.tsx')
  const howItWorks = readFrontendFile('src/pages/HowItWorksPage.tsx')
  const faq = readFrontendFile('src/pages/FAQPage.tsx')
  const about = readFrontendFile('src/pages/AboutPage.tsx')

  for (const route of staticRoutes) {
    assert.ok(app.includes(`path="${route}"`))
  }

  assert.ok(howItWorks.includes('Miten Tärppi toimii? - Kide.app-ohjelma opiskelijoille'))
  assert.ok(faq.includes('UKK - Usein kysytyt kysymykset | Tärppi'))
  assert.ok(about.includes('Tietoa Tärpistä - Kide.app seuranta opiskelijoille'))
  assert.ok(faq.includes("'@type': 'FAQPage'"))
})

type HeaderRule = {
  source: string
  has?: Array<{ type: string, value?: string }>
  headers: Array<{ key: string, value: string }>
}

type RedirectRule = {
  source: string
  has?: Array<{ type: string, value?: string }>
  destination: string
  permanent?: boolean
}

test('Vercel redirects apex to www and serves sitemap.xml and robots.txt before the SPA fallback', () => {
  const vercelConfig = JSON.parse(readFrontendFile('vercel.json')) as {
    rewrites?: Array<{ source: string, destination: string }>
    redirects?: RedirectRule[]
  }
  const rewrites = vercelConfig.rewrites ?? []
  const redirects = vercelConfig.redirects ?? []
  const fallbackIndex = rewrites.findIndex((rewrite) => rewrite.source === '/(.*)' && rewrite.destination === '/index.html')
  const apexRedirect = redirects.find((redirect) => {
    const targetsApexHost = redirect.has?.some(
      (condition) => condition.type === 'host' && condition.value === 'tarppi.site',
    ) ?? false

    return redirect.source === '/(.*)'
      && redirect.destination === 'https://www.tarppi.site/$1'
      && redirect.permanent === true
      && targetsApexHost
  })

  assert.deepEqual(redirects, apexRedirect ? [apexRedirect] : [])
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
