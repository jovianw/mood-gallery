import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PinSolid } from '../components/Icons'
import { Button, Chip, InfoCard, SaveToggle, Screen, ShareButton, TopAppBar } from '../components/ui'
import { MUSEUM, START_ROOM } from '../data/rooms'
import type { Painting } from '../data/types'
import { moodWords, whyThisOne } from '../lib/matching'
import { useNav } from '../lib/nav'
import { useSaves } from '../state/SavesContext'
import { useWalk } from '../state/WalkContext'

/** Shows primaryImageSmall first and swaps in primaryImage once it has loaded. */
function FramedImage({ painting }: { painting: Painting }) {
  const [src, setSrc] = useState(painting.image)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!painting.imageLarge) return
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
          <img src={src} alt={`${painting.title} by ${painting.artist}`} onError={() => setFailed(true)} />
        )}
      </div>
    </figure>
  )
}

export function YourPainting() {
  const nav = useNav()
  const walk = useWalk()
  const saves = useSaves()
  const painting = walk.painting

  if (!painting || !walk.doorId) return <Navigate to="/" replace />
  if (!walk.resolved) return <Navigate to="/finding" replace />

  const saved = saves.isSaved(painting.objectID)
  const words = moodWords(walk.mood)

  const toggleSaved = () => {
    if (saved) return void saves.unsave(painting.objectID)
    void saves.save({
      objectID: painting.objectID,
      title: painting.title,
      artist: painting.artist,
      date: painting.date,
      medium: painting.medium,
      imageUrl: painting.image,
      imageLargeUrl: painting.imageLarge,
      galleryNumber: painting.gallery,
      museum: 'met',
      moodVector: walk.mood,
      moodWords: words,
      route: walk.stops,
      savedAt: new Date().toISOString(),
      why: painting.why,
      objectURL: painting.objectURL,
    })
  }

  const startNewWalk = () => {
    walk.reset()
    nav.forward(`/room/${START_ROOM}`)
  }

  return (
    <Screen>
      <TopAppBar
        eyebrow="Your painting"
        left="close"
        onLeft={() => nav.back('/')}
        right={<ShareButton onClick={() => nav.forward('/share')} />}
      />
      <div className="gap-14" />
      <FramedImage key={painting.objectID} painting={painting} />
      <div className="gap-16" />
      <h1 className="t-title">{painting.title}</h1>
      <div className="gap-4" />
      <p className="t-small">
        {painting.artist} &nbsp;·&nbsp; {painting.date} &nbsp;·&nbsp; {painting.medium}
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
        {words.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <div className="gap-12" />
      <InfoCard eyebrow="Why this one" labelSize={11}>
        {whyThisOne(walk.mood, painting)}
      </InfoCard>
      <div className="gap-14" />
      <SaveToggle saved={saved} onToggle={toggleSaved} />
      <div className="gap-10" />
      <Button variant="outline" onClick={() => nav.forward('/share')}>
        Share my path
      </Button>
      <div className="gap-14" />
      <button type="button" className="t-link" onClick={startNewWalk} style={{ alignSelf: 'center' }}>
        Start a new walk
      </button>
      <div className="gap-16" />
      <p className="t-caption" style={{ textAlign: 'center' }}>
        <a href={painting.objectURL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          View on metmuseum.org
        </a>
        . Image: The Metropolitan Museum of Art, Open Access.
      </p>
    </Screen>
  )
}
