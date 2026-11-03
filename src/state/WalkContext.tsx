import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { doors, rooms, START_ROOM } from '../data/rooms'
import { paintings } from '../data/paintings'
import type { Answer, MoodVector, Painting, RoomId } from '../data/types'
import { matchPainting, moodFromAnswers, recommendDoor } from '../lib/matching'

const SAVED_KEY = 'moodgallery.saved'

interface WalkState {
  answers: Record<string, Answer | undefined>
  doorId: RoomId | null
  /** Rooms visited in order, always starting with the Great Hall. */
  path: RoomId[]
  mood: MoodVector
  hallMood: MoodVector
  recommendedDoor: RoomId
  painting: Painting | undefined
  savedIds: number[]
  setAnswer: (statementId: string, answer: Answer) => void
  chooseDoor: (roomId: RoomId) => void
  toggleSaved: (objectID: number) => void
  reset: () => void
  roomMood: (roomId: RoomId) => MoodVector
  isRoomComplete: (roomId: RoomId) => boolean
}

const WalkContext = createContext<WalkState | null>(null)

function readSaved(): number[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

export function WalkProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({})
  const [doorId, setDoorId] = useState<RoomId | null>(null)
  const [savedIds, setSavedIds] = useState<number[]>(readSaved)

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedIds))
    } catch {
      /* private mode or storage disabled: saving is a nicety, not a requirement */
    }
  }, [savedIds])

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

  const recommendedDoor = useMemo(() => recommendDoor(hallMood, doors).roomId, [hallMood])

  const painting = useMemo(() => {
    if (!doorId) return undefined
    const inRoom = paintings.filter((p) => p.room === doorId)
    return matchPainting(mood, inRoom.length ? inRoom : paintings)
  }, [doorId, mood])

  const value: WalkState = {
    answers,
    doorId,
    path,
    mood,
    hallMood,
    recommendedDoor,
    painting,
    savedIds,
    setAnswer: (id, a) => setAnswers((prev) => ({ ...prev, [id]: a })),
    chooseDoor: (id) => setDoorId(id),
    toggleSaved: (id) =>
      setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    reset: () => {
      setAnswers({})
      setDoorId(null)
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
