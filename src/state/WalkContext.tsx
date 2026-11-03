import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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

/**
 * Dev-only shortcut: `?demo=<roomId>` prefills a finished walk through that room so any
 * screen can be opened directly (used for screenshots). Never active in production builds.
 */
function demoState(): { answers: Record<string, Answer>; doorId: RoomId | null } {
  if (!import.meta.env.DEV || typeof window === 'undefined') return { answers: {}, doorId: null }
  const demo = new URLSearchParams(window.location.search).get('demo')
  if (!demo || !(demo in rooms) || demo === START_ROOM) return { answers: {}, doorId: null }
  const answers: Record<string, Answer> = {}
  const pattern: Answer[] = [1, 2, 6, 2, 1, 3]
  ;[...rooms[START_ROOM].statements, ...rooms[demo as RoomId].statements].forEach((s, i) => {
    answers[s.id] = pattern[i % pattern.length]
  })
  return { answers, doorId: demo as RoomId }
}

/** The walk in progress survives a reload (tab discarded on a phone, a stale chunk) via sessionStorage. */
interface StoredWalk {
  answers: Record<string, Answer | undefined>
  doorId: RoomId | null
  painting?: Painting
  finishedAt?: string
}

const WALK_KEY = 'mg.walk'

function readStoredWalk(): StoredWalk | null {
  try {
    const raw = sessionStorage.getItem(WALK_KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as StoredWalk
    if (!w || typeof w !== 'object' || !w.answers) return null
    if (w.doorId && !(w.doorId in rooms)) return null
    return w
  } catch {
    return null
  }
}

function writeStoredWalk(w: StoredWalk | null) {
  try {
    if (w) sessionStorage.setItem(WALK_KEY, JSON.stringify(w))
    else sessionStorage.removeItem(WALK_KEY)
  } catch {
    // storage blocked; the walk just will not survive a reload
  }
}

export function WalkProvider({ children, userId: userIdProp }: { children: ReactNode; userId?: string }) {
  const [demo] = useState(demoState)
  const [stored] = useState(() => (demo.doorId ? null : readStoredWalk()))
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>(stored?.answers ?? demo.answers)
  const [doorId, setDoorId] = useState<RoomId | null>(stored?.doorId ?? demo.doorId)
  const userId = userIdProp ?? getGuestId()
  const [resolvedPainting, setResolvedPainting] = useState<Painting | undefined>(() => {
    if (stored) return stored.painting
    if (!demo.doorId) return undefined
    const all = [...rooms[START_ROOM].statements, ...rooms[demo.doorId].statements]
    const m = moodFromAnswers(all, demo.answers)
    return matchPaintings(m, paintings.filter((p) => p.room === demo.doorId), dailySeed(userId))[0]
  })
  const [finishedAt, setFinishedAt] = useState<Date | undefined>(() => {
    if (stored) return stored.finishedAt ? new Date(stored.finishedAt) : undefined
    return demo.doorId ? new Date() : undefined
  })

  useEffect(() => {
    if (demo.doorId) return
    const empty = !doorId && Object.keys(answers).length === 0
    writeStoredWalk(
      empty ? null : { answers, doorId, painting: resolvedPainting, finishedAt: finishedAt?.toISOString() },
    )
  }, [demo.doorId, answers, doorId, resolvedPainting, finishedAt])

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

  const setAnswer = useCallback((id: string, a: Answer) => {
    setResolvedPainting(undefined)
    setAnswers((prev) => ({ ...prev, [id]: a }))
  }, [])

  const chooseDoor = useCallback((id: RoomId) => {
    setDoorId((prev) => {
      if (id !== prev) setResolvedPainting(undefined)
      return id
    })
  }, [])

  const resolve = useCallback((p: Painting) => {
    setResolvedPainting(p)
    setFinishedAt(new Date())
  }, [])

  const reset = useCallback(() => {
    setAnswers({})
    setDoorId(null)
    setResolvedPainting(undefined)
    setFinishedAt(undefined)
  }, [])

  // Memoized so consumers' effects can depend on the walk without re-running every render.
  const value = useMemo<WalkState>(
    () => ({
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
      setAnswer,
      chooseDoor,
      resolve,
      reset,
      roomMood,
      isRoomComplete,
    }),
    [
      answers,
      doorId,
      path,
      mood,
      hallMood,
      doorIds,
      candidates,
      painting,
      resolvedPainting,
      route,
      stops,
      destination,
      finishedAt,
      userId,
      setAnswer,
      chooseDoor,
      resolve,
      reset,
      roomMood,
      isRoomComplete,
    ],
  )

  return <WalkContext.Provider value={value}>{children}</WalkContext.Provider>
}

export function useWalk(): WalkState {
  const ctx = useContext(WalkContext)
  if (!ctx) throw new Error('useWalk must be used inside <WalkProvider>')
  return ctx
}
