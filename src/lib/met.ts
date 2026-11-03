import type { Painting } from '../data/types'
import { KEYS, readJson, writeJson } from './storage'

export const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1'
const CACHE_MS = 7 * 24 * 60 * 60 * 1000

export interface MetObject {
  objectID: number
  title: string
  artistDisplayName: string
  objectDate: string
  medium: string
  GalleryNumber: string
  primaryImageSmall: string
  primaryImage: string
  objectURL: string
  isPublicDomain: boolean
}

interface Cached {
  at: number
  obj: MetObject
}

export class MetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetError'
  }
}

/** Fetch one object record, cached in localStorage for 7 days under mg.obj.<id>. */
export async function fetchObject(id: number, signal?: AbortSignal): Promise<MetObject> {
  const cached = readJson<Cached | null>(KEYS.object(id), null)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.obj

  const res = await fetch(`${MET_API}/objects/${id}`, { signal })
  const text = await res.text()
  if (!res.ok || !text.startsWith('{')) throw new MetError(`Met API returned ${res.status}`)
  const obj = JSON.parse(text) as MetObject
  writeJson(KEYS.object(id), { at: Date.now(), obj } satisfies Cached)
  return obj
}

/** Merge a live record into a bundled painting. Curated fields always win. */
export function refreshPainting(p: Painting, o: MetObject): Painting {
  return {
    ...p,
    title: o.title || p.title,
    artist: o.artistDisplayName || p.artist,
    date: o.objectDate || p.date,
    medium: o.medium || p.medium,
    gallery: o.GalleryNumber || null,
    image: o.primaryImageSmall || p.image,
    imageLarge: o.primaryImage || p.imageLarge,
    objectURL: o.objectURL || p.objectURL,
  }
}
