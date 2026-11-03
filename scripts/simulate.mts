// Simulates walks with synthetic visitors to tune and validate the stopping rule.
// Usage: node scripts/simulate.mts [--walks N] [--tr 0.6] [--tp 0.5] [--grid] [--write]
//   --grid   sweep thresholds and print a table
//   --write  write src/data/stats.json for the About page (uses --tr/--tp)
// Visitors are not a uniform cloud: six personas with correlated axes, a mix of consistent and
// sloppy answerers, some who answer at random, and a share with an "agree" bias.
import { readFileSync, writeFileSync } from 'node:fs'
import { rooms, DOOR_ROOMS, START_ROOM } from '../src/data/rooms.ts'
import {
  AXES,
  assessWalk,
  moodFromAnswers,
  nextDoors,
  similarity,
  MIN_ROOMS,
} from '../src/lib/matching.ts'
import { belief, doorValues, posteriorFromAnswers, toCandidate, type Candidate } from '../src/lib/bayes.ts'
import type { Answer, MoodVector, RoomId } from '../src/data/types.ts'

const paintings = JSON.parse(readFileSync(new URL('../src/data/paintings.json', import.meta.url), 'utf8')) as {
  objectID: number
  room: RoomId
  mood: MoodVector
}[]

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? Number(process.argv[i + 1]) : def
}
const WALKS = arg('--walks', 1500)
const GRID = process.argv.includes('--grid')
const WRITE = process.argv.includes('--write')
const EPS = arg('--eps', 0.03)
let DELTA_OVERRIDE: number | null = null
const DELTA_ARG = arg('--delta', 0.06)

/* ---------- Visitors ---------- */

