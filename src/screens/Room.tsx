import { Navigate, useParams } from 'react-router-dom'
import { Button, InfoCard, PathTrail, Screen, Statement, TopAppBar } from '../components/ui'
import { isRoomId, rooms, START_ROOM } from '../data/rooms'
import { AXIS_TOPIC, MIN_ROOMS } from '../lib/matching'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

/** One line under the button that says why the walk is or is not ready to end here. */
function statusLine(walk: ReturnType<typeof useWalk>, isStart: boolean): string | null {
  if (isStart) return null
  if (walk.mustFinish) return 'You have seen every room. Your painting is in this one.'
  if (walk.canFinish) return 'We are sure now. Your painting is close.'
  const a = walk.assessment
  const left = Math.max(0, MIN_ROOMS - walk.path.length)
  switch (a.why) {
    case 'rooms':
      return left === 1 ? 'One more room at least, then we will know.' : `${left} more rooms at least, then we will know.`
    case 'axes': {
      const topics = a.missingAxes.slice(0, 2).map((ax) => AXIS_TOPIC[ax])
      return `Not sure yet. We still want to hear about ${topics.join(' and ')}.`
    }
    case 'room':
      return 'Getting warmer. Another room fits you a little better.'
    case 'margin':
      return 'Almost. Two paintings are neck and neck, one more room will settle it.'
    default:
      return null
  }
}

export function Room() {
  const { roomId } = useParams()
  const nav = useNav()
  const walk = useWalk()

  if (!isRoomId(roomId)) return <Navigate to="/" replace />
  const room = rooms[roomId]
  const isStart = room.id === walk.startId

  // Rooms behind a door need the starting room answered first, and must be on the path.
  if (!isStart && !walk.isRoomComplete(walk.startId)) {
    return <Navigate to={`/room/${walk.startId}`} replace />
  }
  if (!isStart && !walk.path.includes(room.id)) {
    return <Navigate to="/doors" replace />
  }

  const complete = walk.isRoomComplete(room.id)
  const isCurrent = walk.path[walk.path.length - 1] === room.id
  const trail = walk.path.map((id) => (id === START_ROOM ? 'Great Hall' : rooms[id].name))
  const current = room.id === START_ROOM ? 'Great Hall' : room.name
  const finishHere = isCurrent && !isStart && walk.canFinish
  const status = isCurrent && complete ? statusLine(walk, isStart) : null

  const index = walk.path.indexOf(room.id)
  const prevRoom = index > 0 ? walk.path[index - 1] : null

  const onNext = () => {
    if (finishHere) nav.forward('/final')
    else nav.forward('/doors')
  }

  const label = isStart ? 'Find my door' : finishHere ? 'Show my final stretch' : 'Find my next door'

  return (
    <Screen
      footer={
        <>
          {status && (
            <p className="t-caption room-status" aria-live="polite">
              {status}
            </p>
          )}
          <Button onClick={onNext} disabled={!complete} arrow>
            {label}
          </Button>
        </>
      }
    >
      <TopAppBar
        eyebrow="You are in"
        title={room.name}
        onLeft={() => nav.back(isStart ? '/' : prevRoom ? `/room/${prevRoom}` : '/doors')}
      />
      <div className="gap-12" />
      <PathTrail stops={trail} current={current} />
      <div className="gap-16" />
      <InfoCard eyebrow="About this room" serif>
        {room.about}
      </InfoCard>
      <div className="gap-4" />
      {room.statements.map((s) => (
        <Statement key={s.id} statement={s} value={walk.answers[s.id]} onChange={(a) => walk.setAnswer(s.id, a)} />
      ))}
    </Screen>
  )
}
