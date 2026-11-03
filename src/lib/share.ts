import { toPng } from 'html-to-image'
import { paintings } from '../data/paintings'
import { rooms, START_ROOM } from '../data/rooms'
import type { MoodVector, Painting, RoomId, RouteStop } from '../data/types'
import { AXES, destinationPhrase, moodSentence, moodWords } from './matching'
import { routeFor, type WalkRoute } from './floorplan'

/** Everything needed to re-render a story card. Stored in Firestore or in the URL for guests. */
export interface SharePayload {
  v: 1
  /** ISO date of the walk. */
  date: string
  roomId: RoomId
  objectID: number
  mood: MoodVector
  stops: RouteStop[]
  /** Painting fields so the card renders even if the object leaves the bundled data. */
  painting: {
    title: string
    artist: string
    date: string
    image: string
    gallery: string | null
    galleryKey: string
  }
}

export interface ShareCardData {
  payload: SharePayload
  painting: Painting
  route: WalkRoute
  sentence: string
  words: string[]
  destinationPhrase: string
  answers: number
  rooms: number
}

export function buildPayload(args: {
  date: Date
  roomId: RoomId
  painting: Painting
  mood: MoodVector
  stops: RouteStop[]
}): SharePayload {
  const mood = { ...args.mood }
  for (const a of AXES) mood[a] = Math.round(mood[a] * 100) / 100
  return {
    v: 1,
    date: args.date.toISOString(),
    roomId: args.roomId,
    objectID: args.painting.objectID,
    mood,
    stops: args.stops,
    painting: {
      title: args.painting.title,
      artist: args.painting.artist,
      date: args.painting.date,
      image: args.painting.image,
      gallery: args.painting.gallery,
      galleryKey: args.painting.galleryKey,
    },
  }
}

/** Turn a payload back into everything the card needs. */
export function hydrate(payload: SharePayload): ShareCardData {
  const bundled = paintings.find((p) => p.objectID === payload.objectID)
  const painting: Painting = bundled
    ? { ...bundled, ...payload.painting }
    : {
        objectID: payload.objectID,
        title: payload.painting.title,
        artist: payload.painting.artist,
        date: payload.painting.date,
        medium: '',
        gallery: payload.painting.gallery,
        image: payload.painting.image,
        imageLarge: payload.painting.image,
        objectURL: `https://www.metmuseum.org/art/collection/search/${payload.objectID}`,
        room: payload.roomId,
        galleryKey: payload.painting.galleryKey,
        mood: payload.mood,
        tags: moodWords(payload.mood),
        why: '',
      }
  const roomId = payload.roomId in rooms ? payload.roomId : START_ROOM
  const route = routeFor(roomId, painting)
  const answers = payload.stops.reduce((n, s) => n + (rooms[s.roomId]?.statements.length ?? 0), 0)
  return {
    payload,
    painting,
    route,
    sentence: moodSentence(payload.mood),
    words: moodWords(payload.mood),
    destinationPhrase: destinationPhrase(payload.mood),
    answers,
    rooms: payload.stops.length + 1,
  }
}

/* ---------- URL encoding for guest shares ---------- */

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodePayload(p: SharePayload): string {
  return toBase64Url(JSON.stringify(p))
}

export function decodePayload(s: string): SharePayload | null {
  try {
    const p = JSON.parse(fromBase64Url(s)) as SharePayload
    if (p.v !== 1 || !p.objectID || !p.mood || !p.stops) return null
    return p
  } catch {
    return null
  }
}

export function shareUrl(shareId: string, guestPayload?: SharePayload): string {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}w/`
  if (shareId === 'g' && guestPayload) return `${base}g?d=${encodePayload(guestPayload)}`
  return `${base}${shareId}`
}

/* ---------- PNG export ---------- */

export const EXPORT_WIDTH = 1080
export const EXPORT_HEIGHT = 1920

/**
 * Fetch an image with CORS and return an object URL, or null when the host will not allow it
 * (the card then exports without the thumbnail instead of failing on a tainted canvas).
 */
export async function fetchImageBlobUrl(src: string): Promise<string | null> {
  // Second attempt busts the HTTP cache: Chrome refuses to reuse an entry that was first
  // fetched without CORS for a CORS request.
  for (const url of [src, `${src}${src.includes('?') ? '&' : '?'}cors=1`]) {
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) continue
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) continue
      return URL.createObjectURL(blob)
    } catch {
      /* try the next url */
    }
  }
  return null
}

/** Render a DOM node (laid out at 300x533) to a 1080x1920 PNG blob. */
export async function exportCardPng(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    canvasWidth: EXPORT_WIDTH,
    canvasHeight: EXPORT_HEIGHT,
    pixelRatio: 1,
    backgroundColor: '#1F1D1B',
    // Elements that could taint the canvas (cross-origin images we could not fetch) are skipped.
    filter: (n) => !(n instanceof HTMLElement && n.dataset.skipExport === 'true'),
  })
  const res = await fetch(dataUrl)
  return res.blob()
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !('canShare' in navigator)) return false
  try {
    const f = new File([''], 'x.png', { type: 'image/png' })
    return navigator.canShare({ files: [f] })
  } catch {
    return false
  }
}

export function formatWalkDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
