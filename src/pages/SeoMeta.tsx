import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'

const CANONICAL_ORIGIN = 'https://www.tarppi.site'

type SeoMetaProps = {
  title: string
  description: string
  path: string
}

export function SeoMeta({ title, description, path }: SeoMetaProps) {
  const url = `${CANONICAL_ORIGIN}${path}`

  useEffect(() => {
    upsertHeadElement<HTMLMetaElement>(
      'meta[name="description"]',
      () => {
        const meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        return meta
      },
      (meta) => meta.setAttribute('content', description),
    )

    upsertHeadElement<HTMLLinkElement>(
      'link[rel="canonical"]',
      () => {
        const link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        return link
      },
      (link) => link.setAttribute('href', url),
    )

    upsertMetaProperty('og:title', title)
    upsertMetaProperty('og:description', description)
    upsertMetaProperty('og:url', url)
    upsertMetaName('twitter:title', title)
    upsertMetaName('twitter:description', description)
  }, [description, title, url])

  return (
    <Helmet>
      <title>{title}</title>
    </Helmet>
  )
}

function upsertMetaName(name: string, content: string) {
  upsertHeadElement<HTMLMetaElement>(
    `meta[name="${name}"]`,
    () => {
      const meta = document.createElement('meta')
      meta.setAttribute('name', name)
      return meta
    },
    (meta) => meta.setAttribute('content', content),
  )
}

function upsertMetaProperty(property: string, content: string) {
  upsertHeadElement<HTMLMetaElement>(
    `meta[property="${property}"]`,
    () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', property)
      return meta
    },
    (meta) => meta.setAttribute('content', content),
  )
}

function upsertHeadElement<T extends HTMLElement>(
  selector: string,
  create: () => T,
  update: (element: T) => void,
) {
  const matches = Array.from(document.head.querySelectorAll<T>(selector))
  const element = matches[0] ?? create()

  if (matches.length === 0) document.head.appendChild(element)
  for (const duplicate of matches.slice(1)) duplicate.remove()

  update(element)
}
