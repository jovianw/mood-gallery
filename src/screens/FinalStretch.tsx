import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Check, Rotate } from '../components/Icons'
import { Button, Screen, TopAppBar } from '../components/ui'
import { rooms, START_ROOM } from '../data/rooms'
import { roomPhrase } from '../lib/matching'
import { useWalk } from '../state/WalkContext'

const ANGLES = [45, 135, 225, 315]

function GalleryMap() {
  const [i, setI] = useState(0)
  return (
    <div>
      <div className="map" aria-hidden="true">
        <div className="map__plan" style={{ transform: `rotateX(58deg) rotateZ(${ANGLES[i]}deg)` }}>
          <div className="map__room map__room--done" style={{ left: 0, top: 40, width: 60, height: 60 }} />
          <div className="map__room map__room--done" style={{ left: 70, top: 20, width: 70, height: 100 }} />
          <div className="map__room" style={{ left: 150, top: 0, width: 70, height: 60 }} />
          <div className="map__room map__room--end" style={{ left: 150, top: 70, width: 70, height: 70 }} />
          <svg className="map__path" viewBox="0 0 220 140">
            <path
              d="M30 70 L105 70 L185 70 L185 105"
              fill="none"
              stroke="#e4002b"
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
            <circle cx="105" cy="70" r="4" fill="#e4002b" />
            <circle cx="185" cy="105" r="4" fill="#fff" stroke="#e4002b" strokeWidth="2.5" />
          </svg>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="map__legend" style={{ marginTop: 0 }}>
          <span className="row">
            <i /> You are here
          </span>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Rotate map"
          onClick={() => setI((n) => (n + 1) % ANGLES.length)}
        >
          <Rotate width={20} height={20} />
        </button>
      </div>
    </div>
  )
}

export function FinalStretch() {
  const navigate = useNavigate()
  const walk = useWalk()
  const painting = walk.painting

  if (!walk.doorId || !painting || !walk.isRoomComplete(walk.doorId)) {
    return <Navigate to={walk.doorId ? `/room/${walk.doorId}` : '/'} replace />
  }

  const hall = rooms[START_ROOM]
  const room = rooms[walk.doorId]
  const galleryLabel = painting.gallery ? `Gallery ${painting.gallery}` : 'Its gallery'

  return (
    <Screen
      dark
      footer={
        <Button to="/painting" arrow>
          Reveal my painting
        </Button>
      }
    >
      <TopAppBar eyebrow="The final stretch" onLeft={() => navigate(`/room/${walk.doorId}`)} />
      <div className="gap-20" />
      <h1 className="t-headline">Your painting is just ahead.</h1>
      <div className="gap-8" />
      <p className="t-body t-body--muted">
        Here&rsquo;s the rest of your route, and a look back at the path that got you here.
      </p>
      <div className="gap-16" />
      <div className="card">
        <GalleryMap />
        <p className="t-small" style={{ marginTop: 8 }}>
          {galleryLabel} · about a 4 min walk
        </p>
      </div>
      <div className="gap-16" />
      <ol className="route" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        <li className="stop">
          <span className="stop__rail">
            <span className="stop__dot stop__dot--done">
              <Check width={10} height={10} />
            </span>
            <span className="stop__line" />
          </span>
          <span>
            <span className="stop__name">{hall.name}</span>
            <p className="t-small">Where you started · {roomPhrase(walk.roomMood(START_ROOM))}</p>
          </span>
        </li>
        <li className="stop">
          <span className="stop__rail">
            <span className="stop__dot stop__dot--done">
              <Check width={10} height={10} />
            </span>
            <span className="stop__line" />
          </span>
          <span>
            <span className="stop__name">{room.name}</span>
            <p className="t-small">{roomPhrase(walk.roomMood(walk.doorId))}</p>
          </span>
        </li>
        <li className="stop">
          <span className="stop__rail">
            <span className="stop__dot" />
            <span className="stop__line stop__line--dashed" />
          </span>
          <span>
            <span className="stop__name">{painting.approachVia}</span>
            <p className="t-small">Walk straight through · Looking ahead</p>
          </span>
        </li>
        <li className="stop" style={{ minHeight: 40 }}>
          <span className="stop__rail">
            <span className="stop__dot stop__dot--end" />
          </span>
          <span>
            <span className="stop__name stop__name--end">{galleryLabel}</span>
            <p className="t-small">Your painting is waiting here</p>
          </span>
        </li>
      </ol>
    </Screen>
  )
}
