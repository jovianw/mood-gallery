import { Line, OrbitControls, OrthographicCamera } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Rotate } from './Icons'
import {
  blocks,
  blocksOnFloor,
  FLOOR_GAP,
  OUTLINE,
  ROOM_HEIGHT,
  type FloorRoute,
  type PlanBlock,
  type WalkRoute,
} from '../lib/floorplan'

/* Palette from the handoff. Only these colors appear in the scene. */
const C = {
  canvas: '#2A2725',
  park: '#262422',
  street: '#3A3632',
  plate: '#353230',
  plateOutline: '#E3DDD3',
  room: '#403C38',
  roomSide: '#2F2C2A',
  dim: '#373431',
  dimSide: '#2C2927',
  visited: '#7E1226',
  visitedSide: '#5C0E1C',
  next: '#6B6661',
  nextSide: '#4F4B47',
  dest: '#E4002B',
  destSide: '#A8001F',
  stairs: '#B5AEA4',
  stairsSide: '#8F887F',
  plaster: '#F6F3EE',
}

const DEFAULT_AZIMUTH = Math.PI / 4
const DEFAULT_POLAR = (55 * Math.PI) / 180
const BASE_ZOOM = 0.8
const CAMERA_DISTANCE = 900

/** Building center in plan coordinates, used as the orbit target. */
const CENTER: [number, number] = [-82, 1.5]

/** Vertical gap between the floors when both are drawn: pulled apart so floor 1 stays readable. */
const SPLIT_GAP = 34

/** Which floors to draw and how far apart. A walk on one floor keeps the true 12 m gap. */
function gapFor(route: WalkRoute) {
  return route.other ? SPLIT_GAP : FLOOR_GAP
}

/** Every numbered room stop across the floors drawn, with its world position, by walk order. */
export function numberedStops(route: WalkRoute) {
  const gap = gapFor(route)
  const views: FloorRoute[] = route.other ? [route, route.other] : [route]
  const out: { key: string; n: number; position: [number, number, number] }[] = []
  for (const v of views) {
    const lineY = (v.floor === 1 ? 0 : gap) + ROOM_HEIGHT + 0.8
    for (const st of v.stops) {
      if (st.n === undefined) continue
      // The room you are in gets the "here" marker instead of a number.
      if (v === route && st.index === route.hereIndex) continue
      out.push({ key: `${v.floor}:${st.key}`, n: st.n, position: toWorld(v.waypoints[st.index], lineY) })
    }
  }
  return out.sort((a, b) => a.n - b.n)
}

/** Plan (x, y) -> world (x, y_up, z). North (+y) is -z. */
function toWorld([x, y]: [number, number], up: number): [number, number, number] {
  return [x, up, -y]
}

function shapeFrom(poly: [number, number][]): THREE.Shape {
  const s = new THREE.Shape()
  poly.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)))
  s.closePath()
  return s
}

type Role = 'visited' | 'next' | 'dest' | 'dim' | 'stairs' | 'room'

function roleOf(block: PlanBlock, view: FloorRoute, route: WalkRoute): Role {
  const isFinal = view.floor === route.floor
  if (isFinal && block.key === route.dest) return 'dest'
  if (view.visited.includes(block.key)) return block.stairs ? 'stairs' : 'visited'
  if (isFinal && block.key === route.next) return 'next'
  if (block.stairs) return 'stairs'
  if (block.dim) return 'dim'
  return 'room'
}

const ROLE_COLORS: Record<Role, [top: string, side: string]> = {
  visited: [C.visited, C.visitedSide],
  next: [C.next, C.nextSide],
  dest: [C.dest, C.destSide],
  dim: [C.dim, C.dimSide],
  stairs: [C.stairs, C.stairsSide],
  room: [C.room, C.roomSide],
}

