import { useEffect, useState } from 'react'
import {
  KIDE_TOKEN_COPY_COMMAND,
  KIDE_URL,
  TELEGRAM_BOT_URL,
  normalisePastedKideToken,
} from '../../lib/kide-token'
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
  theme: ThemeMode
  onSave: (next: {
    token: string
    pollMs: number
    fallbackMode: boolean
    notifyEnabled: boolean
    telegramChatId: string
    theme: ThemeMode
  }) => void
  onValidate: (draftToken: string) => Promise<void>
}

export default function TokenDrawer(p: Props) {
  const [token, setToken] = useState(p.token)
  const [pollMs, setPollMs] = useState(p.pollMs)
  const [fallback, setFallback] = useState(p.fallbackMode)
  const [notifyEnabled, setNotifyEnabled] = useState(p.notifyEnabled)
  const [telegramChatId, setTelegramChatId] = useState(p.telegramChatId)
  const [theme, setTheme] = useState<ThemeMode>(p.theme)
  const [validating, setValidating] = useState(false)
  const [commandCopyState, setCommandCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (!p.open) return
    setToken(p.token)
    setPollMs(p.pollMs)
    setFallback(p.fallbackMode)
    setNotifyEnabled(p.notifyEnabled)
    setTelegramChatId(p.telegramChatId)
    setTheme(p.theme)
    setCommandCopyState('idle')
  }, [p.fallbackMode, p.notifyEnabled, p.open, p.pollMs, p.telegramChatId, p.theme, p.token])

  const handleValidate = async () => {
    if (!token.trim()) return
    setValidating(true)
    try {
      await p.onValidate(token)
    } finally {
      setValidating(false)
    }
  }

  const copyTokenCommand = async () => {
    try {
      await navigator.clipboard.writeText(KIDE_TOKEN_COPY_COMMAND)
      setCommandCopyState('copied')
    } catch {
      setCommandCopyState('failed')
    }
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
            <p>Token säilyy vain tässä selainistunnossa. Kun suljet selaimen, lisää se tarvittaessa uudelleen.</p>
            <textarea
              value={token}
              onChange={(event) => setToken(normalisePastedKideToken(event.target.value))}
              rows={3}
              placeholder="Liitä Kide.app-token tähän"
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
              <ol className="simple-token-steps">
                <li>Avaa Kide.app ja kirjaudu sisään.</li>
                <li>Kopioi alla oleva komento.</li>
                <li>Avaa Kide.app-sivulla Console, liitä komento ja paina Enter.</li>
                <li>Palaa tähän ja liitä kopioitu token kenttään.</li>
              </ol>
              <div className="simple-token-command">
                <code>{KIDE_TOKEN_COPY_COMMAND}</code>
              </div>
              <div className="simple-settings__actions">
                <a className="simple-button simple-button--ghost" href={KIDE_URL} target="_blank" rel="noreferrer">
                  Avaa Kide.app
                </a>
                <button type="button" className="simple-button simple-button--ghost" onClick={copyTokenCommand}>
                  {commandCopyState === 'copied' ? 'Komento kopioitu' : 'Kopioi komento'}
                </button>
              </div>
              {commandCopyState === 'failed' && (
                <span className="simple-settings__help">
                  Kopiointi ei onnistunut. Valitse komento ja kopioi se käsin.
                </span>
              )}
            </div>
          </section>

          <section className="simple-settings__section">
            <div className="simple-settings__label">Telegram-ilmoitukset</div>
            <p>Telegram on vapaaehtoinen. Jos haluat ilmoitukset, avaa @Tarppibot, kirjoita /start ja liitä saamasi Chat ID tähän.</p>
            <div className="simple-settings__inline simple-settings__inline--telegram">
              <input
                className="simple-settings__input"
                value={telegramChatId}
                onChange={(event) => setTelegramChatId(event.target.value)}
                placeholder="Chat ID"
                aria-label="Telegram Chat ID"
              />
              <a className="simple-button simple-button--ghost" href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
                Avaa Telegram
              </a>
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

        </div>

        <div className="simple-settings__foot">
          <button className="simple-button simple-button--ghost" onClick={p.onClose}>Peruuta</button>
          <button
            className="simple-button simple-button--primary"
            onClick={() => {
              p.onSave({ token, pollMs, fallbackMode: fallback, notifyEnabled, telegramChatId, theme })
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
