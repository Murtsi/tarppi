export type ApiConfig = {
  apiUrl: string
  configured: boolean
  isProduction: boolean
  error?: string
}

export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConfigurationError'
  }
}

export function normaliseApiUrl(rawApiUrl?: string): string {
  return (rawApiUrl ?? '').trim().replace(/\/+$/, '')
}

export function getApiConfig(rawApiUrl: string | undefined, isProduction: boolean): ApiConfig {
  const apiUrl = normaliseApiUrl(rawApiUrl)

  if (!apiUrl && isProduction) {
    return {
      apiUrl,
      configured: false,
      isProduction,
      error: 'API-osoite puuttuu. Aseta Vercelissä VITE_API_URL palvelun osoitteeksi.',
    }
  }

  return {
    apiUrl,
    configured: true,
    isProduction,
  }
}

export function buildApiUrl(config: ApiConfig, path: string): string {
  if (!config.configured) {
    throw new ApiConfigurationError(config.error ?? 'API-osoite puuttuu.')
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${config.apiUrl}${cleanPath}`
}
