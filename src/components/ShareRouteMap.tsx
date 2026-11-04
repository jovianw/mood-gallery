import { useMemo } from 'react'
import { blocks, blocksOnFloor, OUTLINE, type FloorRoute, type PlanBlock, type WalkRoute } from '../lib/floorplan'

/** Short labels for the share card map. */
const MAP_LABELS: Record<string, string> = {
  hall: 'Great Hall',
  hall2: 'Great Hall',
  eurp: 'European Ptg.',
  c19: '19th-C. Ptg.',
  g822: 'Gallery 822',
  amer: 'American Wing',
  arms: 'Arms & Armor',
  egypt: 'Egyptian Art',
  dendur: 'Dendur',
  asian: 'Asian Art',
  greek: 'Greek & Roman',
}

const W = 256
const H = 150
const SLAB = 7
/** Vertical gap between the two floors when a walk used both, in plan meters. */
const LIFT = 30

type Project = (p: [number, number], z?: number) => [number, number]

/** Default isometric projection from the floor plan notes: north up-right, Fifth Avenue down-right. */
function project([x, y]: [number, number], z = 0): [number, number] {
  return [(x + y) * 0.866, (x - y) * 0.5 - z]
}

function pathOf(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z'
}

/** A flat extruded block: top face plus the two visible side faces. */
function Slab({ block, fill, side, s, z }: { block: PlanBlock; fill: string; side: string; s: Project; z: number }) {
  const top = block.poly.map((p) => s(p, z + SLAB))
  const bottom = block.poly.map((p) => s(p, z))
  const n = top.length
  // Side faces: draw every edge; the painter's order hides the back ones under the top.
  const sides = top.map((_, i) => {
    const j = (i + 1) % n
    return pathOf([top[i], top[j], bottom[j], bottom[i]])
  })
  return (
    <g>
      {sides.map((d, i) => (
        <path key={i} d={d} fill={side} />
      ))}
      <path d={pathOf(top)} fill={fill} stroke="rgba(31,29,27,0.25)" strokeWidth="0.6" />
    </g>
  )
}

function Badge({ at, n }: { at: [number, number]; n: number }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r="5.2" fill="#1F1D1B" stroke="#FFFFFF" strokeWidth="1.2" />
      <text y="2.6" fill="#FFFFFF" fontSize="7" fontWeight="600" fontFamily="Inter, system-ui, sans-serif" textAnchor="middle">
        {n}
      </text>
    </g>
  )
}

/** The stair ramp, drawn as rungs climbing from the lower plane to the upper one. */
function StairRamp({ s, from, to }: { s: Project; from: number; to: number }) {
  const st = blocksOnFloor(2).find((b) => b.stairs)
  if (!st) return null
  return (
    <g stroke="rgba(255,255,255,0.7)" strokeWidth="1">
      {[0, 1, 2, 3, 4].map((i) => {
        const t = i / 4
        const x = st.poly[0][0] + t * (st.poly[1][0] - st.poly[0][0])
        const z = from + t * (to - from)
        const a = s([x, st.poly[0][1]], z)
        const b = s([x, st.poly[2][1]], z)
        return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
      })}
    </g>
  )
}

/** One floor of the card map: footprint, lit rooms, its part of the line, its numbered stops. */
function Layer({ view, route, z, s, labelAll }: { view: FloorRoute; route: WalkRoute; z: number; s: Project; labelAll: boolean }) {
  const isFinal = view.floor === route.floor
  const visited = view.visited.map((k) => blocks[k]).filter((b) => b && !b.stairs)
  const dest = blocks[route.dest]
  const drawDest = isFinal && dest && !visited.some((b) => b.key === dest.key)
  // Draw north-most (back) blocks first so nearer ones overlap correctly in the isometric view.
  const ordered = [...visited, ...(drawDest ? [dest] : [])].sort(
    (a, b) => b.center[1] - b.center[0] - (a.center[1] - a.center[0]),
  )
  const pts = view.waypoints.map((p) => s(p, z + SLAB))
  const outline = OUTLINE.map((p) => s(p, z))
  return (
    <g>
      <path d={pathOf(outline)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinejoin="round" />
      {ordered.map((b) => (
        <Slab key={b.key} block={b} s={s} z={z} fill="#FFFFFF" side="#C9C3BA" />
      ))}
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#E4002B"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {view.stops
        .filter((st) => st.n !== undefined && !(isFinal && st.key === route.dest))
        .map((st) => (
          <Badge key={st.key} at={pts[st.index]} n={st.n!} />
        ))}
      {ordered.map((b) => {
        const isDest = isFinal && b.key === route.dest
        const isStart = view.stops.some((st) => st.n === 1 && st.key === b.key)
        if (isDest || (!labelAll && !isStart)) return null
        const c = s(b.center, z + SLAB)
        return (
          <text
            key={b.key}
            x={c[0]}
            y={c[1] + SLAB + 11}
            fill="rgba(255,255,255,0.8)"
            fontSize="9"
            fontFamily="Inter, system-ui, sans-serif"
            textAnchor="middle"
            style={{ paintOrder: 'stroke', stroke: 'rgba(31,29,27,0.35)', strokeWidth: 2 }}
          >
            {MAP_LABELS[b.key] ?? b.name}
          </text>
        )
      })}
    </g>
  )
}

