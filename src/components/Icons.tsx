import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const ArrowLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)
export const ArrowRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)
export const Close = (p: P) => (
  <svg {...base} {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)
export const Share = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </svg>
)
export const Pin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const Chevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const Bookmark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3h12v18l-6-4-6 4Z" />
  </svg>
)
export const Check = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)
export const Rotate = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
)
export const Arch = ({ size = 28, ...p }: P & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="currentColor" {...p}>
    <path d="M2 26V14a12 12 0 0 1 24 0v12h-7V15a5 5 0 0 0-10 0v11Z" />
  </svg>
)
