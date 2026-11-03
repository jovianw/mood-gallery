import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button, InfoCard, PathTrail, Screen, Statement, TopAppBar } from '../components/ui'
import { rooms, START_ROOM } from '../data/rooms'
import type { RoomId } from '../data/types'
import { useWalk } from '../state/WalkContext'

export function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const walk = useWalk()

  const room = roomId && roomId in rooms ? rooms[roomId as RoomId] : undefined
  if (!room) return <Navigate to="/" replace />

  // Rooms behind a door need the Great Hall answered first.
  if (room.id !== START_ROOM && !walk.isRoomComplete(START_ROOM)) {
    return <Navigate to={`/room/${START_ROOM}`} replace />
  }

  const complete = walk.isRoomComplete(room.id)
  const stops = room.id === START_ROOM ? [room.name] : [rooms[START_ROOM].name, room.name]

  const onNext = () => {
    if (room.next === 'doors') navigate('/doors')
    else {
      if (walk.doorId !== room.id) walk.chooseDoor(room.id)
      navigate('/final')
    }
  }

  return (
    <Screen
      footer={
        <Button onClick={onNext} disabled={!complete} arrow>
          {room.buttonLabel}
        </Button>
      }
    >
      <TopAppBar eyebrow="You are in" title={room.name} onLeft={() => navigate(room.id === START_ROOM ? '/' : '/doors')} />
      <div className="gap-12" />
      <PathTrail stops={stops} current={room.name} />
      <div className="gap-16" />
      <InfoCard eyebrow="About this room" serif>
        {room.about}
      </InfoCard>
      <div className="gap-8" />
      {room.statements.map((s) => (
        <Statement key={s.id} statement={s} value={walk.answers[s.id]} onChange={(a) => walk.setAnswer(s.id, a)} />
      ))}
    </Screen>
  )
}
