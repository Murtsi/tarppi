import { useState, useEffect } from 'react'
import { C, F } from '../../lib/lt/tokens'
import { Lbl } from '../../lib/lt/primitives'

type Props = {
  open: boolean
  onClose: () => void
  token: string
  tokenValid: boolean
  tokenEmail?: string
  pollMs: number
  fallbackMode: boolean
  proxyUrl: string
  onSave: (next: { token: string; pollMs: number; fallbackMode: boolean; proxyUrl: string }) => void
  onValidate: () => void
}

// Kide.app shows "WARNING: ...! <actual_token>" in DevTools — strip the prefix automatically
function stripKideWarning(raw: string): string {
  const trimmed = raw.trim()
  const match = trimmed.match(/^WARNING:.*?!\s+(.+)$/s)
  return match ? match[1].trim() : trimmed
}

export default function TokenDrawer(p: Props) {
  const [token, setToken] = useState(p.token)
  const [pollMs, setPollMs] = useState(p.pollMs)
  const [fallback, setFallback] = useState(p.fallbackMode)
  const [proxyUrl, setProxyUrl] = useState(p.proxyUrl)

  useEffect(() => { if (p.open) { setToken(p.token); setPollMs(p.pollMs); setFallback(p.fallbackMode); setProxyUrl(p.proxyUrl) } }, [p.open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && p.open) p.onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p.open, p.onClose])

  if (!p.open) return null

  return (
    <div className="lt-palette-overlay">
      <div className="lt-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lt-drawer__head">
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 22, color: C.ink, letterSpacing: '-0.02em' }}>
            Asetukset
          </div>
          <span style={{ flex: 1 }} />
          <button className="lt-iconbtn" onClick={p.onClose}>×</button>
        </div>

        <div className="lt-drawer__body">
          <div style={{ marginBottom: 18 }}>
            <Lbl>Kide.app-token</Lbl>
            <textarea
              value={token}
              onChange={(e) => setToken(stripKideWarning(e.target.value))}
              rows={3}
              placeholder="Liitä token tai koko WARNING-viesti tähän…"
              className="lt-input lt-input--area"
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <button className="lt-btn lt-btn--ghost" onClick={p.onValidate}>Tarkista</button>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: p.tokenValid ? C.accent : C.skip }}>
                {p.tokenValid ? `✓ ${p.tokenEmail ?? 'kelvollinen'}` : '✗ virheellinen'}
              </span>
            </div>
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${C.rule}`,
              borderRadius: 8,
              fontFamily: F.mono,
              fontSize: 10,
              color: C.inkSoft,
              lineHeight: 1.7,
            }}>
              <div style={{ color: C.inkMuted, marginBottom: 4, letterSpacing: '0.10em', textTransform: 'uppercase', fontSize: 9 }}>Miten saan tokenin</div>
              <div>1. Avaa <span style={{ color: C.ink }}>kide.app</span> selaimessa ja kirjaudu sisään</div>
              <div>2. Paina <span style={{ color: C.ink }}>F12</span> → <span style={{ color: C.ink }}>Console</span>-välilehti</div>
              <div>3. Kirjoita: <span style={{ color: C.accent, letterSpacing: 0 }}>copy(localStorage.getItem('token'))</span></div>
              <div>4. Liitä tähän — WARNING-viesti poistetaan automaattisesti</div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <Lbl>Pollausväli · {pollMs} ms</Lbl>
            <input
              type="range"
              min={200}
              max={2000}
              step={100}
              value={pollMs}
              onChange={(e) => setPollMs(Number(e.target.value))}
              className="lt-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 4 }}>
              <span>nopea 200 ms</span>
              <span>hidas 2000 ms</span>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <Lbl>Varareitti</Lbl>
            <label className="lt-toggle">
              <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              <span>{fallback ? 'Päällä — kokeile pienempää määrää' : 'Pois'}</span>
            </label>
          </div>

          <div style={{ marginBottom: 18 }}>
            <Lbl>Proxy URL (valinnainen)</Lbl>
            <input
              type="text"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="http://proxy:8080"
              className="lt-input"
            />
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 4 }}>
              HTTP/HTTPS-proxy pyyntöjen reitittämiseen
            </div>
          </div>
        </div>

        <div className="lt-drawer__foot">
          <button className="lt-btn lt-btn--ghost" onClick={p.onClose}>Peruuta</button>
          <button
            className="lt-btn lt-btn--primary"
            onClick={() => { p.onSave({ token, pollMs, fallbackMode: fallback, proxyUrl }); p.onClose() }}
          >
            Tallenna
          </button>
        </div>
      </div>
    </div>
  )
}
