import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, PinSolid } from '../components/Icons'
import { Button, Screen, TopAppBar } from '../components/ui'
import { rooms, START_ROOM } from '../data/rooms'
import { blocks, galleryLabel } from '../lib/floorplan'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

const RouteMap3D = lazy(() => import('../components/RouteMap3D').then((m) => ({ default: m.RouteMap3D })))

export function FinalStretch() {
  const nav = useNav()
  const walk = useWalk()
  const painting = walk.painting
  const route = walk.route

  if (!walk.doorId || !painting || !route || !walk.isRoomComplete(walk.doorId)) {
    return <Navigate to={walk.doorId ? `/room/${walk.doorId}` : '/'} replace />
  }

  const hall = rooms[START_ROOM]
  const room = rooms[walk.doorId]
  const destination = galleryLabel(painting)
  const nextName = route.next ? blocks[route.next].name : null
  const [hallStop, roomStop] = walk.stops
  const tail = walk.destination.replace('Found it: ', '')
  const aheadPhrase = tail.charAt(0).toUpperCase() + tail.slice(1)

  return (
    <Screen
      dark
      footer={
        <Button onClick={() => nav.forward('/finding')}>Reveal my painting</Button>
      }
    >
      <TopAppBar eyebrow="The final stretch" onLeft={() => nav.back(`/room/${walk.doorId}`)} />
      <div className="gap-20" />
      <h1 className="t-headline t-headline--italic">Your painting is just ahead.</h1>
      <div className="gap-8" />
      <p className="t-body t-body--15 t-body--muted">
        Here&rsquo;s the rest of your route, and a look back at the path that got you here.
      </p>
      <div className="gap-16" />
      <Suspense fallback={<div className="mapcard" aria-hidden="true" />}>
        <RouteMap3D route={route} destinationLabel={destination} />
      </Suspense>
      <div className="gap-10" />
      <p className="map-legend">
        <span className="map-legend__dot" aria-hidden="true" />
        You are here
        <span style={{ width: 8 }} />
        <PinSolid width={16} height={16} style={{ color: 'var(--accent)' }} aria-hidden="true" />
        {destination}
        <span className="map-legend__sep" aria-hidden="true">
          ·
        </span>
        <span className="map-legend__muted">about a {route.minutes} min walk</span>
      </p>
      <div className="gap-16" />
      <ol className="route">
        <li className="stop">
          <span className="stop__rail">
            <span className="stop__dot stop__dot--done">
              <Check width={11} height={11} />
            </span>
            <span className="stop__line" />
          </span>
          <span>
            <span className="stop__name">{hall.name}</span>
            <p className="stop__sub">Where you started &nbsp;·&nbsp; {hallStop.moodPhrase}</p>
          </span>
        </li>
        <li className="stop">
          <span className="stop__rail">
            <span className="stop__dot stop__dot--done">
              <Check width={11} height={11} />
            </span>
            <span className="stop__line stop__line--dashed" />
          </span>
          <span>
            <span className="stop__name">{room.name}</span>
            <p className="stop__sub">{roomStop?.moodPhrase}</p>
          </span>
        </li>
        {nextName && (
          <li className="stop">
            <span className="stop__rail">
              <span className="stop__dot" />
              <span className="stop__line stop__line--ahead" />
            </span>
            <span>
              <span className="stop__name">{nextName}</span>
              <p className="stop__sub">Walk straight through &nbsp;·&nbsp; {aheadPhrase}</p>
            </span>
          </li>
        )}
        <li className="stop stop--last">
          <span className="stop__rail">
            <span className="stop__dot stop__dot--end" />
          </span>
          <span>
            <span className="stop__name stop__name--end">{destination}</span>
            <p className="stop__sub stop__sub--accent">Your painting is waiting here</p>
          </span>
        </li>
      </ol>
    </Screen>
  )
}
