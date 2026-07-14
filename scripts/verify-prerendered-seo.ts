import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const canonicalOrigin = 'https://www.tarppi.site'
const pages = [
  {
    route: '/miten-toimii',
    title: 'Miten Tärppi seuraa Kide.app-lippuja? | Tärppi',
  },
  {
    route: '/ukk',
    title: 'Kide.app-token ja lippujen seuranta | UKK | Tärppi',
    schema: 'FAQPage',
  },
  {
    route: '/tietoa',
    title: 'Tietoa Tärpistä | Kide.app-lippujen seuranta',
  },
  {
    route: '/kide-app-token',
    title: 'Kide.app-token: mitä se on ja miten sitä käytetään? | Tärppi',
  },
  {
    route: '/kide-app-lippujen-seuranta',
    title: 'Kide.app-lippujen seuranta opiskelijatapahtumiin | Tärppi',
  },
] as const

for (const page of pages) {
  const file = resolve('dist', page.route.slice(1), 'index.html')
  const html = await readFile(file, 'utf8')

  assert.ok(html.includes(`<title>${page.title}</title>`), `${page.route} is missing its title`)
  assert.ok(html.includes(`href="${canonicalOrigin}${page.route}"`), `${page.route} has the wrong canonical`)
  assert.ok(html.includes('property="og:image" content="https://www.tarppi.site/og-tarppi.png"'), `${page.route} is missing the social image`)
  assert.ok(html.includes('<main'), `${page.route} is missing rendered content`)
  if (page.schema) assert.ok(html.includes(page.schema), `${page.route} is missing its schema`)
}
