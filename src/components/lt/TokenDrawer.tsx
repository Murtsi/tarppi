import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { ThemeMode } from '../../lib/theme'

type Props = {
  open: boolean
  onClose: () => void
  token: string
  tokenValid: boolean
  tokenEmail?: string
  pollMs: number
  fallbackMode: boolean
  notifyEnabled: boolean
  telegramChatId: string
  proxyUrl: string
  theme: ThemeMode
  onSave: (next: {
    token: string
    pollMs: number
    fallbackMode: boolean
    notifyEnabled: boolean
    telegramChatId: string
    proxyUrl: string
    theme: ThemeMode
  }) => void
  onValidate: (draftToken: string) => Promise<void>
}

function stripKideWarning(raw: string): string {
  let value = raw.trim()
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
  const warningEnd = value.lastIndexOf('!')
  if (warningEnd !== -1) {
    const afterWarning = value.slice(warningEnd + 1).trim()
    if (afterWarning.length > 10) return afterWarning
  }
  return value.trim()
}

export default function TokenDrawer(p: Props) {
  const [token, setToken] = useState(p.token)
  const [pollMs, setPollMs] = useState(p.pollMs)
  const [fallback, setFallback] = useState(p.fallbackMode)
  const [notifyEnabled, setNotifyEnabled] = useState(p.notifyEnabled)
  const [telegramChatId, setTelegramChatId] = useState(p.telegramChatId)
  const [proxyUrl, setProxyUrl] = useState(p.proxyUrl)
  const [theme, setTheme] = useState<ThemeMode>(p.theme)
  const [validating, setValidating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!p.open) return
    setToken(p.token)
    setPollMs(p.pollMs)
    setFallback(p.fallbackMode)
    setNotifyEnabled(p.notifyEnabled)
    setTelegramChatId(p.telegramChatId)
    setProxyUrl(p.proxyUrl)
    setTheme(p.theme)
  }, [p.fallbackMode, p.notifyEnabled, p.open, p.pollMs, p.proxyUrl, p.telegramChatId, p.theme, p.token])

  const handleValidate = async () => {
    if (!token.trim()) return
    setValidating(true)
    try {
      await p.onValidate(token)
    } finally {
      setValidating(false)
    }
  }

  const handleProxyFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      const text = (readerEvent.target?.result as string) ?? ''
      const line = text.split('\n').map((row) => row.trim()).find((row) => row.startsWith('http'))
      if (line) setProxyUrl(line)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (!p.open) return null

  return (
    <div className="simple-overlay" onClick={p.onClose}>
      <div className="simple-settings" onClick={(event) => event.stopPropagation()}>
        <div className="simple-settings__head">
          <div>
            <h2>Asetukset</h2>
            <p>Token, ilmoitukset ja ulkoasu.</p>
          </div>
          <button className="simple-button simple-button--ghost simple-settings__close" onClick={p.onClose}>
            ×
          </button>
        </div>

        <div className="simple-settings__body">
          <section className="simple-settings__section">
            <div className="simple-settings__label">Kide.app-token</div>
            <textarea
              value={token}
              onChange={(event) => setToken(stripKideWarning(event.target.value))}
              rows={3}
              placeholder="Liitä token tai koko WARNING-viesti tähän"
              className="simple-settings__input simple-settings__textarea"
            />
            <div className="simple-settings__row">
              <button
                className="simple-button simple-button--ghost"
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? 'Tarkistetaan...' : 'Tarkista'}
              </button>
              <span className={`simple-settings__tokenstate ${p.tokenValid ? 'is-ok' : 'is-bad'}`}>
                {p.tokenValid ? `Kunnossa: ${p.tokenEmail ?? 'token toimii'}` : 'Token puuttuu tai ei toimi'}
              </span>
            </div>
            <div className="simple-settings__hint">
              <strong>Mistä token löytyy?</strong>
              <span>
                Avaa kide.app, kirjaudu sisään, avaa Console ja aja{' '}
                <code>copy(localStorage.getItem('authorization.token'))</code>. Liitä tulos tähän.
              </span>
            </div>
          </section>

          <section className="simple-settings__section">
            <div className="simple-settings__split">
              <div>
                <div className="simple-settings__label">Pollausväli</div>
                <p>Nopeampi arvo reagoi aiemmin, mutta kuormittaa enemmän.</p>
              </div>
              <strong>{pollMs} ms</strong>
            </div>
            <input
              type="range"
              min={200}
              max={2000}
              step={100}
              value={pollMs}
              onChange={(event) => setPollMs(Number(event.target.value))}
              className="simple-settings__range"
            />
            <div className="simple-settings__range-labels">
              <span>Nopea 200 ms</span>
              <span>Rauhallinen 2000 ms</span>
            </div>
          </section>

          <section className="simple-settings__section simple-settings__toggles">
            <label className="simple-switch">
              <input type="checkbox" checked={fallback} onChange={(event) => setFallback(event.target.checked)} />
              <span />
              <div>
                <strong>Varareitti</strong>
                <small>Kokeile pienempää määrää, jos valittu määrä ei mene koriin.</small>
              </div>
            </label>

            <label className="simple-switch">
              <input type="checkbox" checked={notifyEnabled} onChange={(event) => setNotifyEnabled(event.target.checked)} />
              <span />
              <div>
                <strong>Äänet ja ilmoitukset</strong>
                <small>Näytä ilmoitus ja soita merkkiääni, kun varaus onnistuu tai epäonnistuu.</small>
              </div>
            </label>
          </section>

          <section className="simple-settings__section">
            <div className="simple-settings__label">Ulkoasu</div>
            <div className="simple-segment" role="group" aria-label="Ulkoasu">
              <button
                type="button"
                className={theme === 'light' ? 'is-active' : ''}
                onClick={() => setTheme('light')}
              >
                Vaalea
              </button>
              <button
                type="button"
                className={theme === 'dark' ? 'is-active' : ''}
                onClick={() => setTheme('dark')}
              >
                Tumma
              </button>
            </div>
          </section>

          <section className="simple-settings__section">
            <div className="simple-settings__label">Telegram-botti</div>
            <div className="simple-settings__help">
              Botti on <strong>@Tarppibot</strong>. Lähetä sille mikä tahansa viesti. Se vastaa:
            </div>
            <div className="simple-settings__hint">
              <span>
                Tässä on Telegram Chat ID:si (chatid)<br />
                syötä Chat ID Kidehiiri sivulle valikkoon jotta saat ilmoituksen telegrammissa kun lippu on saatu kide.app koriisi.
              </span>
            </div>
            <div className="simple-settings__help">
              Kopioi Chat ID tähän. Sen jälkeen saat Telegramiin ilmoituksen, kun varaus menee läpi.
            </div>
            <input
              type="text"
              value={telegramChatId}
              onChange={(event) => setTelegramChatId(event.target.value)}
              placeholder="123456789 tai -100..."
              className="simple-settings__input"
            />
            <div className="simple-settings__help">
              Jos jätät kentän tyhjäksi, käytetään palvelimen oletusvastaanottajaa.
            </div>
          </section>

          <section className="simple-settings__section">
            <div className="simple-settings__label">Proxy URL</div>
            <div className="simple-settings__inline">
              <input
                type="text"
                value={proxyUrl}
                onChange={(event) => setProxyUrl(event.target.value)}
                placeholder="http://proxy:8080"
                className="simple-settings__input"
              />
              <button
                className="simple-button simple-button--ghost"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Tiedosto
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.conf,.pac,.env"
                style={{ display: 'none' }}
                onChange={handleProxyFile}
              />
            </div>
            <div className="simple-settings__help">
              Valinnainen. Jos et käytä proxya, jätä tyhjäksi.
            </div>
          </section>
        </div>

        <div className="simple-settings__foot">
          <button className="simple-button simple-button--ghost" onClick={p.onClose}>Peruuta</button>
          <button
            className="simple-button simple-button--primary"
            onClick={() => {
              p.onSave({ token, pollMs, fallbackMode: fallback, notifyEnabled, telegramChatId, proxyUrl, theme })
              p.onClose()
            }}
          >
            Tallenna
          </button>
        </div>
      </div>
    </div>
  )
}
