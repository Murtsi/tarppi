export const KIDE_TOKEN_COPY_COMMAND = "copy(localStorage.getItem('authorization.token'))"
export const KIDE_URL = 'https://kide.app'
export const TELEGRAM_BOT_URL = 'https://t.me/Tarppibot'

export function normalisePastedKideToken(raw: string): string {
  let value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)

  const warningEnd = value.lastIndexOf('!')
  if (warningEnd !== -1) {
    const afterWarning = value.slice(warningEnd + 1).trim()
    if (afterWarning.length > 10) return afterWarning
  }

  return value.trim()
}
