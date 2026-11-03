import { blocks, blocksOnFloor, pointInPoly } from './floorplan'

/**
 * Walkable-grid routing over the traced floor plan.
 *
 * Each floor is rasterized into CELL-meter cells; a cell is walkable when its center lies inside
 * any room block on that floor (galleries open into each other along shared edges on the Met
 * plan). Routes are found with A* (8-connected, octile heuristic) and then string-pulled so the
 * drawn line only bends where it has to. Nothing here is precomputed: a floor grid is a few
 * thousand cells and builds in a millisecond or two on first use.
 */

export const CELL = 2
type Pt = [number, number]

interface Grid {
  floor: 1 | 2
  x0: number
  y0: number
  w: number
  h: number
  walkable: Uint8Array
}

const grids = new Map<number, Grid>()

function buildGrid(floor: 1 | 2): Grid {
  const polys = blocksOnFloor(floor).map((b) => b.poly)
  const xs = polys.flat().map((p) => p[0])
  const ys = polys.flat().map((p) => p[1])
  const x0 = Math.floor(Math.min(...xs) / CELL) * CELL - CELL
  const y0 = Math.floor(Math.min(...ys) / CELL) * CELL - CELL
  const w = Math.ceil((Math.max(...xs) - x0) / CELL) + 2
  const h = Math.ceil((Math.max(...ys) - y0) / CELL) + 2
  const walkable = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const c: Pt = [x0 + (i + 0.5) * CELL, y0 + (j + 0.5) * CELL]
      if (polys.some((poly) => pointInPoly(c, poly))) walkable[j * w + i] = 1
    }
  }
  return { floor, x0, y0, w, h, walkable }
}

function gridFor(floor: 1 | 2): Grid {
  let g = grids.get(floor)
  if (!g) {
    g = buildGrid(floor)
    grids.set(floor, g)
  }
  return g
}

function toCell(g: Grid, p: Pt): [number, number] {
  return [
    Math.max(0, Math.min(g.w - 1, Math.floor((p[0] - g.x0) / CELL))),
    Math.max(0, Math.min(g.h - 1, Math.floor((p[1] - g.y0) / CELL))),
  ]
}

function toPoint(g: Grid, i: number, j: number): Pt {
  return [g.x0 + (i + 0.5) * CELL, g.y0 + (j + 0.5) * CELL]
}

/** Nearest walkable cell to a point (the point itself if it is inside a room). */
function snap(g: Grid, p: Pt): [number, number] | null {
  const [ci, cj] = toCell(g, p)
  if (g.walkable[cj * g.w + ci]) return [ci, cj]
  let best: [number, number] | null = null
  let bd = Infinity
  for (let r = 1; r < 12 && !best; r++) {
    for (let j = cj - r; j <= cj + r; j++) {
      for (let i = ci - r; i <= ci + r; i++) {
        if (i < 0 || j < 0 || i >= g.w || j >= g.h) continue
        if (!g.walkable[j * g.w + i]) continue
        const d = Math.hypot(i - ci, j - cj)
        if (d < bd) {
          bd = d
          best = [i, j]
        }
      }
    }
  }
  return best
}

/** Bresenham line-of-sight on the grid. */
function clear(g: Grid, a: [number, number], b: [number, number]): boolean {
  let [x0, y0] = a
  const [x1, y1] = b
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    if (!g.walkable[y0 * g.w + x0]) return false
    if (x0 === x1 && y0 === y1) return true
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

const NEIGHBORS: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

/** A* between two cells. Returns the cell path or null when the rooms are not connected. */
function astar(g: Grid, start: [number, number], goal: [number, number]): [number, number][] | null {
  const n = g.w * g.h
  const idx = (i: number, j: number) => j * g.w + i
  const gScore = new Float64Array(n).fill(Infinity)
  const came = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - goal[0])
    const dy = Math.abs(j - goal[1])
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
  }
  // Binary heap of [f, index]
  const heap: [number, number][] = []
  const push = (f: number, k: number) => {
    heap.push([f, k])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = (): [number, number] | undefined => {
    if (!heap.length) return undefined
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = 2 * c + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }

  const s = idx(start[0], start[1])
  const t = idx(goal[0], goal[1])
  gScore[s] = 0
  push(h(start[0], start[1]), s)
  while (heap.length) {
    const [, k] = pop()!
    if (closed[k]) continue
    closed[k] = 1
    if (k === t) break
    const i = k % g.w
    const j = (k - i) / g.w
    for (const [di, dj, cost] of NEIGHBORS) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= g.w || nj >= g.h) continue
      const nk = idx(ni, nj)
      if (!g.walkable[nk] || closed[nk]) continue
      // No corner cutting through walls on diagonals.
      if (di && dj && (!g.walkable[idx(i + di, j)] || !g.walkable[idx(i, j + dj)])) continue
      const tentative = gScore[k] + cost
      if (tentative < gScore[nk]) {
        gScore[nk] = tentative
        came[nk] = k
        push(tentative + h(ni, nj), nk)
      }
    }
  }
  if (came[t] === -1 && s !== t) return null
  const cells: [number, number][] = []
  for (let k = t; k !== -1; k = came[k]) {
    cells.push([k % g.w, (k - (k % g.w)) / g.w])
    if (k === s) break
  }
  return cells.reverse()
}

/** Drop every waypoint that can be skipped with a straight, in-room line. */
function pull(g: Grid, cells: [number, number][]): [number, number][] {
  if (cells.length <= 2) return cells
  const out = [cells[0]]
  let anchor = 0
  for (let i = 2; i < cells.length; i++) {
    if (!clear(g, cells[anchor], cells[i])) {
      out.push(cells[i - 1])
      anchor = i - 1
    }
  }
  out.push(cells[cells.length - 1])
  return out
}

export interface Leg {
  /** Plan coordinates, start to end, inclusive. */
  points: Pt[]
  meters: number
  /** False when no in-building path exists and the leg is a straight line. */
  routed: boolean
}

/** Walkable route between two plan points on one floor. */
export function legBetween(floor: 1 | 2, from: Pt, to: Pt): Leg {
  const g = gridFor(floor)
  const a = snap(g, from)
  const b = snap(g, to)
  const straight: Leg = { points: [from, to], meters: Math.hypot(to[0] - from[0], to[1] - from[1]), routed: false }
  if (!a || !b) return straight
  const cells = astar(g, a, b)
  if (!cells) return straight
  const pts = pull(g, cells).map(([i, j]) => toPoint(g, i, j))
  // Keep the exact endpoints so pins and dots sit where the caller asked.
  pts[0] = from
  pts[pts.length - 1] = to
  let meters = 0
  for (let i = 1; i < pts.length; i++) meters += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return { points: pts, meters, routed: true }
}

/** Where the Grand Staircase lands on each floor, in plan coordinates. */
export function stairsPoint(floor: 1 | 2): Pt {
  const s = blocks.stairs
  return floor === 2 ? s.center : [s.center[0] + 14, s.center[1]]
}

/** Grid size, for the About page. */
export function gridStats(floor: 1 | 2): { cells: number; walkable: number; cell: number } {
  const g = gridFor(floor)
  let walkable = 0
  for (const v of g.walkable) walkable += v
  return { cells: g.w * g.h, walkable, cell: CELL }
}
