import { Navigate, useParams } from 'react-router-dom'
import { Button, InfoCard, PathTrail, Screen, Statement, TopAppBar } from '../components/ui'
import { isRoomId, rooms, START_ROOM } from '../data/rooms'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

export function Room() {
  const { roomId } = useParams()
  const nav = useNav()
  const walk = useWalk()

  if (!isRoomId(roomId)) return <Navigate to="/" replace />
  const room = rooms[roomId]
  const isHall = room.id === START_ROOM

  // Rooms behind a door need the Great Hall answered first.
  if (!isHall && !walk.isRoomComplete(START_ROOM)) {
    return <Navigate to={`/room/${START_ROOM}`} replace />
  }

  const complete = walk.isRoomComplete(room.id)
  const stops = isHall ? ['Great Hall'] : ['Great Hall', room.name]

  const onNext = () => {
    if (isHall) nav.forward('/doors')
    else {
      if (walk.doorId !== room.id) walk.chooseDoor(room.id)
      nav.forward('/final')
    }
  }

  return (
    <Screen
      footer={
        <Button onClick={onNext} disabled={!complete} arrow>
          {isHall ? 'Find my door' : 'Show my final stretch'}
        </Button>
      }
    >
      <TopAppBar eyebrow="You are in" title={room.name} onLeft={() => nav.back(isHall ? '/' : '/doors')} />
      <div className="gap-12" />
      <PathTrail stops={stops} current={isHall ? 'Great Hall' : room.name} />
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
