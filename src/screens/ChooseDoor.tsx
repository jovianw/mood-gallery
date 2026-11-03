import { Navigate } from 'react-router-dom'
import { DoorCard, Screen, TopAppBar } from '../components/ui'
import { rooms, START_ROOM } from '../data/rooms'
import type { RoomId } from '../data/types'
import { useNav } from '../lib/nav'
import { useWalk } from '../state/WalkContext'

export function ChooseDoor() {
  const nav = useNav()
  const walk = useWalk()

  if (!walk.isRoomComplete(START_ROOM)) return <Navigate to={`/room/${START_ROOM}`} replace />

  const [recommendedId, ...otherIds] = walk.doorIds
  const recommended = rooms[recommendedId]
  const others = otherIds.map((id) => rooms[id])

  const pick = (roomId: RoomId) => {
    walk.chooseDoor(roomId)
    nav.forward(`/room/${roomId}`)
  }

  return (
    <Screen footer={<p className="t-caption" style={{ fontWeight: 500, textAlign: 'center' }}>Your doors change every walk.</p>}>
      <TopAppBar eyebrow="Leaving the Great Hall" onLeft={() => nav.back(`/room/${START_ROOM}`)} />
      <div className="gap-16" />
      <h1 className="t-headline" style={{ fontSize: 28 }}>
        Three doors open from here.
      </h1>
      <div className="gap-8" />
      <p className="t-body t-body--15 t-body--muted">
        We picked one based on how you answered. Feel free to take a different one.
      </p>
      <div className="gap-20" />
      <DoorCard name={recommended.name} reason={recommended.reason} recommended onClick={() => pick(recommended.id)} />
      <div className="gap-12" />
      <p className="t-label">Other doors</p>
      <div className="gap-8" />
      {others.map((d, i) => (
        <div key={d.id} style={{ width: '100%' }}>
          {i > 0 && <div className="gap-10" />}
          <DoorCard name={d.name} reason={d.shortReason} onClick={() => pick(d.id)} />
        </div>
      ))}
    </Screen>
  )
}
