import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { PinSolid } from '../components/Icons'
import { SignInSheet } from '../components/SignInSheet'
import { Button, Chip, InfoCard, SaveToggle, Screen, ShareButton, TopAppBar } from '../components/ui'
import { MUSEUM, START_ROOM } from '../data/rooms'
import type { MoodVector, Painting, RouteStop } from '../data/types'
import { moodWords, whyThisOne } from '../lib/matching'
import { useNav } from '../lib/nav'
import { useAuth } from '../state/AuthContext'
import { useSaves, type SavedPainting } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'

/** Shows primaryImageSmall first and swaps in primaryImage once it has loaded. */
function FramedImage({ painting }: { painting: Painting }) {
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
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </figure>
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

  return (
    <Screen>
      <TopAppBar
        eyebrow="Your painting"
        left={v.mode === 'walk' ? 'close' : 'back'}
        onLeft={() => nav.back(v.mode === 'walk' ? '/' : '/gallery')}
        right={<ShareButton onClick={() => nav.forward(v.shareTo)} />}
      />
      <div className="gap-14" />
      <FramedImage key={painting.objectID} painting={painting} />
      <div className="gap-16" />
      <h1 className="t-title">{painting.title}</h1>
      <div className="gap-4" />
      <p className="t-small">
        {painting.artist} &nbsp;·&nbsp; {painting.date}
        {painting.medium ? <> &nbsp;·&nbsp; {painting.medium}</> : null}
      </p>
      <div className="gap-8" />
      <p className="row" style={{ gap: 6, fontSize: 13, fontWeight: 500, margin: 0 }}>
        <PinSolid width={16} height={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        {painting.gallery
          ? `On view in Gallery ${painting.gallery}, ${MUSEUM.name}`
          : `Not currently on view, ${MUSEUM.name}`}
      </p>
      <div className="gap-12" />
      <div className="wrap" aria-label="Your mood">
        {v.words.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <div className="gap-12" />
      <InfoCard eyebrow="Why this one" labelSize={11}>
        {v.why}
      </InfoCard>
      <div className="gap-14" />
      <SaveToggle saved={saved} onToggle={toggleSaved} disabled={auth.loading} />
      <div className="gap-10" />
      <Button variant="outline" onClick={() => nav.forward(v.shareTo)}>
        Share my path
      </Button>
      {v.mode === 'walk' && (
        <>
          <div className="gap-14" />
          <button type="button" className="t-link" onClick={startNewWalk} style={{ alignSelf: 'center' }}>
            Start a new walk
          </button>
        </>
      )}
      <div className="gap-16" />
      <p className="t-caption" style={{ textAlign: 'center' }}>
        <a href={painting.objectURL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          View on metmuseum.org
        </a>
        . Image: The Metropolitan Museum of Art, Open Access.
      </p>
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

/** Your Painting at the end of a walk. */
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
