import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

type RenderedPage = {
  appHtml: string
  headHtml: string
}

export function renderPage(path: string): RenderedPage {
  const rendered = renderToString(
    <HelmetProvider>
      <StaticRouter location={path}>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StaticRouter>
    </HelmetProvider>,
  )
  const headTagPattern = /<title\b[^>]*>[\s\S]*?<\/title>|<meta\b[^>]*\/?>|<link\b[^>]*\/?>|<script\b[^>]*>[\s\S]*?<\/script>/g
  const headTags = rendered.match(headTagPattern) ?? []

  if (headTags.length === 0) throw new Error(`SEO metadata was not rendered for ${path}`)

  return {
    appHtml: rendered.replace(headTagPattern, ''),
    headHtml: headTags.join('\n'),
  }
}