let seed = 12345
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}
const gauss = () => {
  const u = Math.max(rnd(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}
const clamp = (x: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, x))

// Persona centers: six real works spread across the collection (a far-point sweep), so the
// visitors live where the art lives and the axis correlations come from the data.
function farPoints(n: number): number[][] {
  const vecs = paintings.map((p) => AXES.map((k) => p.mood[k] ?? 0))
  const picked = [vecs[0]]
  while (picked.length < n) {
    let best = vecs[0]
    let bestD = -1
    for (const v of vecs) {
      const d = Math.min(...picked.map((q) => Math.hypot(...v.map((x, i) => x - q[i]))))
      if (d > bestD) {
        bestD = d
        best = v
      }
    }
    picked.push(best)
  }
  return picked
}
const PERSONAS: number[][] = farPoints(6)

interface Visitor {
  theta: MoodVector
  noise: number
  random: boolean
  acquiesce: number
}

function makeVisitor(): Visitor {
  const c = PERSONAS[Math.floor(rnd() * PERSONAS.length)]
  const theta: MoodVector = {}
  AXES.forEach((k, i) => {
    theta[k] = clamp(c[i] + 0.35 * gauss())
  })
  const u = rnd()
  return {
    theta,
    noise: u < 0.6 ? 0.3 : 0.6,
    random: rnd() < 0.1,
    acquiesce: rnd() < 0.3 ? 0.6 : 0,
  }
}

function answerRoom(v: Visitor, id: RoomId, answers: Record<string, Answer>) {
  for (const s of rooms[id].statements) {
    let raw: number
    if (v.random) raw = 1 + rnd() * 6
    else raw = 4 - 3 * s.direction * v.theta[s.axis] + gauss() * v.noise * 3 - v.acquiesce
    answers[s.id] = Math.round(clamp(raw, 1, 7)) as Answer
  }
}

/* ---------- Policies ---------- */

const DOOR_LIST = DOOR_ROOMS.map((id) => rooms[id])
const allCandidates: Candidate[] = paintings.map((p) => toCandidate(p.objectID, p.room, p.mood))
const byRoom = new Map<string, Candidate[]>()
for (const c of allCandidates) byRoom.set(c.room, [...(byRoom.get(c.room) ?? []), c])

function trueBest(theta: MoodVector): number {
  let best = -1
  let bs = -Infinity
  for (const p of paintings) {
    const s = similarity(theta, p.mood)
    if (s > bs) {
      bs = s
      best = p.objectID
    }
  }
  return best
}

interface Outcome {
  rooms: number
  chosen: number
  regret: number
  hit: boolean
}

function finishWith(v: Visitor, path: RoomId[], chosen: number): Outcome {
  const best = trueBest(v.theta)
  const pc = paintings.find((p) => p.objectID === chosen)!
  const pb = paintings.find((p) => p.objectID === best)!
  const regret = similarity(v.theta, pb.mood) - similarity(v.theta, pc.mood)
  return {
    rooms: path.length,
    chosen,
    regret,
    // "Hit" = as good as the best for this visitor, within EPS in cosine.
    hit: regret <= EPS,
  }
}

const follow = () => rnd() < 0.75

/** The shipped heuristic. */
function walkHeuristic(v: Visitor): Outcome {
  const answers: Record<string, Answer> = {}
  const path: RoomId[] = [START_ROOM]
  answerRoom(v, START_ROOM, answers)
  for (;;) {
    const pathRooms = path.map((id) => rooms[id])
    const mood = moodFromAnswers(pathRooms.flatMap((r) => r.statements), answers)
    const cur = path[path.length - 1]
    const pool = paintings.filter((p) => p.room === cur)
    const a = assessWalk(mood, pathRooms, answers, DOOR_LIST, pool)
    if ((a.sure && path.length >= MIN_ROOMS) || a.noneLeft) {
      const ranked = [...pool].sort((x, y) => similarity(mood, y.mood) - similarity(mood, x.mood))
      return finishWith(v, path, ranked[0].objectID)
    }
    const doors = nextDoors(mood, pathRooms, answers, DOOR_LIST).map((r) => r.id)
    const pick = follow() ? doors[0] : doors[Math.floor(rnd() * doors.length)]
    path.push(pick)
    answerRoom(v, pick, answers)
  }
}

/** The Bayesian policy. */
function walkBayes(v: Visitor, tr: number, tp: number): Outcome {
  const answers: Record<string, Answer> = {}
  const path: RoomId[] = [START_ROOM]
  answerRoom(v, START_ROOM, answers)
  for (;;) {
    const pathRooms = path.map((id) => rooms[id])
    const post = posteriorFromAnswers(pathRooms.flatMap((r) => r.statements), answers)
    const cur = path[path.length - 1]
    const unvisited = DOOR_LIST.filter((r) => !path.includes(r.id))
    const live = [cur, ...unvisited.map((r) => r.id)].filter((id) => id !== START_ROOM)
    const cands = live.flatMap((id) => byRoom.get(id) ?? [])
    const b = belief(post, cands, 256, path.length, EPS)
    const pool = byRoom.get(cur) ?? []
    let regret = Infinity
    let pickId = pool[0]?.id ?? -1
    for (let i = 0; i < cands.length; i++) {
      if (cands[i].room === cur && b.regret[i] < regret) {
        regret = b.regret[i]
        pickId = cands[i].id
      }
    }
    void tr
    void tp
    const enough = path.length >= MIN_ROOMS
    if ((enough && cur !== START_ROOM && regret <= (DELTA_OVERRIDE ?? DELTA_ARG)) || unvisited.length === 0) {
      return finishWith(v, path, pickId)
    }
    const values = doorValues(post, unvisited, cands, b, { seed: path.length })
    const doors = values.slice(0, 3).map((d) => d.room as RoomId)
    const pick = follow() ? doors[0] : doors[Math.floor(rnd() * doors.length)]
    path.push(pick)
    answerRoom(v, pick, answers)
  }
}

/* ---------- Runs ---------- */

interface Summary {
  walks: number
  mean: number
  hist: Record<number, number>
  hit: number
  regret: number
}

function summarize(outs: Outcome[]): Summary {
  const hist: Record<number, number> = {}
  for (const o of outs) hist[o.rooms] = (hist[o.rooms] ?? 0) + 1
  return {
    walks: outs.length,
    mean: outs.reduce((s, o) => s + o.rooms, 0) / outs.length,
    hist,
    hit: outs.filter((o) => o.hit).length / outs.length,
    regret: outs.reduce((s, o) => s + o.regret, 0) / outs.length,
  }
}

function run(n: number, tr: number, tp: number) {
  seed = 12345
  const visitors = Array.from({ length: n }, makeVisitor)
  const t0 = Date.now()
  const heur = summarize(visitors.map(walkHeuristic))
  const t1 = Date.now()
  const bayes = summarize(visitors.map((v) => walkBayes(v, tr, tp)))
  const t2 = Date.now()
  return { heur, bayes, msHeur: t1 - t0, msBayes: t2 - t1 }
}

const fmt = (s: Summary) =>
  `mean ${s.mean.toFixed(2)}  hit ${(100 * s.hit).toFixed(1)}%  regret ${s.regret.toFixed(3)}  ` +
  Object.entries(s.hist)
    .map(([k, v]) => `${k}:${((100 * v) / s.walks).toFixed(0)}%`)
    .join(' ')

if (GRID) {
  for (const d of [0.04, 0.06, 0.08, 0.1]) {
    DELTA_OVERRIDE = d
    const r = run(WALKS, 0, 0)
    console.log(`delta ${d} | bayes ${fmt(r.bayes)} | ${r.msBayes} ms`)
  }
  const r = run(WALKS, 0, 0)
  console.log(`heuristic         | ${fmt(r.heur)}`)
} else {
  const tr = arg('--tr', 0.6)
  const tp = arg('--tp', 0.5)
  const r = run(WALKS, tr, tp)
  console.log(`heuristic | ${fmt(r.heur)} | ${r.msHeur} ms`)
  console.log(`bayes     | ${fmt(r.bayes)} | ${r.msBayes} ms`)
  if (WRITE) {
    const out = {
      generatedAt: new Date().toISOString().slice(0, 10),
      walks: WALKS,
      thresholds: { regret: DELTA_ARG, minRooms: MIN_ROOMS, eps: EPS },
      visitors: {
        personas: PERSONAS.length,
        noise: 'sigma 0.3 (60%) or 0.6 (30%), 10% answer at random, 30% lean toward agree; personas are six far-apart real works',
        follow: 0.75,
      },
      heuristic: r.heur,
      bayes: r.bayes,
      paintings: paintings.length,
    }
    writeFileSync(new URL('../src/data/stats.json', import.meta.url), JSON.stringify(out, null, 2) + '\n')
    console.log('wrote src/data/stats.json')
  }
}
