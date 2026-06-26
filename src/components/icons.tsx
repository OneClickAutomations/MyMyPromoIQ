/** Inline SVG icon set — sharp, consistent, no emoji as UI. */
import type { SVGProps } from 'react'

type I = SVGProps<SVGSVGElement>
const base = (p: I) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
})

export const PlayIcon = (p: I) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </svg>
)
export const ArrowRight = (p: I) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)
export const Check = (p: I) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const Upload = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </svg>
)
export const Wand = (p: I) => (
  <svg {...base(p)}>
    <path d="m15 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1zM10 11 4 17l3 3 6-6M13 8l3 3" />
  </svg>
)
export const Film = (p: I) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
  </svg>
)
export const Download = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
  </svg>
)
export const Spark = (p: I) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M12 2c.6 4.5 2.9 6.8 7.4 7.4-4.5.6-6.8 2.9-7.4 7.4-.6-4.5-2.9-6.8-7.4-7.4C9.1 8.8 11.4 6.5 12 2z" />
  </svg>
)
export const Bolt = (p: I) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />
  </svg>
)
export const Layers = (p: I) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />
  </svg>
)
export const Grid = (p: I) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)
export const Plus = (p: I) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const ChevronRight = (p: I) => (
  <svg {...base(p)}>
    <path d="M9 18l6-6-6-6" />
  </svg>
)
export const Users = (p: I) => (
  <svg {...base(p)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
export const Settings = (p: I) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const social = {
  x: (p: I) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M17.5 3h3l-7 8 8.2 10h-6.4l-5-6.1L8 21H5l7.4-8.5L4.5 3H11l4.5 5.5zM16 19h1.6L8 5H6.3z" />
    </svg>
  ),
  youtube: (p: I) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM10 15.5v-7l6 3.5z" />
    </svg>
  ),
  instagram: (p: I) => (
    <svg {...base(p)}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </svg>
  ),
  linkedin: (p: I) => (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M4.5 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 9h3v12H3zM9 9h2.8v1.7h.04c.4-.7 1.4-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.9V21h-3v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21H9z" />
    </svg>
  ),
} as const
