import { useState, useRef, useEffect, useMemo } from 'react'
import KIDE_CITIES from '../lib/kide/kide-cities.json'

type KideCity = { id: string | null; name: string; nameKey?: string }

type CityPickerProps = {
  value: string
  onChange: (cityId: string) => void
  placeholder: string
  disabled?: boolean
}

// Separate regions (id contains "Cities") from individual cities
const REGIONS = (KIDE_CITIES as KideCity[]).filter(
  (c) => c.id !== null && c.id.includes('Cities'),
)
const CITIES = (KIDE_CITIES as KideCity[]).filter(
  (c) => c.id !== null && !c.id.includes('Cities'),
)

function findCity(id: string): KideCity | undefined {
  return (KIDE_CITIES as KideCity[]).find((c) => c.id === id || c.name === id)
}

export default function CityPicker({ value, onChange, placeholder, disabled }: CityPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter cities based on search text
  const filteredCities = useMemo(() => {
    if (!search.trim()) return CITIES
    const q = search.toLowerCase()
    return CITIES.filter((c) => c.name.toLowerCase().includes(q))
  }, [search])

  const filteredRegions = useMemo(() => {
    if (!search.trim()) return REGIONS
    const q = search.toLowerCase()
    return REGIONS.filter((c) => c.name.toLowerCase().includes(q))
  }, [search])

  const displayValue = value
    ? (findCity(value)?.name ?? value)
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
            {/* "Everywhere" option */}
            <li
              className={`city-picker-option ${value === '' ? 'selected' : ''}`}
              onClick={() => handleSelect({ id: null, name: 'Everywhere' })}
            >
              🌍 Everywhere
            </li>

            {/* Regions */}
            {filteredRegions.length > 0 && (
              <>
                <li className="city-picker-divider" />
                <li className="city-picker-group-label">Regions</li>
                {filteredRegions.map((region) => (
                  <li
                    key={region.id}
                    className={`city-picker-option region ${region.id === value ? 'selected' : ''}`}
                    onClick={() => handleSelect(region)}
                  >
                    📍 {region.name}
                  </li>
                ))}
              </>
            )}

            {/* Individual cities */}
            {filteredCities.length > 0 && (
              <>
                <li className="city-picker-divider" />
                <li className="city-picker-group-label">Cities</li>
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

            {filteredRegions.length === 0 && filteredCities.length === 0 && (
              <li className="city-picker-empty">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
