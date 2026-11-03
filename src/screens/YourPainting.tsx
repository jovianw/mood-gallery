import { Navigate, useNavigate } from 'react-router-dom'
import { Pin } from '../components/Icons'
import { Button, Chip, InfoCard, SaveToggle, Screen, TopAppBar } from '../components/ui'
import { MUSEUM } from '../data/rooms'
import { useWalk } from '../state/WalkContext'

export function YourPainting() {
  const navigate = useNavigate()
  const walk = useWalk()
  const painting = walk.painting

  if (!painting) return <Navigate to="/" replace />

  const saved = walk.savedIds.includes(painting.objectID)
  const startOver = () => {
    walk.reset()
    navigate('/')
  }

  return (
    <Screen
      footer={
        <>
          <SaveToggle saved={saved} onToggle={() => walk.toggleSaved(painting.objectID)} />
          <Button variant="secondary" to="/share">
            Share my path
          </Button>
          <button type="button" className="t-link" onClick={startOver} style={{ marginTop: 4 }}>
            Start a new walk
          </button>
        </>
      }
    >
      <TopAppBar eyebrow="Your painting" left="close" onLeft={startOver} right="share" onRight={() => navigate('/share')} />
      <div className="gap-16" />
      <figure className="frame" style={{ margin: 0 }}>
        <img src={painting.image} alt={`${painting.title} by ${painting.artist}`} />
      </figure>
      <div className="gap-16" />
      <h1 className="t-title">{painting.title}</h1>
      <div className="gap-8" />
      <p className="t-small">
        {painting.artist} · {painting.date} · {painting.medium}
      </p>
      <div className="gap-8" />
      <p className="row t-small" style={{ color: 'var(--fg)' }}>
        <Pin width={16} height={16} style={{ color: 'var(--accent)' }} />
        {painting.gallery ? `On view in Gallery ${painting.gallery}, ${MUSEUM.name}` : `In the collection of ${MUSEUM.name}`}
      </p>
      <div className="gap-12" />
      <div className="wrap">
        {painting.tags.map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      <div className="gap-12" />
      <InfoCard eyebrow="Why this one">{painting.why}</InfoCard>
      <div className="gap-12" />
      <p className="t-small">
        <a href={painting.objectURL} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          View on metmuseum.org
        </a>
        . Image courtesy of The Met Open Access program.
      </p>
    </Screen>
  )
}