function Block({ block, role, up, height, ghost }: { block: PlanBlock; role: Role; up: number; height: number; ghost?: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(shapeFrom(block.poly), { depth: height, bevelEnabled: false })
    return g
  }, [block, height])
  const [top, side] = ROLE_COLORS[role]
  const materials = useMemo(
    () => [
      new THREE.MeshBasicMaterial({ color: top, transparent: ghost, opacity: ghost ? 0.42 : 1, depthWrite: !ghost }),
      new THREE.MeshBasicMaterial({ color: side, transparent: ghost, opacity: ghost ? 0.42 : 1, depthWrite: !ghost }),
    ],
    [top, side, ghost],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      <mesh geometry={geometry} material={materials} rotation={[-Math.PI / 2, 0, 0]} position={[0, up, 0]} />
      <Line
        points={block.poly.map((p) => toWorld(p, up + height + 0.05))}
        color={C.plateOutline}
        lineWidth={0.6}
        transparent
        opacity={role === 'dim' ? 0.12 : ghost ? 0.18 : 0.28}
      />
    </group>
  )
}

/** Stair ramp: a wedge rising from floor 1 toward floor 2 inside the staircase footprint. */
function Stairs({ block, lit, top }: { block: PlanBlock; lit: boolean; top: number }) {
  const xs = block.poly.map((p) => p[0])
  const ys = block.poly.map((p) => p[1])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  // The Grand Staircase climbs westward (away from the hall), so the wedge is tall at x0.
  const geometry = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(x0, 0)
    s.lineTo(x1, 0)
    s.lineTo(x1, 0.5)
    s.lineTo(x0, top)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false })
    return g
  }, [x0, x1, y0, y1, top])
  useEffect(() => () => geometry.dispose(), [geometry])
  const steps = 7
  return (
    <group>
      <mesh geometry={geometry} position={[0, 0, -y1]}>
        <meshBasicMaterial color={lit ? C.stairsSide : C.dimSide} />
      </mesh>
      {Array.from({ length: steps }, (_, i) => {
        const t = i / (steps - 1)
        const x = x1 - t * (x1 - x0)
        const y = 0.5 + t * (top - 0.5)
        return (
          <Line
            key={i}
            points={[
              [x, y + 0.1, -y0],
              [x, y + 0.1, -y1],
            ]}
            color={lit ? C.stairs : C.dim}
            lineWidth={1}
          />
        )
      })}
    </group>
  )
}

function Plate({ up, lit, ghost }: { up: number; lit: boolean; ghost?: boolean }) {
  const geometry = useMemo(() => new THREE.ShapeGeometry(shapeFrom(OUTLINE)), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <group>
      {lit && (
        <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, up - 0.02, 0]}>
          <meshBasicMaterial color={C.plate} transparent={ghost} opacity={ghost ? 0.3 : 1} depthWrite={!ghost} />
        </mesh>
      )}
      <Line
        points={[...OUTLINE, OUTLINE[0]].map((p) => toWorld(p, up))}
        color={C.plateOutline}
        lineWidth={lit ? 1 : 0.8}
        transparent
        opacity={lit ? 0.7 : 0.22}
      />
    </group>
  )
}

/** A flat text label painted onto a plane lying on the ground. */
function GroundLabel({
  text,
  position,
  rotation,
  width,
}: {
  text: string
  position: [number, number, number]
  rotation: number
  width: number
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, 512, 64)
      ctx.font = '600 40px Inter, system-ui, sans-serif'
      ctx.fillStyle = '#F6F3EE'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ;(ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '6px'
      ctx.fillText(text, 256, 34)
    }
    const t = new THREE.CanvasTexture(canvas)
    t.anisotropy = 4
    return t
  }, [text])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]}>
      <planeGeometry args={[width, width / 8]} />
      <meshBasicMaterial map={texture} transparent opacity={0.55} depthWrite={false} />
    </mesh>
  )
}

function Surroundings() {
  // Fifth Avenue runs north-south along the east face; Central Park sits to the west.
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[64, -0.1, -1.5]}>
        <planeGeometry args={[34, 440]} />
        <meshBasicMaterial color={C.street} />
      </mesh>
      <Line
        points={[
          [64, 0, 218],
          [64, 0, -221],
        ]}
        color={C.plateOutline}
        lineWidth={0.8}
        dashed
        dashSize={10}
        gapSize={8}
        transparent
        opacity={0.45}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-250, -0.1, -1.5]}>
        <planeGeometry args={[90, 440]} />
        <meshBasicMaterial color={C.park} />
      </mesh>
      <GroundLabel text="FIFTH AVENUE" position={[88, 0.1, -1.5]} rotation={Math.PI / 2} width={150} />
      <GroundLabel text="CENTRAL PARK" position={[-222, 0.1, -1.5]} rotation={Math.PI / 2} width={150} />
    </group>
  )
}

