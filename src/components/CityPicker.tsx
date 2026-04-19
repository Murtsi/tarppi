import { useState, useRef, useEffect, useMemo } from 'react'
import { C, F } from '../lib/lt/tokens'
import KIDE_CITIES from '../lib/kide/kide-cities.json'

type KideCity = { id: string | null; name: string; nameKey?: string }

type CityPickerProps = {
  value: string
  onChange: (cityId: string) => void
  placeholder: string
  disabled?: boolean
}

const CITIES = (KIDE_CITIES as KideCity[]).filter(
  (c) => c.id !== null && !c.id.includes('Cities'),
)

const QUICK = ['Helsinki', 'Tampere', 'Turku', 'Espoo', 'Oulu', 'Jyväskylä']

export default function CityPicker({ value, onChange, disabled }: CityPickerProps) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return CITIES
    const q = search.toLowerCase()
    return CITIES.filter((c) => c.name.toLowerCase().includes(q))
  }, [search])

  return (
    <div>
      {/* Quick picks */}
      {!search && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <button
            className={`lt-quickcity ${value === '' ? 'is-active' : ''}`}
            onClick={() => onChange('')}
          >
            Kaikkialla
          </button>
          {QUICK.map((name) => (
            <button
              key={name}
              className={`lt-quickcity ${value === name ? 'is-active' : ''}`}
              onClick={() => onChange(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: C.inkMuted, fontSize: 13, pointerEvents: 'none',
        }}>⌕</span>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hae kaupunkia…"
          disabled={disabled}
          style={{
            width: '100%',
            background: 'var(--lt-panel2)',
            border: `1px solid var(--lt-rule)`,
            borderRadius: 8,
            padding: '8px 10px 8px 30px',
            fontFamily: F.sans,
            fontSize: 13,
            color: 'var(--lt-ink)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--lt-rule-strong)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--lt-rule)')}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: C.inkMuted,
              cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1,
            }}
          >×</button>
        )}
      </div>

      {/* City list */}
      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {!search && (
          <div style={{ padding: '6px 4px 4px', fontFamily: F.mono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.inkMuted }}>
            Kaikki kaupungit
          </div>
        )}
        {filtered.map((city) => {
          const active = city.id === value
          return (
            <button
              key={city.id}
              className="lt-cityrow"
              style={{
                borderLeft: active ? `2px solid ${C.accent}` : '2px solid transparent',
                color: active ? C.ink : 'var(--lt-ink-soft)',
                paddingLeft: active ? 10 : 10,
              }}
              onClick={() => city.id && onChange(city.id)}
            >
              <span style={{ flex: 1 }}>{city.name}</span>
              {active && <span style={{ color: C.accent, fontSize: 11, fontFamily: F.mono }}>valittu</span>}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '16px 0', fontFamily: F.mono, fontSize: 11, color: C.inkMuted, textAlign: 'center' }}>
            Ei tuloksia haulle "{search}"
          </div>
        )}
      </div>
    </div>
  )
}
