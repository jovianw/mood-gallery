import { useNavigate } from 'react-router-dom'

/**
 * Tiny navigation helper so screens can say "forward" or "back" and the shell can pick the
 * slide direction. The direction is stored on <html> as a class before the route changes.
 */
let direction: 'forward' | 'back' = 'forward'

export function setDirection(d: 'forward' | 'back') {
  direction = d
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('nav-forward', 'nav-back')
  root.classList.add(d === 'forward' ? 'nav-forward' : 'nav-back')
}

export function getDirection() {
  return direction
}

export function useNav() {
  const navigate = useNavigate()
  return {
    forward: (to: string, replace = false) => {
      setDirection('forward')
      navigate(to, { replace })
    },
    back: (to?: string) => {
      setDirection('back')
      if (to) navigate(to)
      else navigate(-1)
    },
    markForward: () => setDirection('forward'),
    markBack: () => setDirection('back'),
  }
}
