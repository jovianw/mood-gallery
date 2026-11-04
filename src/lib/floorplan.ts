import plan from '../data/met_floorplan.json'
import { rooms, START_ROOM } from '../data/rooms'
import type { Painting, RoomId } from '../data/types'
import { legBetween, stairsPoint } from './routing'

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

/** The part of a route that lies on one floor. */
export interface FloorRoute {
  floor: 1 | 2
  /** Blocks on this floor that light up: rooms walked, the hall, the staircase. */
  visited: string[]
  /** Plan coordinates of the line on this floor, start to finish. */
  waypoints: [number, number][]
  /** Index of the waypoint of the last room answered on this floor (end of the walked part). */
  hereIndex: number
  /**
   * Rooms the line passes through on this floor, in order: the block, its waypoint index, and
   * its number in the whole walk (1 = where the walk began). A stairs landing has no number.
   */
  stops: { key: string; index: number; n?: number }[]
  /** Set when the walk left this floor by the Grand Staircase; the line then ends at the stairs. */
  leaves?: 'up' | 'down'
}

export interface WalkRoute extends FloorRoute {
  /** Block you walk straight through on the way to the painting, if any. */
  next: string | null
  /** Block the painting hangs in. */
  dest: string
  /** The other floor's part of the walk, when the walk used both floors. */
  other?: FloorRoute
  lengthMeters: number
  minutes: number
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

/**
 * Route from the room the walk began in (the Great Hall by default) through every room walked
 * to the painting's gallery, along walkable galleries (see routing.ts). The route is computed
 * floor by floor: the floor the painting is on carries the "you are here" marker and the leg
 * ahead; the other floor, if the walk used it, is returned as `other` with its line ending at
 * the Grand Staircase. Minutes cover the whole walk, every floor, with a staircase for each change.
 */
export function routeFor(path: RoomId[], painting: Pick<Painting, 'galleryKey' | 'objectID'>): WalkRoute {
  const walked = path.length ? path : [START_ROOM]
  const start = rooms[walked[0]]
  const last = rooms[walked[walked.length - 1]]
  const floor = last.floor
  const roomBlock = blocks[last.planKey]
  const destBlock = blocks[painting.galleryKey] ?? roomBlock
  const parent = parentOf(destBlock)
  const fromHall = start.id === START_ROOM
  const destPoint: [number, number] =
    destBlock.key === roomBlock.key ? spotInBlock(destBlock, String(painting.objectID)) : destBlock.center

  // Whole-walk length, floor by floor, with the staircase for each change.
  let lengthMeters = 0
  let prevPoint: [number, number] = fromHall ? blocks.hall.center : blocks[start.planKey].center
  let prevFloor: 1 | 2 = start.floor
  for (const id of walked.slice(1)) {
    const r = rooms[id]
    const c = blocks[r.planKey].center
    if (r.floor !== prevFloor) {
      lengthMeters += legBetween(prevFloor, prevPoint, stairsPoint(prevFloor)).meters + 60
      prevPoint = stairsPoint(r.floor)
      prevFloor = r.floor
    }
    lengthMeters += legBetween(prevFloor, prevPoint, c).meters
    prevPoint = c
  }
  if (floor !== prevFloor) {
    lengthMeters += legBetween(prevFloor, prevPoint, stairsPoint(prevFloor)).meters + 60
    prevPoint = stairsPoint(floor)
  }
  lengthMeters += legBetween(floor, prevPoint, destPoint).meters

  const floorRoute = (f: 1 | 2): FloorRoute => {
    const onFloor = walked.map((id, i) => ({ id, i })).filter((x) => rooms[x.id].floor === f)
    const first = onFloor[0]?.i
    const enteredByStairs = first === undefined || (first > 0 && rooms[walked[first - 1]].floor !== f)
    const points: { key: string; point: [number, number]; n?: number }[] = []
    const visited: string[] = []
    if (f === 1 && fromHall) {
      points.push({ key: 'hall', point: blocks.hall.center, n: 1 })
      visited.push('hall')
    } else if (f === 2 && fromHall && first === 1) {
      // Straight up the Grand Staircase from the hall: the line starts on the hall balcony.
      points.push({ key: 'hall2', point: blocks.hall2.center, n: 1 })
      visited.push('hall2', 'stairs')
    } else if (enteredByStairs) {
      points.push({ key: 'stairs', point: stairsPoint(f) })
      visited.push('stairs')
    }
    for (const x of onFloor) {
      if (x.id === START_ROOM) continue
      const r = rooms[x.id]
      points.push({ key: r.planKey, point: blocks[r.planKey].center, n: x.i + 1 })
      visited.push(r.planKey)
    }
    const leaves: FloorRoute['leaves'] = f === floor ? undefined : f === 1 ? 'up' : 'down'
    if (leaves && !visited.includes('stairs')) visited.push('stairs')
    if (!points.length) points.push({ key: roomBlock.key, point: roomBlock.center, n: walked.length })

    const waypoints: [number, number][] = [points[0].point]
    const stops: FloorRoute['stops'] = [{ key: points[0].key, index: 0, n: points[0].n }]
    for (let i = 1; i < points.length; i++) {
      const leg = legBetween(f, points[i - 1].point, points[i].point)
      waypoints.push(...leg.points.slice(1))
      stops.push({ key: points[i].key, index: waypoints.length - 1, n: points[i].n })
    }
    const hereIndex = waypoints.length - 1
    const ahead = legBetween(f, points[points.length - 1].point, leaves ? stairsPoint(f) : destPoint)
    waypoints.push(...ahead.points.slice(1))
    return { floor: f, visited, waypoints, hereIndex, stops, leaves }
  }

  const main = floorRoute(floor)
  const otherFloor: 1 | 2 = floor === 1 ? 2 : 1
  const usedOther = walked.some((id) => rooms[id].floor === otherFloor)
  const other = usedOther ? floorRoute(otherFloor) : undefined

  const next = parent && parent.key !== roomBlock.key ? parent.key : null
  const minutes = Math.max(1, Math.round(lengthMeters / 80))

  return { ...main, next, dest: destBlock.key, other, lengthMeters, minutes }
}

export function startBlockKey(floor: 1 | 2): string {
  return floor === 2 ? 'hall2' : rooms[START_ROOM].planKey
}

/** Human label for a destination block, e.g. "Gallery 822". */
export function galleryLabel(painting: Pick<Painting, 'gallery'>): string {
  return painting.gallery ? `Gallery ${painting.gallery}` : 'Your painting'
}
