import plan from '../data/met_floorplan.json'
import { rooms, START_ROOM } from '../data/rooms'
import type { Painting, RoomId } from '../data/types'

/** One block on a floor of the traced Met plan. Units are meters, x toward Fifth Avenue, y north. */
export interface PlanBlock {
  key: string
  name: string
  gallery: string
  floor: 1 | 2
  /** Footprint polygon, counter-clockwise in plan coordinates. */
  poly: [number, number][]
  center: [number, number]
  dim?: boolean
  stairs?: boolean
  inner?: boolean
  small?: boolean
}

type RawBlock = {
  name: string
  gallery: string
  x0?: number
  y0?: number
  x1?: number
  y1?: number
  poly?: number[][]
  dim?: boolean
  stairs?: boolean
  inner?: boolean
  small?: boolean
  ly?: number
}

function toBlock(key: string, raw: RawBlock, floor: 1 | 2): PlanBlock {
  const poly: [number, number][] = raw.poly
    ? raw.poly.map(([x, y]) => [x, y] as [number, number])
    : [
        [raw.x0!, raw.y0!],
        [raw.x1!, raw.y0!],
        [raw.x1!, raw.y1!],
        [raw.x0!, raw.y1!],
      ]
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
  const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length
  return {
    key,
    name: raw.name,
    gallery: raw.gallery,
    floor,
    poly,
    center: [cx, cy],
    dim: raw.dim,
    stairs: raw.stairs,
    inner: raw.inner,
    small: raw.small,
  }
}

const floor1 = Object.entries(plan.floor1 as Record<string, RawBlock>).map(([k, r]) => toBlock(k, r, 1))
const floor2 = Object.entries(plan.floor2 as Record<string, RawBlock>).map(([k, r]) => toBlock(k, r, 2))

export const OUTLINE = plan.outline as [number, number][]
export const ROOM_HEIGHT = plan.roomHeightMeters as number
export const FLOOR_GAP = 12

export const blocks: Record<string, PlanBlock> = Object.fromEntries(
  [...floor1, ...floor2].map((b) => [b.key, b]),
)

export function blocksOnFloor(floor: 1 | 2): PlanBlock[] {
  return floor === 1 ? floor1 : floor2
}

export function pointInPoly([x, y]: [number, number], poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

/** The non-inner block that contains an inner block (g822 -> c19). */
export function parentOf(block: PlanBlock): PlanBlock | undefined {
  if (!block.inner) return undefined
  return blocksOnFloor(block.floor).find((b) => !b.inner && b.key !== block.key && pointInPoly(block.center, b.poly))
}

export interface WalkRoute {
  floor: 1 | 2
  /** Blocks already walked, in order (hall, stairs, chosen room ...). */
  visited: string[]
  /** Block you walk straight through on the way to the painting, if any. */
  next: string | null
  /** Block the painting hangs in. */
  dest: string
  /** Plan coordinates of the route, start to finish. */
  waypoints: [number, number][]
  /** Index of the waypoint where "You are here" sits (end of the solid part). */
  hereIndex: number
  lengthMeters: number
  minutes: number
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Deterministic point inside a block, offset from the center so a pin never sits on the "here" dot. */
function spotInBlock(block: PlanBlock, salt: string): [number, number] {
  const xs = block.poly.map((p) => p[0])
  const ys = block.poly.map((p) => p[1])
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  let hsh = 0
  for (let i = 0; i < salt.length; i++) hsh = (hsh * 31 + salt.charCodeAt(i)) >>> 0
  const ax = ((hsh % 7) / 6 - 0.5) * 0.5 * w
  const ay = (((hsh >> 3) % 7) / 6 - 0.5) * 0.5 * h
  return [block.center[0] + ax, block.center[1] + ay]
}

/** Route from the Great Hall through the chosen room to the painting's gallery. */
export function routeFor(roomId: RoomId, painting: Pick<Painting, 'galleryKey' | 'objectID'>): WalkRoute {
  const room = rooms[roomId]
  const floor = room.floor
  const roomBlock = blocks[room.planKey]
  const destBlock = blocks[painting.galleryKey] ?? roomBlock
  const parent = parentOf(destBlock)
  const visited: string[] = floor === 2 ? ['hall2', 'stairs', room.planKey] : ['hall', room.planKey]
  const waypoints: [number, number][] = []

  if (floor === 2) {
    waypoints.push([-34, 8.5], [-40.5, -31])
  } else {
    waypoints.push(blocks.hall.center)
  }
  waypoints.push(roomBlock.center)
  const hereIndex = waypoints.length - 1

  let next: string | null = null
  const through = parent
  if (through && through.key !== roomBlock.key) {
    next = through.key
    // enter the through-room at the edge nearest the chosen room, then cross to the destination
    const mid: [number, number] = [
      (roomBlock.center[0] + through.center[0]) / 2,
      (roomBlock.center[1] + through.center[1]) / 2,
    ]
    waypoints.push(mid)
  }

  if (destBlock.key === roomBlock.key) {
    waypoints.push(spotInBlock(destBlock, String(painting.objectID)))
  } else {
    waypoints.push(destBlock.center)
  }

  let lengthMeters = 0
  for (let i = 1; i < waypoints.length; i++) lengthMeters += dist(waypoints[i - 1], waypoints[i])
  if (floor === 2) lengthMeters += 60 // the Grand Staircase and the walk to it
  const minutes = Math.max(1, Math.round(lengthMeters / 80))

  return {
    floor,
    visited,
    next,
    dest: destBlock.key,
    waypoints,
    hereIndex,
    lengthMeters,
    minutes,
  }
}

export function startBlockKey(floor: 1 | 2): string {
  return floor === 2 ? 'hall2' : rooms[START_ROOM].planKey
}

/** Human label for a destination block, e.g. "Gallery 822". */
export function galleryLabel(painting: Pick<Painting, 'gallery'>): string {
  return painting.gallery ? `Gallery ${painting.gallery}` : 'Your painting'
}
