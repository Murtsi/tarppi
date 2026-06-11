export function decodeJwtExpiryMs(token: string): number | null {
  const [, payload] = token.split('.')
  if (!payload) return null

  try {
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const decoded = atob(padded)
    const parsed = JSON.parse(decoded) as { exp?: unknown }
    return typeof parsed.exp === 'number' ? parsed.exp * 1000 : null
  } catch {
    return null
  }
}
