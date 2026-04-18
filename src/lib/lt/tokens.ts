export const C = {
  bg:        '#0f100e',
  panel:     '#161814',
  panel2:    '#1c1e19',
  ink:       '#eceae2',
  inkSoft:   '#8a8d80',
  inkMuted:  '#5a5d52',
  rule:      'rgba(236,234,226,0.08)',
  ruleStr:   'rgba(236,234,226,0.16)',
  accent:    '#4ade80',
  accentDim: 'rgba(74,222,128,0.22)',
  buy:       '#4ade80',
  maybe:     '#fbbf24',
  skip:      '#f87171',
  magenta:   '#e879f9',
}

export const F = {
  display: "'Fraunces', 'Georgia', serif",
  sans:    "'Geist', -apple-system, system-ui, sans-serif",
  mono:    "'Geist Mono', 'JetBrains Mono', ui-monospace, monospace",
}

export function decCol(d?: string) {
  if (d === 'BUY')   return C.buy
  if (d === 'MAYBE') return C.maybe
  return C.skip
}

export function evGlyph(name: string) {
  const w = name.split(/[\s·—–]+/).filter(Boolean)
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? w[0]?.[1] ?? '')).toUpperCase()
}

export function fmtElapsed(s: number) {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

export function nowStr() {
  return new Date().toLocaleTimeString('fi-FI', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export function uid() { return Math.random().toString(36).slice(2, 9) }