export function ShareRouteMap({ route, destinationLabel }: { route: WalkRoute; destinationLabel: string }) {
  const stacked = !!route.other
  const lift = stacked ? LIFT : 0
  const s = useMemo<Project>(() => {
    const raw = [...OUTLINE.map((p) => project(p)), ...OUTLINE.map((p) => project(p, lift + SLAB))]
    const xs = raw.map((p) => p[0])
    const ys = raw.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys) - 22
    const maxY = Math.max(...ys) + 8
    const k = Math.min((W - 16) / (maxX - minX), (H - 16) / (maxY - minY))
    const ox = (W - (maxX - minX) * k) / 2 - minX * k
    const oy = (H - (maxY - minY) * k) / 2 - minY * k
    return (p, z = 0) => {
      const [px, py] = project(p, z)
      return [px * k + ox, py * k + oy]
    }
  }, [lift])

  const views: FloorRoute[] = route.other ? [route, route.other] : [route]
  const lower = views.find((v) => v.floor === 1)
  const upper = views.find((v) => v.floor === 2)
  const zOf = (v: FloorRoute) => (v.floor === 2 ? lift : 0)
  const roomCount = views.reduce((n, v) => n + v.visited.filter((k) => !blocks[k]?.stairs).length, 0)
  // Two floors leave no room for every label: keep the start and the destination only.
  const labelAll = roomCount <= 3 && !stacked

  // Where the line ends on the final floor: the exact gallery, marked with a small red block and a pin.
  const end = s(route.waypoints[route.waypoints.length - 1], zOf(route) + SLAB)
  const spot = route.waypoints[route.waypoints.length - 1]
  const innerBlock: [number, number][] = [
    [spot[0] - 6, spot[1] - 5],
    [spot[0] + 6, spot[1] - 5],
    [spot[0] + 6, spot[1] + 5],
    [spot[0] - 6, spot[1] + 5],
  ].map((p) => s(p as [number, number], zOf(route) + SLAB + 0.2))

  // Stair connector between the floors: from where the line leaves one to where it picks up on the other.
  let connector: [number, number][] | null = null
  if (route.other) {
    const leaving = route.other
    connector = [
      s(leaving.waypoints[leaving.waypoints.length - 1], zOf(leaving) + SLAB),
      s(route.waypoints[0], zOf(route) + SLAB),
    ]
  }
  const stairsLit = views.some((v) => v.visited.includes('stairs'))

  const pin = (
    <g transform={`translate(${end[0]} ${end[1]})`}>
      <path d="M0 0 C-6 -8 -8 -11 -8 -15 A8 8 0 1 1 8 -15 C8 -11 6 -8 0 0Z" fill="#E4002B" stroke="#FFFFFF" strokeWidth="1.2" />
      <circle cx="0" cy="-15" r="2.6" fill="#FFFFFF" />
    </g>
  )
  const destText = (
    <text
      x={end[0]}
      y={end[1] + 13}
      fill="#FFFFFF"
      fontSize="9"
      fontFamily="Inter, system-ui, sans-serif"
      textAnchor="middle"
      style={{ paintOrder: 'stroke', stroke: 'rgba(31,29,27,0.35)', strokeWidth: 2 }}
    >
      {destinationLabel}
    </text>
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-label="Map of your route through the museum">
      {lower && <Layer view={lower} route={route} z={0} s={s} labelAll={labelAll} />}
      {lower && route.floor === 1 && <path d={pathOf(innerBlock)} fill="#E4002B" opacity="0.95" />}
      {stairsLit && <StairRamp s={s} from={stacked ? SLAB : 0} to={stacked ? lift + SLAB : SLAB} />}
      {connector && (
        <polyline
          points={connector.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#E4002B"
          strokeWidth="1.8"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      )}
      {route.floor === 1 && pin}
      {upper && <Layer view={upper} route={route} z={lift} s={s} labelAll={labelAll} />}
      {upper && route.floor === 2 && <path d={pathOf(innerBlock)} fill="#E4002B" opacity="0.95" />}
      {route.floor === 2 && pin}
      {destText}
    </svg>
  )
}
