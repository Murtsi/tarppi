type HeaderValue = string | string[] | undefined

type ProxyRequest = {
  method?: string
  query: Record<string, HeaderValue>
  headers: Record<string, HeaderValue>
  body?: unknown
}

type ProxyResponse = {
  status: (code: number) => ProxyResponse
  setHeader: (name: string, value: string) => void
  send: (body: Buffer | string) => void
  end: () => void
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'transfer-encoding',
])

function envApiUrl(): string {
  return (process.env.API_PROXY_URL ?? process.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
}

function pathSegments(value: HeaderValue): string[] {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function targetPath(segments: string[]): string {
  if (segments[0] === 'health') return '/health'
  return `/api/${segments.map((segment) => encodeURIComponent(segment)).join('/')}`
}

function requestBody(req: ProxyRequest): string | Buffer | undefined {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined
  if (typeof req.body === 'string' || req.body instanceof Buffer) return req.body
  if (req.body == null) return undefined
  return JSON.stringify(req.body)
}

function requestHeaders(req: ProxyRequest): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    const lower = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(lower) || value == null) continue
    headers.set(name, Array.isArray(value) ? value.join(', ') : value)
  }
  return headers
}

export default async function handler(req: ProxyRequest, res: ProxyResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const apiUrl = envApiUrl()
  if (!apiUrl) {
    res.status(500).send(JSON.stringify({ success: false, error: 'API proxy is not configured' }))
    return
  }

  const segments = pathSegments(req.query.path)
  const upstreamUrl = new URL(targetPath(segments), apiUrl)
  for (const [name, value] of Object.entries(req.query)) {
    if (name === 'path' || value == null) continue
    for (const item of Array.isArray(value) ? value : [value]) upstreamUrl.searchParams.append(name, item)
  }

  const upstream = await fetch(upstreamUrl, {
    method: req.method ?? 'GET',
    headers: requestHeaders(req),
    body: requestBody(req),
    redirect: 'manual',
  })

  res.status(upstream.status)
  for (const [name, value] of upstream.headers.entries()) {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase())) res.setHeader(name, value)
  }

  const body = Buffer.from(await upstream.arrayBuffer())
  res.send(body)
}
