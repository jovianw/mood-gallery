import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DOOR_ROOMS, rooms, START_ROOM } from '../data/rooms'
import { paintings } from '../data/paintings'
import type { Answer, MoodVector, Painting, RoomId, RouteStop } from '../data/types'
import { routeFor, type WalkRoute } from '../lib/floorplan'
import {
  dailySeed,
  destinationPhrase,
  matchPaintings,
  moodFromAnswers,
  recommendDoors,
  roomPhrase,
} from '../lib/matching'
import { getGuestId } from '../lib/storage'

export interface WalkState {
  answers: Record<string, Answer | undefined>
  doorId: RoomId | null
  /** Rooms visited in order, always starting with the Great Hall. */
  path: RoomId[]
  /** Mood over every answered statement in the walk. */
  mood: MoodVector
  hallMood: MoodVector
  /** The three doors for this walk, recommended first. */
  doorIds: RoomId[]
  /** Candidate paintings for the chosen room, best first (after the daily pick). */
  candidates: Painting[]
  /** The painting on the wall at the end of this walk. */
  painting: Painting | undefined
  /** Whether the Finding screen has resolved the painting (live refresh done or skipped). */
  resolved: boolean
  route: WalkRoute | undefined
  /** Route recap used by saves and shares: one phrase per room walked. */
  stops: RouteStop[]
  destination: string
  /** Date the walk finished (set when the painting is resolved). */
  finishedAt: Date | undefined
  userId: string
  setAnswer: (statementId: string, answer: Answer) => void
  chooseDoor: (roomId: RoomId) => void
  /** Called by the Finding screen once the live record is in. */
  resolve: (painting: Painting) => void
  reset: () => void
  roomMood: (roomId: RoomId) => MoodVector
  isRoomComplete: (roomId: RoomId) => boolean
}

const WalkContext = createContext<WalkState | null>(null)

export function WalkProvider({ children, userId: userIdProp }: { children: ReactNode; userId?: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({})
  const [doorId, setDoorId] = useState<RoomId | null>(null)
  const [resolvedPainting, setResolvedPainting] = useState<Painting | undefined>(undefined)
  const [finishedAt, setFinishedAt] = useState<Date | undefined>(undefined)

  const userId = userIdProp ?? getGuestId()

  const path = useMemo<RoomId[]>(() => (doorId ? [START_ROOM, doorId] : [START_ROOM]), [doorId])

  const roomMood = useCallback(
    (roomId: RoomId) => moodFromAnswers(rooms[roomId].statements, answers),
    [answers],
  )

  const isRoomComplete = useCallback(
    (roomId: RoomId) => rooms[roomId].statements.every((s) => answers[s.id] !== undefined),
    [answers],
  )

  const hallMood = useMemo(() => roomMood(START_ROOM), [roomMood])

  const mood = useMemo(
    () => moodFromAnswers(path.flatMap((id) => rooms[id].statements), answers),
    [path, answers],
  )

  const doorIds = useMemo(
    () => recommendDoors(hallMood, DOOR_ROOMS.map((id) => rooms[id])).map((r) => r.id),
    [hallMood],
  )

  const candidates = useMemo(() => {
    if (!doorId) return []
    const inRoom = paintings.filter((p) => p.room === doorId)
    return matchPaintings(mood, inRoom.length ? inRoom : paintings, dailySeed(userId))
  }, [doorId, mood, userId])

  const painting = resolvedPainting ?? candidates[0]

  const route = useMemo(
    () => (doorId && painting ? routeFor(doorId, painting) : undefined),
    [doorId, painting],
  )

  const stops = useMemo<RouteStop[]>(
    () => path.map((roomId) => ({ roomId, moodPhrase: roomPhrase(roomMood(roomId)) })),
    [path, roomMood],
  )

  const destination = useMemo(() => destinationPhrase(mood), [mood])

  const value: WalkState = {
    answers,
    doorId,
    path,
    mood,
    hallMood,
    doorIds,
    candidates,
    painting,
    resolved: resolvedPainting !== undefined,
    route,
    stops,
    destination,
    finishedAt,
    userId,
    setAnswer: (id, a) => {
      setResolvedPainting(undefined)
      setAnswers((prev) => ({ ...prev, [id]: a }))
    },
    chooseDoor: (id) => {
      if (id !== doorId) setResolvedPainting(undefined)
      setDoorId(id)
    },
    resolve: (p) => {
      setResolvedPainting(p)
      setFinishedAt(new Date())
    },
    reset: () => {
      setAnswers({})
      setDoorId(null)
      setResolvedPainting(undefined)
      setFinishedAt(undefined)
    },
    roomMood,
    isRoomComplete,
  }

  return <WalkContext.Provider value={value}>{children}</WalkContext.Provider>
}

export function useWalk(): WalkState {
  const ctx = useContext(WalkContext)
  if (!ctx) throw new Error('useWalk must be used inside <WalkProvider>')
  return ctx
}
