import { useMemo } from 'react'
import { blocks, OUTLINE, type PlanBlock, type WalkRoute } from '../lib/floorplan'

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

/** Default isometric projection from the floor plan notes: north up-right, Fifth Avenue down-right. */
function project([x, y]: [number, number], z = 0): [number, number] {
  return [(x + y) * 0.866, (x - y) * 0.5 - z]
}

function pathOf(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z'
}

/** A flat extruded block: top face plus the two visible side faces. */
function Slab({ block, fill, side, s }: {
  block: PlanBlock
  fill: string
  side: string
  s: (p: [number, number], z?: number) => [number, number]
}) {
  const top = block.poly.map((p) => s(p, SLAB))
  const bottom = block.poly.map((p) => s(p, 0))
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

export function ShareRouteMap({ route, destinationLabel }: { route: WalkRoute; destinationLabel: string }) {
  const { s, outline } = useMemo(() => {
    const raw = OUTLINE.map((p) => project(p))
    const xs = raw.map((p) => p[0])
    const ys = raw.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys) - 22
    const maxY = Math.max(...ys) + 8
    const k = Math.min((W - 16) / (maxX - minX), (H - 16) / (maxY - minY))
    const ox = (W - (maxX - minX) * k) / 2 - minX * k
    const oy = (H - (maxY - minY) * k) / 2 - minY * k
    const s = (p: [number, number], z = 0): [number, number] => {
      const [px, py] = project(p, z)
      return [px * k + ox, py * k + oy]
    }
    return { s, outline: OUTLINE.map((p) => s(p)) }
  }, [])

  const visited = route.visited.map((k) => blocks[k]).filter((b) => b && !b.stairs)
  const dest = blocks[route.dest]
  const stairs = route.visited.map((k) => blocks[k]).find((b) => b?.stairs)
  const routePts = route.waypoints.map((p) => s(p, SLAB))
  const start = routePts[0]
  const end = routePts[routePts.length - 1]
  const drawDest = dest && !visited.some((b) => b.key === dest.key)
  // Small red block marking the exact gallery, drawn in plan space around the last waypoint.
  const spot = route.waypoints[route.waypoints.length - 1]
  const innerBlock: [number, number][] = [
    [spot[0] - 6, spot[1] - 5],
    [spot[0] + 6, spot[1] - 5],
    [spot[0] + 6, spot[1] + 5],
    [spot[0] - 6, spot[1] + 5],
  ].map((p) => s(p as [number, number], SLAB + 0.2))

  // Draw north-most (back) blocks first so nearer ones overlap correctly in the isometric view.
  const ordered = [...visited, ...(drawDest ? [dest] : [])].sort(
    (a, b) => b.center[1] - b.center[0] - (a.center[1] - a.center[0]),
  )

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" aria-label="Map of your route through the museum">
      <path d={pathOf(outline)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinejoin="round" />
      {stairs && (
        <g stroke="rgba(255,255,255,0.7)" strokeWidth="1">
          {[0, 1, 2, 3, 4].map((i) => {
            const t = i / 4
            const x = stairs.poly[0][0] + t * (stairs.poly[1][0] - stairs.poly[0][0])
            const a = s([x, stairs.poly[0][1]], SLAB * t)
            const b = s([x, stairs.poly[2][1]], SLAB * t)
            return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
        </g>
      )}
      {ordered.map((b) => (
        <Slab key={b.key} block={b} s={s} fill="#FFFFFF" side="#C9C3BA" />
      ))}
      <path d={pathOf(innerBlock)} fill="#E4002B" opacity="0.95" />
      <polyline
        points={routePts.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="#E4002B"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={start[0]} cy={start[1]} r="4.5" fill="#E4002B" stroke="#FFFFFF" strokeWidth="1.4" />
      <g transform={`translate(${end[0]} ${end[1]})`}>
        <path d="M0 0 C-6 -8 -8 -11 -8 -15 A8 8 0 1 1 8 -15 C8 -11 6 -8 0 0Z" fill="#E4002B" stroke="#FFFFFF" strokeWidth="1.2" />
        <circle cx="0" cy="-15" r="2.6" fill="#FFFFFF" />
      </g>
      {ordered.map((b) => {
        const c = s(b.center, SLAB)
        const isDest = b.key === route.dest
        // Long walks crowd the card: keep the destination and the first room, drop the rest.
        const isStart = b.key === visited[0]?.key
        if (visited.length > 3 && !isDest && !isStart) return null
        const label = isDest ? destinationLabel : (MAP_LABELS[b.key] ?? b.name)
        const [lx, ly] = isDest ? [end[0], end[1] + 13] : [c[0], c[1] + SLAB + 11]
        return (
          <text
            key={b.key}
            x={lx}
            y={ly}
            fill={isDest ? '#FFFFFF' : 'rgba(255,255,255,0.8)'}
            fontSize="9"
            fontFamily="Inter, system-ui, sans-serif"
            textAnchor="middle"
            style={{ paintOrder: 'stroke', stroke: 'rgba(31,29,27,0.35)', strokeWidth: 2 }}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