function DestinationPin({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[2.2, 16, 12]} />
        <meshBasicMaterial color={C.plaster} />
      </mesh>
      <mesh position={[0, 9, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[5.6, 14, 20]} />
        <meshBasicMaterial color={C.dest} />
      </mesh>
      <mesh position={[0, 18, 0]}>
        <sphereGeometry args={[6.6, 20, 16]} />
        <meshBasicMaterial color={C.dest} />
      </mesh>
      <mesh position={[0, 18, 0]}>
        <sphereGeometry args={[2.6, 16, 12]} />
        <meshBasicMaterial color={C.plaster} />
      </mesh>
    </group>
  )
}

function HereMarker({ position }: { position: [number, number, number] }) {
  const halo = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!halo.current) return
    const t = (clock.getElapsedTime() % 2) / 2
    halo.current.scale.setScalar(1 + t * 0.9)
    ;(halo.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t)
  })
  return (
    <group position={position}>
      <mesh ref={halo} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.5, 32]} />
        <meshBasicMaterial color={C.plaster} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[3.4, 20, 16]} />
        <meshBasicMaterial color={C.plaster} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.6, 16, 12]} />
        <meshBasicMaterial color={C.canvas} />
      </mesh>
    </group>
  )
}

interface Labels {
  here: RefObject<HTMLDivElement | null>
  dest: RefObject<HTMLDivElement | null>
  /** One numbered badge per room stop, in route.stops order. */
  stops: RefObject<(HTMLDivElement | null)[]>
}

function Scene({ route, labels }: { route: WalkRoute; labels: Labels }) {
  const gap = gapFor(route)
  const floorY = (f: 1 | 2) => (f === 1 ? 0 : gap)
  const views: FloorRoute[] = route.other ? [route, route.other] : [route]
  const drawn = (f: 1 | 2) => views.some((v) => v.floor === f)
  // With both floors up, the upper one is ghosted except for the rooms that matter, so the floor
  // below shows through.
  const ghostFloor: 1 | 2 | null = route.other ? 2 : null
  const stairsBlock = blocksOnFloor(2).find((b) => b.stairs)!
  const stairsLit = views.some((v) => v.visited.includes('stairs'))

  const upFinal = floorY(route.floor)
  const lineYOf = (f: 1 | 2) => floorY(f) + ROOM_HEIGHT + 0.8
  const pts = route.waypoints.map((p) => toWorld(p, lineYOf(route.floor)))
  const here = pts[route.hereIndex]
  const dest = pts[pts.length - 1]
  const destTop = upFinal + ROOM_HEIGHT + (blocks[route.dest]?.inner ? 2.5 : 0)
  const numbered = numberedStops(route)

  // The stair connector: from where the line leaves one floor to where it picks up on the other.
  let connector: [number, number, number][] | null = null
  if (route.other) {
    const leaving = route.other
    const from = toWorld(leaving.waypoints[leaving.waypoints.length - 1], lineYOf(leaving.floor))
    const to = toWorld(route.waypoints[0], lineYOf(route.floor))
    connector = [from, to]
  }

  return (
    <group>
      <Surroundings />
      <Plate up={0} lit={drawn(1)} />
      <Plate up={gap} lit={drawn(2)} ghost={ghostFloor === 2} />
      {views.map((v) =>
        blocksOnFloor(v.floor).map((b) => {
          if (b.stairs) return null
          const role = roleOf(b, v, route)
          const h = b.inner ? ROOM_HEIGHT + 2.5 : ROOM_HEIGHT
          const ghost = v.floor === ghostFloor && (role === 'room' || role === 'dim')
          return <Block key={`${v.floor}:${b.key}`} block={b} role={role} up={floorY(v.floor)} height={h} ghost={ghost} />
        }),
      )}
      <Stairs block={stairsBlock} lit={stairsLit} top={gap} />
      {views.map((v) => {
        const vp = v.waypoints.map((p) => toWorld(p, lineYOf(v.floor)))
        const isFinal = v.floor === route.floor
        // Rooms already walked: a thin, quieter line. The leg still ahead: bold and solid.
        const walked = isFinal ? vp.slice(0, v.hereIndex + 1) : vp
        const ahead = isFinal ? vp.slice(v.hereIndex) : []
        return (
          <group key={v.floor}>
            {walked.length > 1 && (
              <Line points={walked} color={C.plaster} lineWidth={1.6} transparent opacity={0.55} dashed dashSize={4} gapSize={3} />
            )}
            {ahead.length > 1 && <Line points={ahead} color={C.plaster} lineWidth={3.2} />}
          </group>
        )
      })}
      {connector && (
        <Line points={connector} color={C.plaster} lineWidth={1.6} transparent opacity={0.55} dashed dashSize={4} gapSize={3} />
      )}
      {numbered.map((s) => (
        <mesh key={s.key} position={s.position}>
          <sphereGeometry args={[2.4, 14, 12]} />
          <meshBasicMaterial color={C.plaster} />
        </mesh>
      ))}
      <HereMarker position={here} />
      <DestinationPin position={[dest[0], destTop, dest[2]]} />
      <LabelTracker
        anchors={[
          { el: labels.here, point: [here[0], here[1] + 2, here[2]] },
          { el: labels.dest, point: [dest[0], destTop + 1, dest[2]] },
          ...numbered.map((s, i) => ({
            el: { current: labels.stops.current?.[i] ?? null },
            point: [s.position[0], s.position[1] + 1, s.position[2]] as [number, number, number],
          })),
        ]}
      />
    </group>
  )
}

