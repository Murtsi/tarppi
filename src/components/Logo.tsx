/**
 * Tärppi neon logo mark.
 *
 * Inline line-art SVG that draws with `currentColor`, so the header can tint it
 * with the theme accent (dark green in light mode, neon green in dark mode) and
 * add the glow via CSS. No external assets.
 */
export function TarppiMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Outer ticket-machine frame */}
      <rect x="20" y="16" width="60" height="68" rx="12" />
      {/* Twin top panels + connecting bar (the "T" crown) */}
      <path d="M40 30 v18" />
      <path d="M60 30 v18" />
      <path d="M39 30 h22" />
      {/* Central stem */}
      <path d="M50 30 v31" />
      {/* Side whisker / motion marks */}
      <path d="M30 45 l8 3" />
      <path d="M30 53 l8 -2" />
      <path d="M70 45 l-8 3" />
      <path d="M70 53 l-8 -2" />
      {/* Slot / smile */}
      <path d="M42 65 q8 8 16 0" />
    </svg>
  )
}
