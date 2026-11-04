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
  /**
   * Rooms the line passes through on this floor, in order: the block, its waypoint index, and
   * its number in the whole walk (1 = where the walk began). A stairs landing has no number.
   */
  stops: { key: string; index: number; n?: number }[]
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
 * to the painting's gallery, along walkable galleries (see routing.ts). The maps draw one floor
 * at a time (the floor of the last room), so the waypoints only carry that floor: the line enters
 * at the hall or at the top of the stairs, visits the rooms walked on that floor in order, and
 * ends at the painting. Rooms on the other floor are still listed in `visited` and lit on the
 * plan. Minutes cover the whole walk, every floor, with a staircase for each change.
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

  // Blocks to light up.
  const visited: string[] = []
  const changedFloors = walked.some((id) => rooms[id].floor !== start.floor)
  if (fromHall) visited.push(floor === 2 ? 'hall2' : 'hall')
  if ((fromHall && floor === 2) || changedFloors) visited.push('stairs')
  for (const id of walked) if (id !== START_ROOM) visited.push(rooms[id].planKey)

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
  const finalLeg = legBetween(floor, prevPoint, destPoint)
  lengthMeters += finalLeg.meters

  // Waypoints on the current floor only. The line starts inside the room the walk began in: on
  // floor 2 that is the Great Hall balcony at the top of the Grand Staircase, so a walk that
  // began downstairs still visibly starts at the hall rather than in mid-air.
  const points: { key: string; point: [number, number]; n?: number }[] = []
  const arrivedByStairs = changedFloors && start.floor !== floor && !fromHall
  if (fromHall) points.push({ key: floor === 1 ? 'hall' : 'hall2', point: blocks[floor === 1 ? 'hall' : 'hall2'].center, n: 1 })
  else if (arrivedByStairs) points.push({ key: 'stairs', point: stairsPoint(floor) })
  walked.forEach((id, i) => {
    if (id === START_ROOM) return
    const r = rooms[id]
    if (r.floor !== floor) return
    points.push({ key: r.planKey, point: blocks[r.planKey].center, n: i + 1 })
  })
  if (!points.length) points.push({ key: roomBlock.key, point: roomBlock.center, n: walked.length })

  const waypoints: [number, number][] = [points[0].point]
  const stops: WalkRoute['stops'] = [{ key: points[0].key, index: 0, n: points[0].n }]
  for (let i = 1; i < points.length; i++) {
    const leg = legBetween(floor, points[i - 1].point, points[i].point)
    waypoints.push(...leg.points.slice(1))
    stops.push({ key: points[i].key, index: waypoints.length - 1, n: points[i].n })
  }
  const hereIndex = waypoints.length - 1
  const ahead = legBetween(floor, points[points.length - 1].point, destPoint)
  waypoints.push(...ahead.points.slice(1))

  const next = parent && parent.key !== roomBlock.key ? parent.key : null
  const minutes = Math.max(1, Math.round(lengthMeters / 80))

  return { floor, visited, next, dest: destBlock.key, waypoints, hereIndex, stops, lengthMeters, minutes }
}

export function startBlockKey(floor: 1 | 2): string {
  return floor === 2 ? 'hall2' : rooms[START_ROOM].planKey
}

/** Human label for a destination block, e.g. "Gallery 822". */
export function galleryLabel(painting: Pick<Painting, 'gallery'>): string {
  return painting.gallery ? `Gallery ${painting.gallery}` : 'Your painting'
}
