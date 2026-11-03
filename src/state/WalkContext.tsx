import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DOOR_ROOMS, rooms, START_ROOM } from '../data/rooms'
import { paintings } from '../data/paintings'
import type { Answer, MoodVector, Painting, RoomId, RouteStop } from '../data/types'
import { routeFor, type WalkRoute } from '../lib/floorplan'
import {
  assessWalk,
  dailySeed,
  destinationPhrase,
  matchPaintings,
  moodFromAnswers,
  nextDoors,
  roomPhrase,
  type WalkAssessment,
} from '../lib/matching'
import { getGuestId } from '../lib/storage'

export interface WalkState {
  answers: Record<string, Answer | undefined>
  /** Rooms walked in order, starting with the room the walk began in (the Great Hall by default). */
  path: RoomId[]
  /** The room the walk began in. */
  startId: RoomId
  /** The room you are in once a door has been taken (last of the path), or null in the first room. */
  doorId: RoomId | null
  /** Mood over every answered statement in the walk. */
  mood: MoodVector
  hallMood: MoodVector
  /** The doors offered from the current room, recommended first (fewer than 3 near the end). */
  doorIds: RoomId[]
  /** Whether the walk is sure enough to end in the current room, and why not if it is not. */
  assessment: WalkAssessment
  /** The walk may end here: sure, or no rooms left. */
  canFinish: boolean
  /** No rooms are left to walk to. */
  mustFinish: boolean
  /** Candidate paintings for the current room, best first (after the daily pick). */
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
  /** Walk through a door out of `from` into `roomId`. Rooms after `from` are dropped. */
  chooseDoor: (roomId: RoomId, from?: RoomId) => void
  /** Called by the Finding screen once the live record is in. */
  resolve: (painting: Painting) => void
  /** Start over, optionally in a different room. */
  reset: (start?: RoomId) => void
  roomMood: (roomId: RoomId) => MoodVector
  isRoomComplete: (roomId: RoomId) => boolean
}

const WalkContext = createContext<WalkState | null>(null)

/**
 * Dev-only shortcut: `?demo=<roomId>[,<roomId>...]` prefills a finished walk through those rooms
 * so any screen can be opened directly (used for screenshots). Never active in production builds.
 */
function demoState(): { answers: Record<string, Answer>; path: RoomId[] } | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const demo = new URLSearchParams(window.location.search).get('demo')
  if (!demo) return null
  const ids = demo.split(',').filter((id): id is RoomId => id in rooms && id !== START_ROOM)
  if (!ids.length) return null
  const path: RoomId[] = [START_ROOM, ...ids]
  const answers: Record<string, Answer> = {}
  const pattern: Answer[] = [1, 2, 6, 2, 1, 3, 5, 2, 7]
  path.flatMap((id) => rooms[id].statements).forEach((s, i) => {
    answers[s.id] = pattern[i % pattern.length]
  })
  return { answers, path }
}

/** The walk in progress survives a reload (tab discarded on a phone, a stale chunk) via sessionStorage. */
interface StoredWalk {
  answers: Record<string, Answer | undefined>
  path: RoomId[]
  painting?: Painting
  finishedAt?: string
}

const WALK_KEY = 'mg.walk'
const LAST_ROOM_KEY = 'mg.lastRoom'

/** Where the last finished walk ended; the Entrance offers it as the next starting room. */
export function readLastRoom(): RoomId | null {
  try {
    const id = localStorage.getItem(LAST_ROOM_KEY)
    return id && id in rooms ? (id as RoomId) : null
  } catch {
    return null
  }
}

function writeLastRoom(id: RoomId) {
  try {
    localStorage.setItem(LAST_ROOM_KEY, id)
  } catch {
    // storage blocked
  }
}

