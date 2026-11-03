import { Navigate, useNavigate } from 'react-router-dom'
import { DoorCard, Screen, TopAppBar } from '../components/ui'
import { doors, rooms, START_ROOM } from '../data/rooms'
import type { RoomId } from '../data/types'
import { useWalk } from '../state/WalkContext'

export function ChooseDoor() {
  const navigate = useNavigate()
  const walk = useWalk()

  if (!walk.isRoomComplete(START_ROOM)) return <Navigate to={`/room/${START_ROOM}`} replace />

  const recommended = doors.find((d) => d.roomId === walk.recommendedDoor) ?? doors[0]
  const others = doors.filter((d) => d.roomId !== recommended.roomId)

  const pick = (roomId: RoomId) => {
    walk.chooseDoor(roomId)
    navigate(`/room/${roomId}`)
  }

  return (
    <Screen
      footer={<p className="t-small">Your doors change every walk.</p>}
    >
      <TopAppBar eyebrow={`Leaving ${rooms[START_ROOM].name}`} onLeft={() => navigate(`/room/${START_ROOM}`)} />
      <div className="gap-16" />
      <h1 className="t-headline">Three doors open from here.</h1>
      <div className="gap-8" />
      <p className="t-body t-body--muted">
        We picked one based on how you answered. Feel free to take a different one.
      </p>
      <div className="gap-20" />
      <DoorCard
        name={rooms[recommended.roomId].name}
        reason={recommended.reason}
        recommended
        onClick={() => pick(recommended.roomId)}
      />
      <div className="gap-16" />
      <p className="t-label">Other doors</p>
      <div className="gap-8" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {others.map((d) => (
          <DoorCard key={d.roomId} name={rooms[d.roomId].name} reason={d.reason} onClick={() => pick(d.roomId)} />
        ))}
      </div>
    </Screen>
  )
}
