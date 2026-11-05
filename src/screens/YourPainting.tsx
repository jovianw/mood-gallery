import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PinSolid } from '../components/Icons'
import { SignInSheet } from '../components/SignInSheet'
import { Button, Chip, InfoCard, SaveToggle, Screen, ShareButton, TopAppBar } from '../components/ui'
import { MUSEUM, START_ROOM } from '../data/rooms'
import type { MoodVector, Painting, RouteStop } from '../data/types'
import { paintings } from '../data/paintings'
import { moodWords, tagEvidence, whyThisOne } from '../lib/matching'
import { useNav } from '../lib/nav'
import { useAuth } from '../state/AuthContext'
import { useSaves, type SavedPainting } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'

/** Shows primaryImageSmall first and swaps in primaryImage once it has loaded. */
function FramedImage({ painting, onReady }: { painting: Painting; onReady?: () => void }) {
  const [src, setSrc] = useState(painting.image)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!painting.imageLarge || painting.imageLarge === painting.image) return
    const img = new Image()
    img.onload = () => setSrc(painting.imageLarge)
    img.src = painting.imageLarge
    return () => {
      img.onload = null
    }
  }, [painting.image, painting.imageLarge])

  return (
    <figure className="frame">
      <div className="frame__inner">
        {failed || !src ? (
          <span className="frame__fallback">{painting.title}</span>
        ) : (
          <img
            src={src}
            alt={`${painting.title} by ${painting.artist}`}
            onLoad={onReady}
            onError={() => {
              setFailed(true)
              onReady?.()
            }}
          />
        )}
      </div>
    </figure>
  )
}

/** Set by the Finding screen right before it hands off, so only that arrival gets the reveal. */
export const REVEAL_KEY = 'mg.reveal'

type RevealPhase = 'hold' | 'settle' | 'done'

/** How long the work sits alone on the dark screen once its image has painted. */
const HOLD_MS = 1300
/** Background, hero move and the staggered items are all finished by then. */
const SETTLE_MS = 1100
/** If the image never arrives, reveal anyway. */
const IMAGE_TIMEOUT_MS = 2500

/**
 * Drives the arrival animation: the screen starts dark with the work centered on its own,
 * then lightens while the work moves up to its place and the rest fades in top to bottom.
 */
