/**
 * Kidehiiri SVG logo — "kide" (crystal/ticket) + "hiiri" (mouse).
 * Inline SVG, no external files needed.
 */

/** Compact icon: ticket with mouse silhouette */
export function KidehiiriIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kidehiiri"
    >
      {/* Tiketti-pohja */}
      <rect x="4" y="10" width="32" height="20" rx="3" fill="#6366f1" />

      {/* Tiketti-leikkaukset sivuilla */}
      <circle cx="4" cy="20" r="4" fill="#0f0f0f" />
      <circle cx="36" cy="20" r="4" fill="#0f0f0f" />

      {/* Katkoviiva tiketissä */}
      <line x1="12" y1="20" x2="28" y2="20" stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="2 2" />

      {/* Hiiren korvat */}
      <circle cx="14" cy="11" r="3" fill="#818cf8" />
      <circle cx="22" cy="11" r="3" fill="#818cf8" />

      {/* Hiiren pää */}
      <ellipse cx="18" cy="15" rx="6" ry="5" fill="#818cf8" />

      {/* Silmät */}
      <circle cx="16" cy="14" r="1" fill="#0f0f0f" />
      <circle cx="20" cy="14" r="1" fill="#0f0f0f" />

      {/* Nenä */}
      <circle cx="18" cy="16" r="0.8" fill="#c7d2fe" />
    </svg>
  )
}

/** Full logo: ticket-K + "idehiiri" text + mouse silhouette */
export function KidehiiriLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size * 4}
      height={size}
      viewBox="0 0 160 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kidehiiri"
    >
      {/* K-kirjain tiketti-muodossa */}
      <rect x="0" y="8" width="28" height="24" rx="4" fill="#6366f1" />
      <circle cx="0" cy="20" r="4" fill="#0f0f0f" />
      <circle cx="28" cy="20" r="4" fill="#0f0f0f" />
      <text x="7" y="25" fontSize="16" fontWeight="bold" fill="white" fontFamily="monospace">K</text>

      {/* Teksti */}
      <text x="36" y="27" fontSize="18" fontWeight="700" fill="#e2e8f0" fontFamily="system-ui, sans-serif">
        idehiiri
      </text>

      {/* Pieni hiiri-ikoni */}
      <circle cx="148" cy="14" r="4" fill="#818cf8" />
      <circle cx="155" cy="14" r="4" fill="#818cf8" />
      <ellipse cx="151" cy="20" rx="7" ry="6" fill="#818cf8" />
      <circle cx="149" cy="19" r="1.2" fill="#1e1e2e" />
      <circle cx="153" cy="19" r="1.2" fill="#1e1e2e" />
    </svg>
  )
}
