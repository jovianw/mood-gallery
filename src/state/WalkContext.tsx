import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DOOR_ROOMS, rooms, START_ROOM } from '../data/rooms'
import { paintings } from '../data/paintings'
import type { Answer, Axis, MoodVector, Painting, RoomId, RouteStop } from '../data/types'
import {
  belief,
  doorValues,
  MIN_ROOMS,
  posteriorFromAnswers,
  REGRET_OK,
  ROOM_SURE,
  toCandidate,
  type Belief,
  type Candidate,
  type DoorValue,
  type Posterior,
} from '../lib/bayes'
import { routeFor, type WalkRoute } from '../lib/floorplan'
import {
  AXES,
  axisCoverage,
  destinationPhrase,
  moodFromAnswers,
  pickWithHistory,
  roomPhrase,
  type RecentPick,
} from '../lib/matching'
import { getGuestId } from '../lib/storage'
import { useSaves } from './SavesContext'

export type Unsure = 'rooms' | 'room' | 'painting'

export interface WalkAssessment {
  /** True when the walk can end here. */
  sure: boolean
  /** First failing check, when not sure. */
  why: Unsure | null
  /** P(this room holds a work as good as the best anywhere ahead). */
  pRoom: number
  /** P(the work we would pick here is as good as the best anywhere ahead). */
  pPaint: number
  /** The "sure" meter: pPaint when in a room, else the best pNear anywhere. */
  confidence: number
  /** Expected regret (cosine) of the work the walk would pick here. */
  regret: number
  /** Axes nobody has asked about yet. */
  missingAxes: Axis[]
  /** No unvisited rooms are left, so the walk must end here. */
  noneLeft: boolean
}

export interface WalkState {
  answers: Record<string, Answer | undefined>
  /** Rooms walked in order, starting with the room the walk began in (the Great Hall by default). */
  path: RoomId[]
  /** The room the walk began in. */
  startId: RoomId
  /** The room you are in once a door has been taken (last of the path), or null in the first room. */
  doorId: RoomId | null
  /** Posterior mean of the mood: the walk's best estimate over every answer so far. */
  mood: MoodVector
  /** Mood from the first room's answers alone. */
  hallMood: MoodVector
  posterior: Posterior
  /** Door candidates with their value, best first (fewer than 3 near the end). */
  doors: DoorValue[]
  /** Door room ids, best first. */
  doorIds: RoomId[]
  assessment: WalkAssessment
  /** The walk may end here: sure, or no rooms left. */
  canFinish: boolean
  /** No rooms are left to walk to. */
  mustFinish: boolean
  /** Candidate paintings for the current room, pick first. */
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

/** Every work as a unit vector, grouped by room, built once. */
const CANDIDATES: Candidate[] = paintings.map((p) => toCandidate(p.objectID, p.room, p.mood))
const CANDIDATES_BY_ROOM = new Map<string, Candidate[]>()
for (const c of CANDIDATES) CANDIDATES_BY_ROOM.set(c.room, [...(CANDIDATES_BY_ROOM.get(c.room) ?? []), c])
const PAINTINGS_BY_ROOM = new Map<string, Painting[]>()
for (const p of paintings) PAINTINGS_BY_ROOM.set(p.room, [...(PAINTINGS_BY_ROOM.get(p.room) ?? []), p])

const DAY_MS = 86_400_000

export function WalkProvider({ children, userId: userIdProp }: { children: ReactNode; userId?: string }) {
  const saves = useSaves()
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
    // Demo walks arrive resolved so the painting and share screens open directly.
    const last = demo.path[demo.path.length - 1]
    const m = posteriorFromAnswers(demo.path.flatMap((id) => rooms[id].statements), demo.answers).mean
    return pickWithHistory(m, PAINTINGS_BY_ROOM.get(last) ?? paintings, [])[0]
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

  // The Bayesian core: posterior over the mood, belief over which work is the match.
  const posterior = useMemo(
    () => posteriorFromAnswers(pathRooms.flatMap((r) => r.statements), answers),
    [pathRooms, answers],
  )
  const mood = posterior.mean

  const unvisited = useMemo(() => DOOR_ROOM_LIST.filter((r) => !path.includes(r.id)), [path])

  /** Works still in play: the room you are in plus every room not yet visited. */
  const live = useMemo<Candidate[]>(() => {
    const ids = [...(doorId ? [doorId] : []), ...unvisited.map((r) => r.id)]
    return ids.flatMap((id) => CANDIDATES_BY_ROOM.get(id) ?? [])
  }, [doorId, unvisited])

  const beliefNow = useMemo<Belief | null>(
    () => (live.length ? belief(posterior, live, 256, path.length) : null),
    [posterior, live, path.length],
  )

  const doors = useMemo<DoorValue[]>(() => {
    if (!beliefNow || !unvisited.length) return []
    return doorValues(posterior, unvisited, live, beliefNow, { seed: path.length * 31 + 7 })
  }, [posterior, unvisited, live, beliefNow, path.length])

  const doorIds = useMemo(() => doors.slice(0, 3).map((d) => d.room as RoomId), [doors])

  const assessment = useMemo<WalkAssessment>(() => {
    const cov = axisCoverage(pathRooms, answers)
    const missingAxes = AXES.filter((a) => cov[a] === 0)
    const noneLeft = unvisited.length === 0
    const pRoom = doorId && beliefNow ? (beliefNow.pRoomNear[doorId] ?? 0) : 0
    // The work we would pick here: the one in this room with the least expected regret.
    let pick = -1
    let regret = Infinity
    if (doorId && beliefNow) {
      for (let i = 0; i < live.length; i++) {
        if (live[i].room === doorId && beliefNow.regret[i] < regret) {
          regret = beliefNow.regret[i]
          pick = i
        }
      }
    }
    const pPaint = pick >= 0 && beliefNow ? beliefNow.pNear[pick] : 0
    let bestAnywhere = 0
    if (beliefNow) for (const q of beliefNow.pNear) if (q > bestAnywhere) bestAnywhere = q
    const confidence = doorId ? pPaint : bestAnywhere
    let why: Unsure | null = null
    if (path.length < MIN_ROOMS) why = 'rooms'
    else if (!(regret <= REGRET_OK)) why = pRoom < ROOM_SURE ? 'room' : 'painting'
    return { sure: why === null && !!doorId, why, pRoom, pPaint, confidence, regret, missingAxes, noneLeft }
  }, [pathRooms, answers, unvisited, doorId, beliefNow, path.length, live])

  // Demo walks skip the confidence check so any screen can be opened for a screenshot.
  const canFinish = !!doorId && (assessment.sure || assessment.noneLeft || !!demo)
  const mustFinish = !!doorId && assessment.noneLeft

  /** Works this visitor has already been given, for the variety penalty. */
  const recent = useMemo<RecentPick[]>(() => {
    const now = Date.now()
    return saves.walks
      .filter((w) => w.paintingId && w.finishedAt)
      .map((w) => ({ objectID: w.paintingId, daysAgo: Math.max(0, (now - Date.parse(w.finishedAt)) / DAY_MS) }))
  }, [saves.walks])

  const candidates = useMemo(() => {
    if (!doorId) return []
    const pool = PAINTINGS_BY_ROOM.get(doorId) ?? paintings
    return pickWithHistory(mood, pool, recent)
  }, [doorId, mood, recent])

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
      posterior,
      doors,
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
      posterior,
      doors,
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