interface LabelAnchor {
  el: RefObject<HTMLDivElement | null>
  point: [number, number, number]
}

/**
 * Projects anchor points to screen space every frame and moves plain DOM labels that live
 * outside the canvas. (drei's <Html> loses its content under React StrictMode, so labels are
 * positioned by hand.)
 */
function LabelTracker({ anchors }: { anchors: LabelAnchor[] }) {
  const { camera, size } = useThree()
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const pts = anchors.map((a) => {
      v.set(a.point[0], a.point[1], a.point[2]).project(camera)
      return [(v.x * 0.5 + 0.5) * size.width, (-v.y * 0.5 + 0.5) * size.height] as const
    })
    const [here, dest] = pts
    anchors.forEach((a, i) => {
      const el = a.el.current
      if (!el) return
      let [x, y] = pts[i]
      // The gallery label is centered under its pin, so keep its center far enough from the
      // card edges that the text stays inside the card.
      if (i === 1) x = Math.min(Math.max(x, 56), size.width - 56)
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
      el.style.opacity = '1'
    })
    // Keep the two labels out of each other's way and inside the card: "You are here" flips
    // to the left when the pin is to its right or when it would run off the right edge, and the
    // gallery label moves above the pin head when the two anchors are close.
    if (here && dest) {
      const dx = dest[0] - here[0]
      const dy = dest[1] - here[1]
      const nearRightEdge = here[0] > size.width - 96
      anchors[0].el.current?.classList.toggle('is-left', nearRightEdge || (dx > 0 && Math.abs(dy) < 40))
      anchors[1].el.current?.classList.toggle('is-above', Math.hypot(dx, dy) < 90)
    }
  })
  return null
}

/** Tells the shell when the first frame has been drawn, so the loading caption can go away. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onReady()
  })
  return null
}

interface RigProps {
  autoRotate: boolean
  /** True when two floors are drawn: zoom out a little and aim between them. */
  split: boolean
  resetSignal: number
  onAzimuth: (rad: number) => void
}

