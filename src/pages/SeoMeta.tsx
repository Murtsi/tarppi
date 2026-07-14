import { Helmet } from 'react-helmet-async'

const CANONICAL_ORIGIN = 'https://www.tarppi.site'
const SOCIAL_IMAGE = `${CANONICAL_ORIGIN}/og-tarppi.png`

type SeoMetaProps = {
  title: string
  description: string
  path: string
  applicationSchema?: boolean
}

export function SeoMeta({ title, description, path, applicationSchema = false }: SeoMetaProps) {
  const url = `${CANONICAL_ORIGIN}${path}`

  return (
    <Helmet prioritizeSeoTags>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index,follow" />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:locale" content="fi_FI" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={SOCIAL_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={SOCIAL_IMAGE} />
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url,
        inLanguage: 'fi',
        isPartOf: {
          '@type': 'WebSite',
          name: 'Tärppi',
          url: CANONICAL_ORIGIN,
        },
      })}</script>
      {applicationSchema ? (
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Tärppi',
          url: CANONICAL_ORIGIN,
          description,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          inLanguage: 'fi',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'EUR',
          },
        })}</script>
      ) : null}
    </Helmet>
  )
}
