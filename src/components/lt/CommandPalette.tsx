import { useEffect, useRef, useState } from 'react'
import { C, F } from '../../lib/lt/tokens'
import { Kbd } from '../../lib/lt/primitives'

export type Command = {
  id: string
  icon: string
  label: string
  hint?: string
  run: () => void
}

type Props = {
  open: boolean
  onClose: () => void
  commands: Command[]
  onSubmitUrl?: (url: string) => void
}

export default function CommandPalette({ open, onClose, commands, onSubmitUrl }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()))
  const looksLikeUrl = /^https?:\/\//i.test(q.trim())

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((n) => Math.min(filtered.length - 1, n + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((n) => Math.max(0, n - 1)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        if (looksLikeUrl && onSubmitUrl) {
          onSubmitUrl(q.trim())
          onClose()
        } else if (filtered[idx]) {
          filtered[idx].run()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, idx, looksLikeUrl, q, onSubmitUrl, onClose])

  if (!open) return null

  return (
    <div className="lt-palette-overlay" onClick={onClose}>
      <div className="lt-palette" onClick={(e) => e.stopPropagation()}>
        <div className="lt-palette__head">
          <span style={{ color: C.inkSoft }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0) }}
            placeholder="Hae tai liitä Kide.app-URL…"
            className="lt-palette__input"
          />
          <Kbd>esc</Kbd>
        </div>

        {looksLikeUrl && (
          <div
            className="lt-palette__row is-active"
            onClick={() => { if (onSubmitUrl) { onSubmitUrl(q.trim()); onClose() } }}
          >
            <span style={{ width: 22, textAlign: 'center', color: C.accent }}>⤓</span>
            <span style={{ flex: 1 }}>Käynnistä seuranta URL:sta</span>
            <Kbd>⏎</Kbd>
          </div>
        )}

        {!looksLikeUrl && filtered.length === 0 && (
          <div style={{ padding: '16px', color: C.inkMuted, fontFamily: F.mono, fontSize: 12 }}>
            Ei osumia. Liitä Kide.app-URL käynnistääksesi seurannan.
          </div>
        )}

        {!looksLikeUrl && filtered.map((cmd, i) => (
          <div
            key={cmd.id}
            className={`lt-palette__row ${i === idx ? 'is-active' : ''}`}
            onMouseEnter={() => setIdx(i)}
            onClick={() => { cmd.run(); onClose() }}
          >
            <span style={{ width: 22, textAlign: 'center', color: C.inkSoft }}>{cmd.icon}</span>
            <span style={{ flex: 1 }}>{cmd.label}</span>
            {cmd.hint && <Kbd>{cmd.hint}</Kbd>}
          </div>
        ))}
      </div>
    </div>
  )
}