function readStoredWalk(): StoredWalk | null {
  try {
    const raw = sessionStorage.getItem(WALK_KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as StoredWalk
    if (!w || typeof w !== 'object' || !w.answers || !Array.isArray(w.path)) return null
    if (!w.path.length || w.path.some((id) => !(id in rooms))) return null
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

const DOOR_ROOM_LIST = DOOR_ROOMS.map((id) => rooms[id])

export function WalkProvider({ children, userId: userIdProp }: { children: ReactNode; userId?: string }) {
  const [demo] = useState(demoState)
  const [stored] = useState(() => (demo ? null : readStoredWalk()))
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>(
    stored?.answers ?? demo?.answers ?? {},
  )
  const [path, setPath] = useState<RoomId[]>(stored?.path ?? demo?.path ?? [START_ROOM])
  const userId = userIdProp ?? getGuestId()
  const [resolvedPainting, setResolvedPainting] = useState<Painting | undefined>(() => {
    if (stored) return stored.painting
    if (!demo) return undefined
    const m = moodFromAnswers(demo.path.flatMap((id) => rooms[id].statements), demo.answers)
    const last = demo.path[demo.path.length - 1]
    return matchPaintings(m, paintings.filter((p) => p.room === last), dailySeed(userId))[0]
  })
  const [finishedAt, setFinishedAt] = useState<Date | undefined>(() => {
    if (stored) return stored.finishedAt ? new Date(stored.finishedAt) : undefined
    return demo ? new Date() : undefined
  })

  useEffect(() => {
    if (demo) return
    const empty = path.length === 1 && path[0] === START_ROOM && Object.keys(answers).length === 0
    writeStoredWalk(
      empty ? null : { answers, path, painting: resolvedPainting, finishedAt: finishedAt?.toISOString() },
    )
  }, [demo, answers, path, resolvedPainting, finishedAt])

  const startId = path[0] ?? START_ROOM
  const doorId = path.length > 1 ? path[path.length - 1] : null
  const pathRooms = useMemo(() => path.map((id) => rooms[id]), [path])

  const roomMood = useCallback(
    (roomId: RoomId) => moodFromAnswers(rooms[roomId].statements, answers),
    [answers],
  )

  const isRoomComplete = useCallback(
    (roomId: RoomId) => rooms[roomId].statements.every((s) => answers[s.id] !== undefined),
    [answers],
  )

  const hallMood = useMemo(() => roomMood(startId), [roomMood, startId])

  const mood = useMemo(
    () => moodFromAnswers(pathRooms.flatMap((r) => r.statements), answers),
    [pathRooms, answers],
  )

  const doorIds = useMemo(
    () => nextDoors(mood, pathRooms, answers, DOOR_ROOM_LIST).map((r) => r.id),
    [mood, pathRooms, answers],
  )

  const pool = useMemo(() => {
    if (!doorId) return []
    const inRoom = paintings.filter((p) => p.room === doorId)
    return inRoom.length ? inRoom : paintings
  }, [doorId])

  const assessment = useMemo(
    () => assessWalk(mood, pathRooms, answers, DOOR_ROOM_LIST, pool),
    [mood, pathRooms, answers, pool],
  )
  // Demo walks skip the confidence check so any screen can be opened for a screenshot.
  const canFinish = !!doorId && (assessment.sure || assessment.noneLeft || !!demo)
  const mustFinish = !!doorId && assessment.noneLeft

  const candidates = useMemo(
    () => (doorId ? matchPaintings(mood, pool, dailySeed(userId)) : []),
    [doorId, mood, pool, userId],
  )

  const painting = resolvedPainting ?? candidates[0]

  const route = useMemo(() => (doorId && painting ? routeFor(path, painting) : undefined), [doorId, path, painting])

  const stops = useMemo<RouteStop[]>(
    () => path.map((roomId) => ({ roomId, moodPhrase: roomPhrase(roomMood(roomId)) })),
    [path, roomMood],
  )

  const destination = useMemo(() => destinationPhrase(mood), [mood])

  const setAnswer = useCallback((id: string, a: Answer) => {
    setResolvedPainting(undefined)
    setAnswers((prev) => ({ ...prev, [id]: a }))
  }, [])

  const chooseDoor = useCallback((id: RoomId, from?: RoomId) => {
    setPath((prev) => {
      const cut = from && prev.includes(from) ? prev.indexOf(from) + 1 : prev.length
      const kept = prev.slice(0, cut).filter((r) => r !== id)
      const next = [...kept, id]
      if (next.length === prev.length && next.every((r, i) => r === prev[i])) return prev
      // Drop answers from rooms that are no longer on the path.
      const dropped = prev.filter((r) => !next.includes(r))
      if (dropped.length) {
        setAnswers((a) => {
          const copy = { ...a }
          for (const r of dropped) for (const s of rooms[r].statements) delete copy[s.id]
          return copy
        })
      }
      setResolvedPainting(undefined)
      return next
    })
  }, [])

  const resolve = useCallback(
    (p: Painting) => {
      setResolvedPainting(p)
      setFinishedAt(new Date())
      writeLastRoom(path[path.length - 1])
    },
    [path],
  )

  const reset = useCallback((start: RoomId = START_ROOM) => {
    setAnswers({})
    setPath([start in rooms ? start : START_ROOM])
    setResolvedPainting(undefined)
    setFinishedAt(undefined)
  }, [])

  // Memoized so consumers' effects can depend on the walk without re-running every render.
  const value = useMemo<WalkState>(
    () => ({
      answers,
      path,
      startId,
      doorId,
      mood,
      hallMood,
      doorIds,
      assessment,
      canFinish,
      mustFinish,
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
      path,
      startId,
      doorId,
      mood,
      hallMood,
      doorIds,
      assessment,
      canFinish,
      mustFinish,
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
