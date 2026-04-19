import { useState, useEffect, useRef } from 'react'
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
  onValidate: (draftToken: string) => Promise<void>
}

// Strip Kide.app WARNING prefix and surrounding JSON quotes, then trim.
// Handles: plain token, "token", WARNING:...! token, "WARNING:...! token"
function stripKideWarning(raw: string): string {
  let s = raw.trim()
  // Remove surrounding JSON quotes (copied from DevTools Application panel)
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1)
  // Remove WARNING prefix (Kide.app DevTools console warning)
  const idx = s.lastIndexOf('!')
  if (idx !== -1) {
    const after = s.slice(idx + 1).trim()
    if (after.length > 10) return after
  }
  return s.trim()
}

export default function TokenDrawer(p: Props) {
  const [token, setToken] = useState(p.token)
  const [pollMs, setPollMs] = useState(p.pollMs)
  const [fallback, setFallback] = useState(p.fallbackMode)
  const [proxyUrl, setProxyUrl] = useState(p.proxyUrl)
  const [validating, setValidating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (p.open) {
      setToken(p.token)
      setPollMs(p.pollMs)
      setFallback(p.fallbackMode)
      setProxyUrl(p.proxyUrl)
    }
  }, [p.open])

  // Escape käsitellään keskitetysti App.tsx:ssä, joten ei tarvita erillistä kuuntelijaa

  const handleValidate = async () => {
    if (!token.trim()) return
    setValidating(true)
    try { await p.onValidate(token) } finally { setValidating(false) }
  }

  const handleProxyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? ''
      const line = text.split('\n').map((l) => l.trim()).find((l) => l.startsWith('http'))
      if (line) setProxyUrl(line)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!p.open) return null

  return (
    <div className="lt-palette-overlay" onClick={p.onClose}>
      <div className="lt-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="lt-drawer__head">
          <div style={{ fontFamily: F.display, fontStyle: 'italic', fontSize: 22, color: C.ink, letterSpacing: '-0.02em' }}>
            Asetukset
          </div>
          <span style={{ flex: 1 }} />
          <button className="lt-iconbtn" onClick={p.onClose}>×</button>
        </div>

        <div className="lt-drawer__body">
          {/* Token */}
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
              <button
                className="lt-btn lt-btn--ghost"
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? 'Tarkistetaan…' : 'Tarkista'}
              </button>
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
              <div>3. Kirjoita: <span style={{ color: C.accent, letterSpacing: 0 }}>copy(localStorage.getItem('authorization.token'))</span></div>
              <div>4. Liitä tähän — WARNING-viesti poistetaan automaattisesti</div>
            </div>
          </div>

          {/* Poll interval */}
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

          {/* Fallback mode */}
          <div style={{ marginBottom: 18 }}>
            <Lbl>Varareitti</Lbl>
            <label className="lt-toggle">
              <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              <span>{fallback ? 'Päällä — kokeile pienempää määrää' : 'Pois'}</span>
            </label>
          </div>

          {/* Proxy URL */}
          <div style={{ marginBottom: 18 }}>
            <Lbl>Proxy URL (valinnainen)</Lbl>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://proxy:8080"
                style={{
                  flex: 1,
                  background: 'var(--lt-panel2)',
                  border: '1px solid var(--lt-rule)',
                  color: 'var(--lt-ink)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontFamily: F.mono,
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                className="lt-btn lt-btn--ghost"
                onClick={() => fileInputRef.current?.click()}
                title="Lataa proxy-osoite tiedostosta"
                style={{ flexShrink: 0, padding: '0 12px', fontSize: 13 }}
              >
                📂
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.conf,.pac,.env"
                style={{ display: 'none' }}
                onChange={handleProxyFile}
              />
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkMuted, marginTop: 4 }}>
              Kirjoita osoite tai lataa tiedostosta (etsii ensimmäisen http-rivin)
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
