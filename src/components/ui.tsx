import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Answer, Statement as StatementData } from '../data/types'
import { useNav } from '../lib/nav'
import { Bookmark, BookmarkSolid, Check, ChevronLeft, Close, Share } from './Icons'
import './components.css'

/* ---------- Button ---------- */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'outline' | 'outline-soft' | 'accent-outline'
  to?: string
  /** Appends the arrow glyph used on the Figma buttons ("Enter The Met  →"). */
  arrow?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({ variant = 'primary', to, arrow, children, className, ...rest }: ButtonProps) {
  const nav = useNav()
  const cls = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')
  const inner = (
    <>
      {children}
      {arrow && <span aria-hidden="true">{'  →'}</span>}
    </>
  )
  if (to && !rest.disabled) {
    return (
      <Link to={to} className={cls} onClick={() => nav.markForward()}>
        {inner}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} {...rest}>
      {inner}
    </button>
  )
}

/* ---------- Chip ---------- */

export function Chip({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <span className={`chip ${muted ? 'chip--muted' : ''}`}>{children}</span>
}

/* ---------- Top app bar ---------- */

interface AppBarProps {
  eyebrow: string
  title?: string
  left?: 'back' | 'close' | 'none'
  onLeft?: () => void
  right?: ReactNode
}

export function TopAppBar({ eyebrow, title, left = 'back', onLeft, right }: AppBarProps) {
  const nav = useNav()
  const handleLeft = onLeft ?? (() => nav.back())
  return (
    <header className="appbar">
      {left === 'none' ? (
        <span />
      ) : (
        <button
          type="button"
          className="icon-button"
          aria-label={left === 'back' ? 'Back' : 'Close'}
          onClick={handleLeft}
        >
          {left === 'back' ? <ChevronLeft /> : <Close />}
        </button>
      )}
      <div className="appbar__title">
        <p className="t-label t-label--11 t-label--accent">{eyebrow}</p>
        {title && <h1 className="appbar__name">{title}</h1>}
      </div>
      {right ?? <span />}
    </header>
  )
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="icon-button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  )
}

export function ShareButton({ onClick }: { onClick: () => void }) {
  return (
    <IconButton label="Share" onClick={onClick}>
      <Share />
    </IconButton>
  )
}

/* ---------- Info card ---------- */

export function InfoCard({
  eyebrow,
  children,
  serif,
  labelSize = 10,
}: {
  eyebrow: string
  children: ReactNode
  serif?: boolean
  labelSize?: 10 | 11
}) {
  return (
    <section className={`card ${serif ? 'card--serif' : 'card--16'}`}>
      <p className={`t-label t-label--accent ${labelSize === 11 ? 't-label--11' : ''}`}>{eyebrow}</p>
      <p className="card__text">{children}</p>
    </section>
  )
}

/* ---------- Statement with 7-point scale ---------- */

const DOT_SIZES = [48, 40, 32, 26, 32, 40, 48]
const ANSWERS: Answer[] = [1, 2, 3, 4, 5, 6, 7]
const DOT_LABELS = [
  'Strongly agree',
  'Agree',
  'Somewhat agree',
  'Neutral',
  'Somewhat disagree',
  'Disagree',
  'Strongly disagree',
]

export function Statement({
  statement,
  value,
  onChange,
}: {
  statement: StatementData
  value: Answer | undefined
  onChange: (a: Answer) => void
}) {
  return (
    <div className="statement">
      <p className="statement__text" id={`${statement.id}-label`}>
        {statement.text}
      </p>
      <div className="scale" role="radiogroup" aria-labelledby={`${statement.id}-label`}>
        {ANSWERS.map((a, i) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            aria-label={DOT_LABELS[i]}
            className={`scale__dot ${i < 3 ? 'scale__dot--agree' : i > 3 ? 'scale__dot--disagree' : ''}`}
            style={{ ['--dot-size' as string]: `${DOT_SIZES[i]}px` }}
            onClick={() => onChange(a)}
          >
            <Check aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="scale__labels" aria-hidden="true">
        <span>Agree</span>
        <span>Disagree</span>
      </div>
    </div>
  )
}

/* ---------- Door card ---------- */

export function DoorCard({
  name,
  reason,
  recommended,
  onClick,
}: {
  name: string
  reason: string
  recommended?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`door ${recommended ? 'door--recommended' : ''}`}
      onClick={onClick}
      aria-label={`${recommended ? 'Your door: ' : ''}${name}. ${reason}`}
    >
      <span className="door__arch" aria-hidden="true" />
      <span className="door__text">
        {recommended && <span className="t-label t-label--accent">Your door</span>}
        <span className="door__name">{name}</span>
        <span className="door__reason">{reason}</span>
      </span>
    </button>
  )
}

/* ---------- Save toggle ---------- */

export function SaveToggle({
  saved,
  onToggle,
  disabled,
}: {
  saved: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`btn btn--accent-outline ${saved ? 'is-on' : ''}`}
      aria-pressed={saved}
      onClick={onToggle}
      disabled={disabled}
    >
      {saved ? <BookmarkSolid width={20} height={20} /> : <Bookmark width={20} height={20} />}
      {saved ? 'Saved to My Gallery' : 'Save to My Gallery'}
    </button>
  )
}

/* ---------- Breadcrumb trail ---------- */

export function PathTrail({ stops, current }: { stops: string[]; current: string }) {
  const ref = useRef<HTMLElement>(null)
  // Long walks overflow the column: keep the current room in view.
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [stops.length, current])
  return (
    <nav className="trail" aria-label="Your path so far" ref={ref}>
      {stops.map((s, i) => {
        const isCurrent = s === current
        return (
          <span key={s} className="row" style={{ gap: 6 }}>
            {i > 0 && <span className="trail__link" aria-hidden="true" />}
            <span className={`trail__dot ${isCurrent ? 'trail__dot--current' : ''}`} aria-hidden="true" />
            <span className={`trail__name ${isCurrent ? 'trail__name--current' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              {s}
            </span>
          </span>
        )
      })}
      <span className="trail__ahead" aria-hidden="true" />
    </nav>
  )
}

/* ---------- Screen shell ---------- */

export function Screen({
  dark,
  center,
  children,
  footer,
  className,
}: {
  dark?: boolean
  center?: boolean
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <main className={['screen', dark && 'screen--dark', center && 'screen--center', className].filter(Boolean).join(' ')}>
      <div className="screen__body">{children}</div>
      {footer && (
        <>
          <div className="spacer" />
          <div className="screen__footer">{footer}</div>
        </>
      )}
    </main>
  )
}

/* ---------- Toast ---------- */

export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? (
    <div className="toast" role="status">
      {msg}
    </div>
  ) : null
  return [node, setMsg]
}
