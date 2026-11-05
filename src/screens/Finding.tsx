import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Screen } from '../components/ui'
import { MUSEUM } from '../data/rooms'
import type { Painting } from '../data/types'
import { moodList, moodWords } from '../lib/matching'
import { deadline, fetchObject, refreshPainting } from '../lib/met'
import { useNav } from '../lib/nav'
import { useSaves } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'
import { REVEAL_KEY } from './YourPainting'

const MIN_MS = 600
/** The whole live check, across up to three candidates, gets this long before the bundled record wins. */
const CHECK_BUDGET_MS = 6000
const STEPS = ['Reading your answers', `Searching ${MUSEUM.works}`, 'Picking the one for today']

/**
 * Picks the painting: refreshes the top candidate from the live Met API (cached 7 days) and falls
 * back to the next candidate if it is no longer on view. The live check is best effort: offline,
 * or if the API fails or runs past CHECK_BUDGET_MS, the bundled record is used as is with
 * `live: false`, so the piece screen can say the location was not checked today. The screen never
 * blocks on the API; the only way the finale does not happen is the user leaving.
 */
async function pickPainting(candidates: Painting[], signal: AbortSignal): Promise<Painting> {
  const bundled = { ...candidates[0], live: false }
  if (!navigator.onLine) return bundled
  const budget = deadline(CHECK_BUDGET_MS, signal)
  let offView: Painting | undefined
  for (const candidate of candidates.slice(0, 3)) {
    let fresh: Painting
    try {
      const obj = await fetchObject(candidate.objectID, budget)
      if (obj.isPublicDomain === false) continue
      fresh = refreshPainting(candidate, obj)
    } catch (err) {
      if (signal.aborted) throw err
      // The API is down or slow. Whatever we learned so far is better than another timeout.
      console.warn('Met check skipped', err)
      return offView ?? bundled
    }
    if (!fresh.gallery && candidates.indexOf(candidate) < 2) {
      // Off view right now: try the next best match, keep this as a last resort.
      offView ??= fresh
      continue
    }
    return fresh
  }
  return offView ?? bundled
}

export function Finding() {
  const nav = useNav()
  const walk = useWalk()
  const saves = useSaves()
  const [step, setStep] = useState(0)
  const started = useRef(false)

  const { candidates, doorId, resolve } = walk
  const ready = !!doorId && walk.canFinish && candidates.length > 0

  // Kept in a ref so the lookup effect below never restarts because a callback identity changed.
  const finishRef = useRef((p: Painting) => {
    resolve(p)
    void saves.recordWalk({
      route: walk.stops,
      moodVector: walk.mood,
      paintingId: p.objectID,
      finishedAt: new Date().toISOString(),
    })
    sessionStorage.setItem(REVEAL_KEY, '1')
    nav.forward('/painting', true)
  })
  useEffect(() => {
    finishRef.current = (p: Painting) => {
      resolve(p)
      void saves.recordWalk({
        route: walk.stops,
        moodVector: walk.mood,
        paintingId: p.objectID,
        finishedAt: new Date().toISOString(),
      })
      sessionStorage.setItem(REVEAL_KEY, '1')
      nav.forward('/painting', true)
    }
  })

  useEffect(() => {
    if (!ready || started.current) return
    started.current = true
    const controller = new AbortController()
    const t0 = Date.now()
    setStep(1)

    const run = async () => {
      const chosen = await pickPainting(candidates, controller.signal)
      setStep(2)
      const wait = Math.max(0, MIN_MS - (Date.now() - t0))
      await new Promise((r) => setTimeout(r, wait))
      setStep(3)
      await new Promise((r) => setTimeout(r, 180))
      if (!controller.signal.aborted) finishRef.current(chosen)
    }

    run().catch((err) => {
      if (controller.signal.aborted) return
      // Not a Met failure (those are handled above): something unexpected. Still show the piece.
      console.error('Finding failed', err)
      finishRef.current({ ...candidates[0], live: false })
    })

    return () => {
      controller.abort()
      started.current = false
    }
  }, [ready, candidates])

  if (!ready) return <Navigate to="/" replace />

  const words = moodWords(walk.mood)

  return (
    <Screen dark center>
      <div className="spacer" />
      <div className="spinner" role="progressbar" aria-label="Finding your piece" />
      <div className="gap-28" />
      <h1 className="t-headline t-headline--italic" style={{ fontSize: 28, lineHeight: 1.2 }}>
        Finding your piece…
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
