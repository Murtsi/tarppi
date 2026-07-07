const KIDE_TOKEN_STORAGE_KEY = 'kh.token'

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export function readStoredKideToken(): string {
  const session = safeSessionStorage()
  const local = safeLocalStorage()
  const sessionToken = session?.getItem(KIDE_TOKEN_STORAGE_KEY)

  if (sessionToken) {
    local?.removeItem(KIDE_TOKEN_STORAGE_KEY)
    return sessionToken
  }

  const legacyToken = local?.getItem(KIDE_TOKEN_STORAGE_KEY) ?? ''
  if (legacyToken) {
    session?.setItem(KIDE_TOKEN_STORAGE_KEY, legacyToken)
    local?.removeItem(KIDE_TOKEN_STORAGE_KEY)
  }

  return legacyToken
}

export function writeStoredKideToken(token: string): void {
  const session = safeSessionStorage()
  const local = safeLocalStorage()
  const trimmed = token.trim()

  local?.removeItem(KIDE_TOKEN_STORAGE_KEY)
  if (trimmed) {
    session?.setItem(KIDE_TOKEN_STORAGE_KEY, trimmed)
  } else {
    session?.removeItem(KIDE_TOKEN_STORAGE_KEY)
  }
}
