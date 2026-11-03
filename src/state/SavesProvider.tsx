import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Firestore } from 'firebase/firestore'
import { getFirebase } from '../lib/firebase'
import { KEYS, readJson, writeJson } from '../lib/storage'
import { useAuth } from './AuthContext'
import {
  GuestSavesProvider,
  readGuestSaves,
  readGuestWalks,
  SavesContext,
  type SavedPainting,
  type SavesState,
  type WalkRecord,
} from './SavesContext'

const MERGE_DECLINED_KEY = 'mg.mergeDeclined'

/**
 * Picks the storage for saves: Firestore for a signed-in user, this browser for a guest.
 * Also exposes the one-time "move your guest saves" prompt after a sign-in.
 */
export function SavesProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (!auth.user) return <GuestSavesProvider>{children}</GuestSavesProvider>
  return <FirestoreSavesProvider uid={auth.user.uid}>{children}</FirestoreSavesProvider>
}

function FirestoreSavesProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const [db, setDb] = useState<Firestore | null>(null)
  const [saves, setSaves] = useState<SavedPainting[]>([])
  const [walks, setWalks] = useState<WalkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingMerge, setPendingMerge] = useState<SavedPainting[]>([])

  useEffect(() => {
    let alive = true
    let unsubSaves: (() => void) | undefined
    let unsubWalks: (() => void) | undefined
    ;(async () => {
      const fb = await getFirebase()
      if (!fb || !alive) return
      setDb(fb.db)
      const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore')
      unsubSaves = onSnapshot(
        query(collection(fb.db, 'users', uid, 'saves'), orderBy('savedAt', 'desc')),
        (snap) => {
          setSaves(snap.docs.map((d) => d.data() as SavedPainting))
          setLoading(false)
        },
        (err) => {
          console.warn('saves listener failed', err)
          setLoading(false)
        },
      )
      unsubWalks = onSnapshot(
        query(collection(fb.db, 'users', uid, 'walks'), orderBy('finishedAt', 'desc')),
        (snap) => setWalks(snap.docs.map((d) => d.data() as WalkRecord)),
        () => undefined,
      )
      // Offer to move guest saves once per browser.
      const guest = readGuestSaves()
      const declined = readJson<boolean>(MERGE_DECLINED_KEY, false)
      if (guest.length && !declined) setPendingMerge(guest)
    })()
    return () => {
      alive = false
      unsubSaves?.()
      unsubWalks?.()
    }
  }, [uid])

  const save = useCallback(
    async (record: SavedPainting) => {
      setSaves((prev) => [record, ...prev.filter((s) => s.objectID !== record.objectID)])
      if (!db) return
      const { doc, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'users', uid, 'saves', String(record.objectID)), record)
    },
    [db, uid],
  )

  const unsave = useCallback(
    async (objectID: number) => {
      setSaves((prev) => prev.filter((s) => s.objectID !== objectID))
      if (!db) return
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'users', uid, 'saves', String(objectID)))
    },
    [db, uid],
  )

  const recordWalk = useCallback(
    async (walk: WalkRecord) => {
      setWalks((prev) => [walk, ...prev])
      if (!db) return
      const { addDoc, collection } = await import('firebase/firestore')
      await addDoc(collection(db, 'users', uid, 'walks'), walk)
    },
    [db, uid],
  )

  const mergeGuestSaves = useCallback(async () => {
    const guest = pendingMerge
    setPendingMerge([])
    for (const s of guest) await save(s)
    for (const w of readGuestWalks()) await recordWalk(w)
    writeJson(KEYS.saves, [])
    writeJson(KEYS.walks, [])
  }, [pendingMerge, save, recordWalk])

  const declineMerge = useCallback(() => {
    setPendingMerge([])
    writeJson(MERGE_DECLINED_KEY, true)
  }, [])

  const isSaved = useCallback((id: number) => saves.some((s) => s.objectID === id), [saves])

  const value = useMemo<SavesState>(
    () => ({
      saves,
      walks,
      isSaved,
      save,
      unsave,
      recordWalk,
      loading,
      pendingMergeCount: pendingMerge.length,
      mergeGuestSaves,
      declineMerge,
    }),
    [saves, walks, isSaved, save, unsave, recordWalk, loading, pendingMerge.length, mergeGuestSaves, declineMerge],
  )

  return <SavesContext.Provider value={value}>{children}</SavesContext.Provider>
}