function useReveal(enabled: boolean) {
  const [phase, setPhase] = useState<RevealPhase>(enabled ? 'hold' : 'done')
  const [ready, setReady] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const [shift, setShift] = useState(0)

  useEffect(() => {
    sessionStorage.removeItem(REVEAL_KEY)
  }, [])

  // Image missing or slow: do not keep the visitor on a blank dark screen.
  useEffect(() => {
    if (phase !== 'hold' || ready) return
    const t = setTimeout(() => setReady(true), IMAGE_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [phase, ready])

  // Once the image has its size, center the hero in the viewport, then let it settle.
  useLayoutEffect(() => {
    if (phase !== 'hold' || !ready) return
    const hero = heroRef.current
    const main = hero?.closest('main')
    if (hero && main) {
      const top = main.getBoundingClientRect().top + hero.offsetTop
      const centered = (window.innerHeight - hero.offsetHeight) / 2 - top
      // A very tall work still starts a little below the top edge rather than off screen.
      setShift(Math.max(centered, 24 - top))
    }
    const t = setTimeout(() => setPhase('settle'), HOLD_MS)
    return () => clearTimeout(t)
  }, [phase, ready])

  useEffect(() => {
    if (phase !== 'settle') return
    const t = setTimeout(() => setPhase('done'), SETTLE_MS)
    return () => clearTimeout(t)
  }, [phase])

  return { phase, ready, heroRef, shift, onImageReady: () => setReady(true) }
}

/** One block of the painting screen that fades in during the reveal, in order from the top. */
function Item({ i, children, center }: { i: number; children: ReactNode; center?: boolean }) {
  return (
    <div className="reveal__item" style={{ '--i': i, alignItems: center ? 'center' : undefined } as CSSProperties}>
      {children}
    </div>
  )
}

interface ViewProps {
  painting: Painting
  mood: MoodVector
  words: string[]
  why: string
  stops: RouteStop[]
  mode: 'walk' | 'saved'
  shareTo: string
}

function toRecord(v: ViewProps): SavedPainting {
  return {
    objectID: v.painting.objectID,
    title: v.painting.title,
    artist: v.painting.artist,
    date: v.painting.date,
    medium: v.painting.medium,
    imageUrl: v.painting.image,
    imageLargeUrl: v.painting.imageLarge,
    galleryNumber: v.painting.gallery,
    museum: 'met',
    moodVector: v.mood,
    moodWords: v.words,
    route: v.stops,
    savedAt: new Date().toISOString(),
    why: v.painting.why,
    objectURL: v.painting.objectURL,
  }
}

function PaintingView(v: ViewProps) {
  const nav = useNav()
  const auth = useAuth()
  const saves = useSaves()
  const [sheet, setSheet] = useState(false)
  const { painting } = v
  const saved = saves.isSaved(painting.objectID)
  const reveal = useReveal(
    v.mode === 'walk' &&
      sessionStorage.getItem(REVEAL_KEY) === '1' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  // Saved works carry no evidence of their own; look the current catalog entry up by id.
  const evidence = tagEvidence(painting.ev ? painting : (paintings.find((p) => p.objectID === painting.objectID) ?? painting))

  const saveNow = () => void saves.save(toRecord(v))

  const toggleSaved = () => {
    if (saved) return void saves.unsave(painting.objectID)
    // Guests see the sign-in sheet first; "Not now" saves to this device.
    if (!auth.user && !sessionStorage.getItem('mg.sheetSeen')) {
      setSheet(true)
      return
    }
    saveNow()
  }

  const startNewWalk = () => {
    nav.forward('/')
  }

  const { phase } = reveal
  const screenClass = phase === 'done' ? undefined : `screen--reveal screen--reveal-${phase} ${reveal.ready ? 'is-ready' : ''}`

  return (
    <Screen dark={phase === 'hold'} className={screenClass}>
      <Item i={0}>
        <TopAppBar
          eyebrow="Your piece"
          left={v.mode === 'walk' ? 'close' : 'back'}
          onLeft={() => nav.back(v.mode === 'walk' ? '/' : '/gallery')}
          right={<ShareButton onClick={() => nav.forward(v.shareTo)} />}
        />
      </Item>
      <div className="gap-14" />
      <div
        ref={reveal.heroRef}
        className="reveal__hero"
        style={{ '--reveal-shift': `${reveal.shift}px` } as CSSProperties}
      >
        <FramedImage key={painting.objectID} painting={painting} onReady={reveal.onImageReady} />
        <div className="gap-16" />
        <h1 className="t-title">{painting.title}</h1>
        <div className="gap-4" />
        <p className="t-small">
          {painting.artist} &nbsp;·&nbsp; {painting.date}
          {painting.medium ? <> &nbsp;·&nbsp; {painting.medium}</> : null}
        </p>
      </div>
      <div className="gap-8" />
      <Item i={1}>
        <p className="row" style={{ gap: 6, fontSize: 13, fontWeight: 500, margin: 0 }}>
          <PinSolid width={16} height={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
          {painting.gallery
            ? `On view in Gallery ${painting.gallery}, ${MUSEUM.name}`
            : `Not currently on view, ${MUSEUM.name}`}
        </p>
      </Item>
      <div className="gap-12" />
      <Item i={2}>
        <div className="wrap" aria-label="Your mood">
          {v.words.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      </Item>
      <div className="gap-12" />
      <Item i={3}>
        <InfoCard eyebrow="Why this one" labelSize={11}>
          {v.why}
        </InfoCard>
      </Item>
      {evidence.length > 0 && (
        <>
          <div className="gap-10" />
          <Item i={4}>
            <InfoCard eyebrow="How this work reads" labelSize={11}>
              <ul className="evidence">
                {evidence.map((e) => (
                  <li key={e.tag}>
                    <b>{e.tag}</b>
                    <span>{e.reason}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="t-link evidence__more" onClick={() => nav.forward('/about')}>
                How the words were found
              </button>
            </InfoCard>
          </Item>
        </>
      )}
      <div className="gap-14" />
      <Item i={5}>
        <SaveToggle saved={saved} onToggle={toggleSaved} disabled={auth.loading} />
        <div className="gap-10" />
        <Button variant="outline" onClick={() => nav.forward(v.shareTo)}>
          Share my path
        </Button>
      </Item>
      {v.mode === 'walk' && (
        <>
          <div className="gap-14" />
          <Item i={6} center>
            <button type="button" className="t-link" onClick={startNewWalk}>
              Start a new walk
            </button>
          </Item>
        </>
      )}
      <div className="gap-16" />
      <Item i={7}>
        <p className="t-caption" style={{ textAlign: 'center' }}>
          <a href={painting.objectURL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            View on metmuseum.org
          </a>
          . Image: The Metropolitan Museum of Art, Open Access.
        </p>
      </Item>
      {sheet && (
        <SignInSheet
          onClose={() => setSheet(false)}
          onSignedIn={saveNow}
          onNotNow={() => {
            sessionStorage.setItem('mg.sheetSeen', '1')
            saveNow()
          }}
        />
      )}
    </Screen>
  )
}

/** Your piece at the end of a walk. */
export function YourPainting() {
  const walk = useWalk()
  const painting = walk.painting
  if (!painting || !walk.doorId) return <Navigate to="/" replace />
  if (!walk.resolved) return <Navigate to="/finding" replace />
  return (
    <PaintingView
      painting={painting}
      mood={walk.mood}
      words={moodWords(walk.mood)}
      why={whyThisOne(walk.mood, painting)}
      stops={walk.stops}
      mode="walk"
      shareTo="/share"
    />
  )
}

/** A saved painting opened from My Gallery. */
export function SavedPaintingScreen() {
  const { objectID = '' } = useParams()
  const saves = useSaves()
  const save = saves.saves.find((s) => String(s.objectID) === objectID)
  if (saves.loading) return <Screen>{null}</Screen>
  if (!save) return <Navigate to="/gallery" replace />
  const painting: Painting = {
    objectID: save.objectID,
    title: save.title,
    artist: save.artist,
    date: save.date,
    medium: save.medium,
    gallery: save.galleryNumber,
    image: save.imageUrl,
    imageLarge: save.imageLargeUrl,
    objectURL: save.objectURL ?? `https://www.metmuseum.org/art/collection/search/${save.objectID}`,
    room: save.route[save.route.length - 1]?.roomId ?? START_ROOM,
    galleryKey: '',
    mood: save.moodVector,
    tags: save.moodWords,
    why: save.why ?? '',
  }
  return (
    <PaintingView
      painting={painting}
      mood={save.moodVector}
      words={save.moodWords}
      why={save.why ? whyThisOne(save.moodVector, painting) : 'You saved this one on an earlier walk.'}
      stops={save.route}
      mode="saved"
      shareTo={`/gallery/${save.objectID}/share`}
    />
  )
}
