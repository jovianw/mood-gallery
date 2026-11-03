import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Answer, Statement as StatementData } from '../data/types'
import { ArrowLeft, ArrowRight, Bookmark, Check, Close, Share } from './Icons'
import './components.css'

/* ---------- Button ---------- */

type ButtonProps = {
  variant?: 'primary' | 'secondary'
  to?: string
  arrow?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({ variant = 'primary', to, arrow, children, className, ...rest }: ButtonProps) {
  const cls = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight width={18} height={18} />}
    </>
  )
  if (to && !rest.disabled) {
    return (
      <Link to={to} className={cls}>
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

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>
}

/* ---------- Top app bar ---------- */

interface AppBarProps {
  eyebrow: string
  title?: string
  left?: 'back' | 'close' | 'none'
  onLeft?: () => void
  right?: 'share' | 'none'
  onRight?: () => void
}

export function TopAppBar({ eyebrow, title, left = 'back', onLeft, right = 'none', onRight }: AppBarProps) {
  const navigate = useNavigate()
  const handleLeft = onLeft ?? (() => navigate(-1))
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
          {left === 'back' ? <ArrowLeft /> : <Close />}
        </button>
      )}
      <div className="appbar__title">
        <p className={`t-label ${title ? '' : 't-label--accent'}`}>{eyebrow}</p>
        {title && <h1 className="t-room">{title}</h1>}
      </div>
      {right === 'share' ? (
        <button type="button" className="icon-button" aria-label="Share" onClick={onRight}>
          <Share />
        </button>
      ) : (
        <span />
      )}
    </header>
  )
}

/* ---------- Info card ---------- */

export function InfoCard({ eyebrow, children, serif }: { eyebrow: string; children: ReactNode; serif?: boolean }) {
  return (
    <section className={`card ${serif ? 'card--serif' : ''}`}>
      <p className={`t-label ${serif ? '' : 't-label--accent'}`}>{eyebrow}</p>
      <p className="card__text t-body">{children}</p>
    </section>
  )
}

/* ---------- Statement with 7-point scale ---------- */

const DOT_SIZES = [48, 40, 32, 26, 32, 40, 48]
const ANSWERS: Answer[] = [1, 2, 3, 4, 5, 6, 7]

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
            aria-label={a === 1 ? 'Strongly agree' : a === 7 ? 'Strongly disagree' : a === 4 ? 'Neutral' : `Option ${a}`}
            className={`scale__dot ${i < 3 ? 'scale__dot--agree' : i > 3 ? 'scale__dot--disagree' : ''}`}
            style={{ ['--dot-size' as string]: `${DOT_SIZES[i]}px` }}
            onClick={() => onChange(a)}
          />
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
    <button type="button" className={`door ${recommended ? 'door--recommended' : ''}`} onClick={onClick}>
      <span className="door__arch" aria-hidden="true" />
      <span>
        {recommended && <span className="t-label t-label--accent">Your door</span>}
        <span className="t-room door__name" style={{ display: 'block' }}>
          {name}
        </span>
        <span className="t-small door__reason" style={{ display: 'block' }}>
          {reason}
        </span>
      </span>
    </button>
  )
}

/* ---------- Save toggle ---------- */

export function SaveToggle({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`btn btn--secondary save ${saved ? 'save--on' : ''}`}
      aria-pressed={saved}
      onClick={onToggle}
    >
      {saved ? <Check width={18} height={18} /> : <Bookmark width={18} height={18} />}
      {saved ? 'Saved' : 'Save to My Gallery'}
    </button>
  )
}

/* ---------- Path trail ---------- */

export function PathTrail({ stops, current }: { stops: string[]; current: string }) {
  return (
    <nav className="trail" aria-label="Your path so far">
      {stops.map((s, i) => {
        const isCurrent = s === current
        return (
          <span key={s} className="row" style={{ gap: 6 }}>
            {i > 0 && <span className="trail__link" />}
            <span className={`trail__dot ${isCurrent ? 'trail__dot--current' : ''}`} />
            <span className={isCurrent ? 'trail__current' : ''}>{s}</span>
          </span>
        )
      })}
      <span className="trail__ahead" aria-hidden="true" />
    </nav>
  )
}

/* ---------- Screen shell ---------- */

export function Screen({ dark, children, footer }: { dark?: boolean; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <main className={`screen ${dark ? 'screen--dark' : ''}`}>
      <div className="screen__body">{children}</div>
      {footer && <div className="screen__footer">{footer}</div>}
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
