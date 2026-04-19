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

function findCityById(id: string): KideCity | undefined {
  return CITIES.find((c) => c.id === id)
}

export default function CityPicker({ value, onChange, placeholder, disabled }: CityPickerProps) {
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

  const selected = value ? findCityById(value)?.name : 'Everywhere'

  return (
    <div>
      <div style={{ marginBottom: 10, fontFamily: F.mono, fontSize: 11, color: C.inkSoft }}>
        Valittu: <span style={{ color: C.ink }}>{selected ?? value}</span>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="lt-input"
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          className={`lt-cityrow ${value === '' ? 'is-active' : ''}`}
          onClick={() => onChange('')}
        >
          <span style={{ fontSize: 14 }}>🌍</span>
          <span>Everywhere</span>
          {value === '' && <span style={{ marginLeft: 'auto', color: C.accent, fontSize: 12 }}>✓</span>}
        </button>
        {filtered.map((city) => (
          <button
            key={city.id}
            className={`lt-cityrow ${city.id === value ? 'is-active' : ''}`}
            onClick={() => city.id && onChange(city.id)}
          >
            <span style={{ fontSize: 14, color: C.inkMuted }}>◎</span>
            <span>{city.name}</span>
            {city.id === value && <span style={{ marginLeft: 'auto', color: C.accent, fontSize: 12 }}>✓</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '12px 0', fontFamily: F.mono, fontSize: 11, color: C.inkMuted, textAlign: 'center' }}>
            Ei tuloksia
          </div>
        )}
      </div>
    </div>
  )
}
