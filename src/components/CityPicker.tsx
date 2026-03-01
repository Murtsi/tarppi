import { useState, useRef, useEffect, useMemo } from 'react'
import KIDE_CITIES from '../lib/kide/kide-cities.json'

type CityPickerProps = {
  value: string
  onChange: (city: string) => void
  allLabel: string
  placeholder: string
  disabled?: boolean
}

export default function CityPicker({ value, onChange, allLabel, placeholder, disabled }: CityPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

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
  const filtered = useMemo(() => {
    if (!search.trim()) return KIDE_CITIES as string[]
    const q = search.toLowerCase()
    return (KIDE_CITIES as string[]).filter((c) => c.toLowerCase().includes(q))
  }, [search])

  const displayValue = value || allLabel

  const handleSelect = (city: string) => {
    onChange(city)
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

          <ul className="city-picker-list" ref={listRef}>
            {/* "All of Finland" option */}
            <li
              className={`city-picker-option ${value === '' ? 'selected' : ''}`}
              onClick={() => handleSelect('')}
            >
              📍 {allLabel}
            </li>

            {/* Divider */}
            <li className="city-picker-divider" />

            {filtered.length === 0 ? (
              <li className="city-picker-empty">—</li>
            ) : (
              filtered.map((city) => (
                <li
                  key={city}
                  className={`city-picker-option ${city === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(city)}
                >
                  {city}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
