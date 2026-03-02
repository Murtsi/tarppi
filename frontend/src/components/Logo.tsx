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

/** Sniper variant: ticket with bullet hole and smoke */
export function TicketSniperIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Kidehiiri Sniper"
    >
      <defs>
        <radialGradient id="bulletHole" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" />
          <stop offset="60%" stopColor="#111111" />
          <stop offset="100%" stopColor="#222222" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ticket (tilted) */}
      <g transform="rotate(-12, 60, 60)">
        {/* Shadow */}
        <rect x="23" y="28" width="76" height="48" rx="3" fill="#000000" opacity="0.15" transform="translate(2,3)" />
        
        {/* Main ticket */}
        <rect x="23" y="28" width="76" height="48" rx="3" fill="#ffffff" stroke="#000000" strokeWidth="2" />
        
        {/* Perforated line */}
        <line x1="43" y1="28" x2="43" y2="76" stroke="#000000" strokeWidth="1.2" strokeDasharray="3,2.5" />

        {/* Serrated right edge */}
        <path d="M99,28 Q102,31 99,34 Q102,37 99,40 Q102,43 99,46 Q102,49 99,52 Q102,55 99,58 Q102,61 99,64 Q102,67 99,70 Q102,73 99,76" fill="none" stroke="#000000" strokeWidth="1.2" />

        {/* Crack lines */}
        <g stroke="#000000" strokeWidth="0.7" opacity="0.7">
          <line x1="62" y1="50" x2="52" y2="40" />
          <line x1="64" y1="49" x2="61" y2="35" />
          <line x1="67" y1="50" x2="78" y2="41" />
          <line x1="68" y1="53" x2="79" y2="62" />
          <line x1="64" y1="56" x2="57" y2="66" />
          <line x1="60" y1="54" x2="50" y2="60" />
        </g>

        {/* Bullet hole */}
        <circle cx="64" cy="52" r="7" fill="url(#bulletHole)" />
        <circle cx="64" cy="52" r="5" fill="#000000" />
        <circle cx="64" cy="52" r="7" fill="none" stroke="#000000" strokeWidth="1.2" />

        {/* Smoke wisps */}
        <path d="M62,28 Q58,22 62,16 Q66,10 62,4" fill="none" stroke="#000000" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        <path d="M66,28 Q70,20 67,13" fill="none" stroke="#000000" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      </g>
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
