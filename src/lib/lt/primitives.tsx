import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import { C, F } from './tokens'

export function useTick(ms = 1000) {
  const [, set] = useState(0)
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

export function Dot({ color = C.accent, size = 6, pulse = false }: { color?: string; size?: number; pulse?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: pulse ? `0 0 0 0 ${color}` : 'none',
        animation: pulse ? 'lt-pulse 1.8s ease-out infinite' : 'none',
        flexShrink: 0,
      }}
    />
  )
}

export function Glyph({ text, size = 36 }: { text: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 6,
        background: C.panel2,
        border: `1px solid ${C.rule}`,
        display: 'grid',
        placeItems: 'center',
        fontFamily: F.display,
        fontStyle: 'italic',
        fontSize: Math.round(size * 0.42),
        color: C.ink,
        letterSpacing: '-0.02em',
      }}
    >
      {text}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: '0.05em',
        color: C.inkSoft,
        background: C.panel2,
        border: `1px solid ${C.rule}`,
        borderRadius: 4,
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  )
}

export function Lbl({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: C.inkMuted,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function Rule({ vertical = false }: { vertical?: boolean }) {
  return (
    <div
      style={{
        background: C.rule,
        [vertical ? 'width' : 'height']: 1,
        [vertical ? 'height' : 'width']: '100%',
        flexShrink: 0,
      } as CSSProperties}
    />
  )
}

export function Pill({ children, color = C.ink, bg = C.panel2 }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color,
        background: bg,
        border: `1px solid ${C.rule}`,
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
