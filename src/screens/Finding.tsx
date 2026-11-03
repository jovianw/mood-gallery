import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Button, Screen } from '../components/ui'
import { MUSEUM } from '../data/rooms'
import type { Painting } from '../data/types'
import { moodList, moodWords } from '../lib/matching'
import { fetchObject, refreshPainting } from '../lib/met'
import { useNav } from '../lib/nav'
import { useSaves } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'

const MIN_MS = 600
const STEPS = ['Reading your answers', `Searching ${MUSEUM.works}`, 'Picking the one for today']

type Phase = 'loading' | 'error'

/**
 * Resolves the painting: refreshes the top candidate from the live Met API (cached 7 days),
 * falls back to the next candidate if it is no longer on view, then hands off to /painting.
 * Offline, the bundled record is used as is.
 */
export function Finding() {
  const nav = useNav()
  const walk = useWalk()
  const saves = useSaves()
  const [phase, setPhase] = useState<Phase>('loading')
  const [step, setStep] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const started = useRef(false)

  const { candidates, doorId, resolve } = walk
  const ready = !!doorId && candidates.length > 0

  const finish = useCallback(
    (p: Painting) => {
      resolve(p)
      void saves.recordWalk({
        route: walk.stops,
        moodVector: walk.mood,
        paintingId: p.objectID,
        finishedAt: new Date().toISOString(),
      })
      nav.forward('/painting', true)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolve, nav, walk.stops, walk.mood],
  )

  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    const controller = new AbortController()
    const t0 = Date.now()
    setPhase('loading')
    setStep(1)

    const run = async () => {
      let chosen: Painting | undefined
      if (!navigator.onLine) {
        chosen = candidates[0]
      } else {
        for (const candidate of candidates.slice(0, 3)) {
          const obj = await fetchObject(candidate.objectID, controller.signal)
          if (obj.isPublicDomain === false) continue
          const fresh = refreshPainting(candidate, obj)
          if (!fresh.gallery && candidates.indexOf(candidate) < 2) {
            // Off view right now: try the next best match, keep this as a last resort.
            chosen ??= fresh
            continue
          }
          chosen = fresh
          break
        }
        chosen ??= candidates[0]
      }
      setStep(2)
      const wait = Math.max(0, MIN_MS - (Date.now() - t0))
      await new Promise((r) => setTimeout(r, wait))
      setStep(3)
      await new Promise((r) => setTimeout(r, 180))
      if (!controller.signal.aborted) finish(chosen)
    }

    run().catch((err) => {
      if (controller.signal.aborted) return
      console.warn('Finding failed', err)
      setPhase('error')
    })

    return () => {
      controller.abort()
      started.current = false
    }
  }, [ready, attempt, candidates, finish])

  if (!ready) return <Navigate to="/" replace />

  const words = moodWords(walk.mood)

  if (phase === 'error') {
    return (
      <Screen dark center>
        <div className="spacer" />
        <h1 className="t-headline t-headline--italic" style={{ fontSize: 28, lineHeight: 1.2 }}>
          The Met is not answering right now
        </h1>
        <div className="gap-10" />
        <p className="t-small" style={{ color: 'var(--stone)' }}>
          We could not reach the collection to check where your painting is hanging today.
        </p>
        <div className="gap-24" />
        <Button
          onClick={() => {
            setPhase('loading')
            setStep(0)
            setAttempt((n) => n + 1)
          }}
        >
          Retry
        </Button>
        <div className="gap-18" />
        <button type="button" className="t-link t-link--muted" onClick={() => nav.back('/doors')}>
          Try a different door
        </button>
        <div className="spacer" />
        <p className="t-caption">Your answers are safe. Nothing was lost.</p>
      </Screen>
    )
  }

  return (
    <Screen dark center>
      <div className="spacer" />
      <div className="spinner" role="progressbar" aria-label="Finding your painting" />
      <div className="gap-28" />
      <h1 className="t-headline t-headline--italic" style={{ fontSize: 28, lineHeight: 1.2 }}>
        Finding your painting…
      </h1>
      <div className="gap-10" />
      <p className="t-small" style={{ color: 'var(--stone)' }}>
        Searching {MUSEUM.shortName}&rsquo;s open collection for {moodList(walk.mood)}.
      </p>
      <span className="visually-hidden">{words.join(', ')}</span>
      <div className="gap-24" />
      <ol className="steps" aria-live="polite" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {STEPS.map((label, i) => (
          <li key={label} className={`step ${step > i ? 'step--done' : ''}`}>
            <i aria-hidden="true" />
            {label}
          </li>
        ))}
      </ol>
      <div className="spacer" />
      <p className="t-caption">Usually takes a second or two</p>
    </Screen>
  )
}
