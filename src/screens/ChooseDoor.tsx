import { Navigate } from 'react-router-dom'
import { DoorCard, Screen, TopAppBar } from '../components/ui'
import { rooms, START_ROOM } from '../data/rooms'
import type { RoomId } from '../data/types'
import { AXIS_TOPIC } from '../lib/matching'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

const COUNT = ['No', 'One door opens', 'Two doors open', 'Three doors open']

export function ChooseDoor() {
  const nav = useNav()
  const walk = useWalk()

  if (!walk.isRoomComplete(START_ROOM)) return <Navigate to={`/room/${START_ROOM}`} replace />

  // Doors lead out of the last room on the path that has been answered.
  const from = [...walk.path].reverse().find((id) => walk.isRoomComplete(id)) ?? START_ROOM
  if (walk.doorIds.length === 0) return <Navigate to="/final" replace />

  const [recommendedId, ...otherIds] = walk.doorIds
  const recommended = rooms[recommendedId]
  const others = otherIds.map((id) => rooms[id])
  const first = walk.path.length === 1
  const a = walk.assessment

  let headline = `${COUNT[walk.doorIds.length] ?? 'Doors open'} from here.`
  let copy = 'We picked one based on how you answered. Feel free to take a different one.'
  if (!first) {
    switch (a.why) {
      case 'rooms':
        headline = 'Keep going, this is a good start.'
        copy = 'A couple more rooms and the picture gets clear. We picked the door that fits you best so far.'
        break
      case 'axes': {
        const topics = a.missingAxes.slice(0, 2).map((ax) => AXIS_TOPIC[ax])
        headline = 'Not sure yet.'
        copy = `We still want to hear about ${topics.join(' and ')}. The first door asks about that.`
        break
      }
      case 'room':
        headline = 'Getting warmer.'
        copy = 'Another room fits how you feel a little better than the one you just left. We put it first.'
        break
      case 'margin':
        headline = 'Almost there.'
        copy = 'Two paintings are neck and neck. One more room should settle it.'
        break
      default:
        headline = 'Keep walking, if you like.'
        copy = 'We are sure already, but there is more to see. Any of these doors keeps the walk going.'
    }
  }

  const pick = (roomId: RoomId) => {
    walk.chooseDoor(roomId, from)
    nav.forward(`/room/${roomId}`)
  }

  const leaving = from === START_ROOM ? 'the Great Hall' : rooms[from].name
  const warmth = Math.round(a.score * 100)

  return (
    <Screen footer={<p className="t-caption" style={{ fontWeight: 500, textAlign: 'center' }}>Your doors change every walk.</p>}>
      <TopAppBar eyebrow={`Leaving ${leaving}`} onLeft={() => nav.back(`/room/${from}`)} />
      <div className="gap-16" />
      <h1 className="t-headline" style={{ fontSize: 28 }}>
        {headline}
      </h1>
      <div className="gap-8" />
      <p className="t-body t-body--15 t-body--muted">{copy}</p>
      {!first && (
        <>
          <div className="gap-12" />
          <div className="warmth" role="img" aria-label={`${warmth} percent of the way to your painting`}>
            <span className="warmth__bar">
              <span className="warmth__fill" style={{ width: `${warmth}%` }} />
            </span>
            <span className="warmth__label">
              {walk.path.length} rooms &nbsp;·&nbsp; {warmth}% sure
            </span>
          </div>
        </>
      )}
      <div className="gap-20" />
      <DoorCard name={recommended.name} reason={recommended.reason} recommended onClick={() => pick(recommended.id)} />
      {others.length > 0 && (
        <>
          <div className="gap-12" />
          <p className="t-label">Other doors</p>
          <div className="gap-8" />
          {others.map((d, i) => (
            <div key={d.id} style={{ width: '100%' }}>
              {i > 0 && <div className="gap-10" />}
              <DoorCard name={d.name} reason={d.shortReason} onClick={() => pick(d.id)} />
            </div>
          ))}
        </>
      )}
    </Screen>
  )
}
