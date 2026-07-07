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
  if (isProduction) {
    return {
      apiUrl: '',
      configured: true,
      isProduction,
    }
  }

  const apiUrl = normaliseApiUrl(rawApiUrl)

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
