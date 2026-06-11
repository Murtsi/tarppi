import { useEffect, useMemo, useRef, useState } from 'react'
import KIDE_CITIES from '../../lib/kide/kide-cities.json'

type KideCity = { id: string | null; name: string }

type Props = {
  value: string
  onChange: (cityId: string) => void
  onClose: () => void
}

const CITIES = (KIDE_CITIES as KideCity[]).filter(
  (city) => city.id !== null && !city.id.includes('Cities'),
) as Array<KideCity & { id: string }>

const QUICK = ['Helsinki', 'Tampere', 'Turku', 'Espoo', 'Oulu', 'Jyväskylä']

export default function SimpleCityPicker({ value, onChange, onClose }: Props) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return CITIES
    const query = search.trim().toLowerCase()
    return CITIES.filter((city) => city.name.toLowerCase().includes(query))
  }, [search])

  return (
    <div className="simple-overlay" onClick={onClose}>
      <div className="simple-citysheet" onClick={(event) => event.stopPropagation()}>
        <div className="simple-citysheet__head">
          <div>
            <h2>Kaupunki</h2>
            <p>Valitse yksi tai hae listasta.</p>
          </div>
          <button
            className="simple-button simple-button--ghost simple-citysheet__close"
            onClick={onClose}
            aria-label="Sulje"
          >
            ×
          </button>
        </div>

        <div className="simple-citysheet__search">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Hae kaupunkia"
          />
        </div>

        {!search && (
          <div className="simple-citysheet__quick">
            <button
              className={`simple-chip ${value === '' ? 'is-active' : ''}`}
              onClick={() => onChange('')}
            >
              Kaikki
            </button>
            {QUICK.map((name) => (
              <button
                key={name}
                className={`simple-chip ${value === name ? 'is-active' : ''}`}
                onClick={() => onChange(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="simple-citysheet__list">
          {filtered.map((city) => {
            const active = city.id === value
            return (
              <button
                key={city.id}
                className={`simple-cityoption ${active ? 'is-active' : ''}`}
                onClick={() => onChange(city.id)}
              >
                <span>{city.name}</span>
                {active && <small>Valittu</small>}
              </button>
            )
          })}

          {filtered.length === 0 && (
            <div className="simple-citysheet__empty">
              Ei osumia haulla "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
