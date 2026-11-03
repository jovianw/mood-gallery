import { BottomSheet } from './BottomSheet'
import { Arch, CheckCircle } from './Icons'
import { ROOM_IDS, rooms, START_ROOM } from '../data/rooms'
import type { RoomId } from '../data/types'

/**
 * Pick the room a walk begins in. The Great Hall is the default; after a finished walk the
 * Entrance proposes the room that walk ended in, so the next one picks up from there.
 */
export function StartRoomSheet({
  value,
  lastRoom,
  onPick,
  onClose,
}: {
  value: RoomId
  lastRoom: RoomId | null
  onPick: (id: RoomId) => void
  onClose: () => void
}) {
  return (
    <BottomSheet onClose={onClose} label="Where do you want to start?">
      {(close) => (
        <>
          <h2 className="sheet__title">Where do you want to start?</h2>
          <div className="gap-4" />
          <p className="sheet__copy">
            Every walk begins with three questions in the room you start in, then the doors take
            over. Starting somewhere new changes the route and the questions.
          </p>
          <div className="gap-18" />
          <div className="sheet__scroll">
            {ROOM_IDS.map((id, i) => {
              const room = rooms[id]
              const selected = id === value
              const sub =
                id === START_ROOM
                  ? 'The front hall. Where most walks begin.'
                  : id === lastRoom
                    ? `Floor ${room.floor} · Where your last walk ended`
                    : `Floor ${room.floor} · ${room.shortReason}`
              return (
                <div key={id} style={{ width: '100%' }}>
                  {i > 0 && <div className="gap-10" />}
                  <button
                    type="button"
                    className={`museum-row ${selected ? 'museum-row--selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => {
                      onPick(id)
                      close()
                    }}
                  >
                    <Arch
                      width={22}
                      height={22}
                      style={{ color: selected ? 'var(--accent)' : 'var(--mute-gray)' }}
                      aria-hidden="true"
                    />
                    <span className="museum-row__text">
                      <span className="museum-row__name">{room.name}</span>
                      <span className="museum-row__sub">{sub}</span>
                    </span>
                    {selected && (
                      <CheckCircle width={22} height={22} style={{ color: 'var(--accent)' }} aria-hidden="true" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