/** Camera + controls. Auto-rotate pauses while dragging and resumes after a short idle. */
function Rig({ autoRotate, resetSignal, onAzimuth, split }: RigProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { size } = useThree()
  const [idle, setIdle] = useState(true)
  const idleTimer = useRef<number | undefined>(undefined)
  const zoom = BASE_ZOOM * (size.width / 342) * (split ? 0.78 : 1)
  const target = useMemo(() => new THREE.Vector3(CENTER[0], split ? SPLIT_GAP / 2 + 2 : 4, -CENTER[1]), [split])

  const defaultPosition = useMemo(() => {
    const p = new THREE.Vector3().setFromSphericalCoords(CAMERA_DISTANCE, DEFAULT_POLAR, DEFAULT_AZIMUTH)
    return p.add(target)
  }, [target])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.object.position.copy(defaultPosition)
    const cam = c.object as THREE.OrthographicCamera
    cam.zoom = zoom
    cam.updateProjectionMatrix()
    c.target.copy(target)
    c.update()
  }, [resetSignal, defaultPosition, target, zoom])

  useFrame(() => {
    const c = controls.current
    if (!c) return
    onAzimuth(c.getAzimuthalAngle())
  })

  const onStart = () => {
    setIdle(false)
    window.clearTimeout(idleTimer.current)
  }
  const onEnd = () => {
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setIdle(true), 2500)
  }
  useEffect(() => () => window.clearTimeout(idleTimer.current), [])

  return (
    <>
      <OrthographicCamera makeDefault position={defaultPosition} zoom={zoom} near={-2000} far={4000} />
      <OrbitControls
        ref={controls}
        target={target}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        minZoom={zoom * 0.8}
        maxZoom={zoom * 1.5}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.08}
        autoRotate={autoRotate && idle}
        autoRotateSpeed={0.5}
        onStart={onStart}
        onEnd={onEnd}
        makeDefault
      />
    </>
  )
}

export interface RouteMap3DProps {
  route: WalkRoute
  destinationLabel: string
}

export function RouteMap3D({ route, destinationLabel }: RouteMap3DProps) {
  const [autoRotate, setAutoRotate] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [resetSignal, setResetSignal] = useState(0)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const needle = useRef<HTMLElement>(null)
  const hereLabel = useRef<HTMLDivElement>(null)
  const destLabel = useRef<HTMLDivElement>(null)
  const stopLabels = useRef<(HTMLDivElement | null)[]>([])
  const numbered = numberedStops(route)

  useEffect(() => {
    const el = wrap.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const onAzimuth = (rad: number) => {
    if (!needle.current) return
    const deg = 90 - (rad * 180) / Math.PI
    needle.current.style.transform = `translateY(-100%) rotate(${deg}deg)`
  }

  return (
    <div
      ref={wrap}
      className="mapcard"
      aria-label="3D map of your route through the museum. Drag to turn."
      onDoubleClick={() => setResetSignal((n) => n + 1)}
    >
      <Canvas
        dpr={[1, 2]}
        frameloop={visible ? 'always' : 'never'}
        gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }}
        onCreated={({ gl }) => gl.setClearColor(C.canvas)}
        style={{ touchAction: 'none' }}
      >
        <Scene route={route} labels={{ here: hereLabel, dest: destLabel, stops: stopLabels }} />
        <Rig autoRotate={autoRotate} resetSignal={resetSignal} onAzimuth={onAzimuth} split={!!route.other} />
        <FirstFrame onReady={() => setReady(true)} />
      </Canvas>
      {!ready && (
        <span className="mapcard__loading" role="status">
          Drawing your route…
        </span>
      )}
      <div className="map-labels" aria-hidden="true">
        <div ref={hereLabel} className="map-label-anchor">
          <span className="map-label">You are here</span>
        </div>
        <div ref={destLabel} className="map-label-anchor">
          <span className="map-label map-label--below">{destinationLabel}</span>
        </div>
        {numbered.map((s, i) => (
          <div
            key={s.key}
            ref={(el) => {
              stopLabels.current[i] = el
            }}
            className="map-label-anchor"
          >
            <span className="map-badge">{s.n}</span>
          </div>
        ))}
      </div>
      <span className="mapcard__hint" aria-hidden="true">
        Drag to turn
      </span>
      <button
        type="button"
        className="mapcard__rotate"
        aria-pressed={autoRotate}
        aria-label={autoRotate ? 'Stop rotating the map' : 'Rotate the map automatically'}
        onClick={() => setAutoRotate((v) => !v)}
      >
        <Rotate width={14} height={14} /> Rotate
      </button>
      <button
        type="button"
        className="mapcard__compass"
        aria-label="Reset the map view"
        onClick={() => setResetSignal((n) => n + 1)}
      >
        <i ref={needle} />
        <span>N</span>
      </button>
    </div>
  )
}
