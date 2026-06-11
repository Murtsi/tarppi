export const NOTIFY_ENABLED_KEY = 'kh.notifyEnabled'

let titleFlashTimer: ReturnType<typeof setInterval> | null = null

function readStorage(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

export function notificationsEnabled(): boolean {
  return readStorage(NOTIFY_ENABLED_KEY) !== '0'
}

export function setNotificationsEnabled(enabled: boolean): void {
  writeStorage(NOTIFY_ENABLED_KEY, enabled ? '1' : '0')
}

export function flashDocumentTitle(message: string): void {
  if (typeof document === 'undefined') return
  if (titleFlashTimer) window.clearInterval(titleFlashTimer)

  const original = document.title
  let flash = false
  const stop = () => {
    if (titleFlashTimer) window.clearInterval(titleFlashTimer)
    titleFlashTimer = null
    document.title = original
    window.removeEventListener('focus', stop)
  }

  titleFlashTimer = window.setInterval(() => {
    flash = !flash
    document.title = flash ? message : original
  }, 1_000)
  window.addEventListener('focus', stop, { once: true })
  window.setTimeout(stop, 30_000)
}

export function notifyBrowser(title: string, body: string): void {
  if (!notificationsEnabled()) return
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    // Browser notifications are best-effort.
  }
  flashDocumentTitle(title)
}

function playTone(frequencies: number[]): void {
  if (!notificationsEnabled()) return
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.gain.value = 0.05
    gain.connect(ctx.destination)

    frequencies.forEach((frequency, index) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequency
      osc.connect(gain)
      const start = ctx.currentTime + index * 0.16
      osc.start(start)
      osc.stop(start + 0.12)
    })

    window.setTimeout(() => void ctx.close().catch(() => {}), frequencies.length * 180 + 200)
  } catch {
    // Sound is best-effort and must never break the snipe loop.
  }
}

export function playSuccessSound(): void {
  playTone([660, 880])
}

export function playFailSound(): void {
  playTone([330, 220])
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}
