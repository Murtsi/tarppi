import { useState, useRef, useEffect, useMemo } from 'react'
import KIDE_CITIES from '../lib/kide/kide-cities.json'

type KideCity = { id: string | null; name: string; nameKey?: string }

type CityPickerProps = {
  value: string
  onChange: (cityId: string) => void
  placeholder: string
  disabled?: boolean
}

// Only keep actual cities — region IDs (contain "Cities") don't work with the API
const CITIES = (KIDE_CITIES as KideCity[]).filter(
  (c) => c.id !== null && !c.id.includes('Cities'),
)

function findCityById(id: string): KideCity | undefined {
  return CITIES.find((c) => c.id === id)
}

export default function CityPicker({ value, onChange, placeholder, disabled }: CityPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredCities = useMemo(() => {
    if (!search.trim()) return CITIES
    const query = search.toLowerCase()
    return CITIES.filter((c) => c.name.toLowerCase().includes(query))
  }, [search])

  const displayValue = value
    ? (findCityById(value)?.name ?? value)
    : 'Everywhere'

  const handleSelect = (city: KideCity) => {
    onChange(city.id ?? '')
    setSearch('')
    setOpen(false)
  }

  return (
    <div className="city-picker" ref={wrapperRef}>
      <button
        type="button"
        className="city-picker-trigger"
        onClick={() => { if (!disabled) { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50) } }}
        disabled={disabled}
      >
        <span className="city-picker-flag">🇫🇮</span>
        <span className="city-picker-value">{displayValue}</span>
        <span className={`city-picker-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="city-picker-dropdown">
          <input
            ref={inputRef}
            type="text"
            className="city-picker-search"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <ul className="city-picker-list">
            {/* Show all cities */}
            <li
              className={`city-picker-option ${value === '' ? 'selected' : ''}`}
              onClick={() => handleSelect({ id: null, name: 'Everywhere' })}
            >
              🌍 Everywhere
            </li>

            {filteredCities.length > 0 && (
              <>
                <li className="city-picker-divider" />
                {filteredCities.map((city) => (
                  <li
                    key={city.id}
                    className={`city-picker-option ${city.id === value ? 'selected' : ''}`}
                    onClick={() => handleSelect(city)}
                  >
                    {city.name}
                  </li>
                ))}
              </>
            )}

            {filteredCities.length === 0 && (
              <li className="city-picker-empty">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
