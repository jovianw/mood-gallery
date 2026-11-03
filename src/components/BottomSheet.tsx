import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const CLOSE_MS = 220

/**
 * Bottom sheet over a 55% Ink scrim. Closes on scrim tap, Escape, or a drag down of more than
 * 80px. Children get a `close` function that plays the exit animation before calling onClose.
 */
export function BottomSheet({
  onClose,
  label,
  children,
}: {
  onClose: () => void
  label: string
  children: (close: () => void) => ReactNode
}) {
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    if (closing) return
    setClosing(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setTimeout(onClose, reduced ? 0 : CLOSE_MS)
  }, [closing, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [close])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('button, a, input')) return
    startY.current = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return
    setDragY(Math.max(0, e.clientY - startY.current))
  }
  const onPointerUp = () => {
    if (startY.current === null) return
    const dy = dragY
    startY.current = null
    setDragY(0)
    if (dy > 80) close()
  }

  return createPortal(
    <div
      className={`sheet-scrim ${closing ? 'sheet-scrim--closing' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        ref={sheetRef}
        className={`sheet ${closing ? 'sheet--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={dragY ? { transform: `translateY(${dragY}px)`, animation: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <div className="gap-16" />
        {children(close)}
      </div>
    </div>,
    document.body,
  )
}
