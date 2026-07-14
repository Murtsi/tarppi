import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STATIC_SEO_ROUTES = [
  '/miten-toimii',
  '/ukk',
  '/tietoa',
  '/kide-app-token',
  '/kide-app-lippujen-seuranta',
] as const

type RenderedPage = {
  appHtml: string
  headHtml: string
}

type ServerEntry = {
  renderPage: (path: string) => RenderedPage
}

const distDir = resolve('dist')
const serverDir = resolve('dist-ssr')
const template = await readFile(resolve(distDir, 'index.html'), 'utf8')
const serverModule = await import(pathToFileURL(resolve(serverDir, 'entry-server.js')).href) as ServerEntry

function replaceSeoHead(html: string, headHtml: string): string {
  return html.replace(
    /<!--seo-head-start-->[\s\S]*?<!--seo-head-end-->/,
    `<!--seo-head-start-->\n${headHtml}\n<!--seo-head-end-->`,
  )
}

const homePage = serverModule.renderPage('/')
const homeHtml = replaceSeoHead(template, homePage.headHtml)
  .replace('<div id="root"></div>', `<div id="root">${homePage.appHtml}</div>`)

await writeFile(resolve(distDir, 'index.html'), homeHtml)

for (const route of STATIC_SEO_ROUTES) {
  const page = serverModule.renderPage(route)
  const html = replaceSeoHead(template, page.headHtml)
    .replace('<div id="root"></div>', `<div id="root">${page.appHtml}</div>`)
  const outputDir = resolve(distDir, route.slice(1))

  await mkdir(outputDir, { recursive: true })
  await writeFile(resolve(outputDir, 'index.html'), html)
}

await rm(serverDir, { recursive: true, force: true })
