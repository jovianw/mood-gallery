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

export const ChevronLeft = (p: P) => (
  <svg {...base} {...p}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const ChevronDown = (p: P) => (
  <svg {...base} {...p}>
    <path d="m6 9 6 6 6-6" />
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
  <svg {...base} {...p} strokeWidth={1.8}>
    <path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </svg>
)
export const User = (p: P) => (
  <svg {...base} {...p} strokeWidth={1.8}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
)
export const Pin = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const PinSolid = (p: P) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Zm0-9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
  </svg>
)
export const Bookmark = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3h12v18l-6-4-6 4Z" />
  </svg>
)
export const BookmarkSolid = (p: P) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M6 3h12v18l-6-4-6 4Z" />
  </svg>
)
export const Check = (p: P) => (
  <svg {...base} {...p} strokeWidth={2.5}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)
export const CheckCircle = (p: P) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.6 14.2-4-4 1.4-1.4 2.6 2.6 6-6 1.4 1.4-7.4 7.4Z" />
  </svg>
)
export const Rotate = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 3v6h-6" />
  </svg>
)
export const Mail = (p: P) => (
  <svg {...base} {...p} strokeWidth={1.8}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
export const Download = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
  </svg>
)
export const Link = (p: P) => (
  <svg {...base} {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </svg>
)
export const Message = (p: P) => (
  <svg {...base} {...p}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12Z" />
  </svg>
)
export const PlusSquare = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </svg>
)
export const Google = (p: P) => (
  <svg width={20} height={20} viewBox="0 0 48 48" {...p}>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.5 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.4 17.7 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-16.8Z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1Z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-3.9-13.5-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48Z" />
  </svg>
)
/** Red arch logo: a rounded doorway on a short base. */
export const Arch = ({ size = 28, ...p }: P & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="currentColor" {...p}>
    <path d="M4 26V13a10 10 0 0 1 20 0v13h-6V14a4 4 0 0 0-8 0v12Z" />
  </svg>
)
/** Dashed empty frame for the empty gallery. */
export const EmptyFrame = (p: P) => (
  <svg width={72} height={72} viewBox="0 0 72 72" fill="none" {...p}>
    <rect x="8" y="8" width="56" height="56" rx="3" stroke="#6B6661" strokeWidth="1.5" />
    <rect x="18" y="18" width="36" height="36" rx="1" stroke="#6B6661" strokeWidth="1.5" strokeDasharray="4 4" />
  </svg>
)
