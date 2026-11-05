import type { Painting } from '../data/types'
import { KEYS, readJson, writeJson } from './storage'

export const MET_API = 'https://collectionapi.metmuseum.org/public/collection/v1'
const CACHE_MS = 7 * 24 * 60 * 60 * 1000
/** One object request may not take longer than this; the bundled record is good enough after that. */
export const REQUEST_MS = 10000

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

/** A signal that aborts when any of the given signals does, or after `ms`. */
export function deadline(ms: number, ...signals: (AbortSignal | undefined)[]): AbortSignal {
  const all = [AbortSignal.timeout(ms), ...signals.filter((s): s is AbortSignal => !!s)]
  if ('any' in AbortSignal) return AbortSignal.any(all)
  const c = new AbortController()
  for (const s of all) {
    if (s.aborted) c.abort(s.reason)
    else s.addEventListener('abort', () => c.abort(s.reason), { once: true })
  }
  return c.signal
}

/**
 * Fetch one object record, cached in localStorage for 7 days under mg.obj.<id>.
 * Each request is capped at REQUEST_MS. When the request fails for any reason other than the
 * caller aborting, an expired cache entry is returned if there is one; otherwise the error
 * propagates and the caller falls back to the bundled record.
 */
export async function fetchObject(id: number, signal?: AbortSignal): Promise<MetObject> {
  const cached = readJson<Cached | null>(KEYS.object(id), null)
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.obj

  try {
    const res = await fetch(`${MET_API}/objects/${id}`, { signal: deadline(REQUEST_MS, signal) })
    const text = await res.text()
    if (!res.ok || !text.startsWith('{')) throw new MetError(`Met API returned ${res.status}`)
    const obj = JSON.parse(text) as MetObject
    writeJson(KEYS.object(id), { at: Date.now(), obj } satisfies Cached)
    return obj
  } catch (err) {
    if (signal?.aborted) throw err
    if (cached) return cached.obj
    throw err
  }
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
