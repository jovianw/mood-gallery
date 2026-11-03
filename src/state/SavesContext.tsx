import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { MoodVector, RouteStop } from '../data/types'
import { KEYS, readJson, writeJson } from '../lib/storage'

/** One saved painting. Shape matches users/{uid}/saves/{objectID} in Firestore. */
export interface SavedPainting {
  objectID: number
  title: string
  artist: string
  date: string
  medium: string
  imageUrl: string
  imageLargeUrl: string
  galleryNumber: string | null
  museum: 'met'
  moodVector: MoodVector
  moodWords: string[]
  route: RouteStop[]
  /** ISO timestamp. */
  savedAt: string
  /** Curated "why" sentence so a saved painting can be reopened without the walk in memory. */
  why?: string
  objectURL?: string
}

export interface WalkRecord {
  route: RouteStop[]
  moodVector: MoodVector
  paintingId: number
  /** ISO timestamp. */
  finishedAt: string
}

export interface SavesState {
  saves: SavedPainting[]
  walks: WalkRecord[]
  isSaved: (objectID: number) => boolean
  save: (record: SavedPainting) => Promise<void>
  unsave: (objectID: number) => Promise<void>
  recordWalk: (walk: WalkRecord) => Promise<void>
  /** True while the first read from storage or Firestore is in flight. */
  loading: boolean
}

const SavesContext = createContext<SavesState | null>(null)

/** Guest saves: everything lives in this browser under mg.saves and mg.walks. */
export function readGuestSaves(): SavedPainting[] {
  return readJson<SavedPainting[]>(KEYS.saves, [])
}

export function readGuestWalks(): WalkRecord[] {
  return readJson<WalkRecord[]>(KEYS.walks, [])
}

export function GuestSavesProvider({ children }: { children: ReactNode }) {
  const [saves, setSaves] = useState<SavedPainting[]>(readGuestSaves)
  const [walks, setWalks] = useState<WalkRecord[]>(readGuestWalks)

  useEffect(() => writeJson(KEYS.saves, saves), [saves])
  useEffect(() => writeJson(KEYS.walks, walks), [walks])

  const isSaved = useCallback((id: number) => saves.some((s) => s.objectID === id), [saves])

  const value = useMemo<SavesState>(
    () => ({
      saves,
      walks,
      isSaved,
      loading: false,
      save: async (record) =>
        setSaves((prev) => [record, ...prev.filter((s) => s.objectID !== record.objectID)]),
      unsave: async (id) => setSaves((prev) => prev.filter((s) => s.objectID !== id)),
      recordWalk: async (walk) => setWalks((prev) => [walk, ...prev]),
    }),
    [saves, walks, isSaved],
  )

  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>
}

export { SavesContext }

export function useSaves(): SavesState {
  const ctx = useContext(SavesContext)
  if (!ctx) throw new Error('useSaves must be used inside a saves provider')
  return ctx
}
