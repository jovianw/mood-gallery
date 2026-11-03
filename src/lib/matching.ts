import type { Answer, Axis, MoodVector, Painting, Room, Statement } from '../data/types'

export const AXES: Axis[] = ['energy', 'warmth', 'outlook', 'focus', 'social']

export const ZERO: MoodVector = { energy: 0, warmth: 0, outlook: 0, focus: 0, social: 0 }

/** Map a 1..7 answer (1 = Agree) to -1..1 along the statement's direction. */
export function answerToScore(statement: Statement, answer: Answer): number {
  return (statement.direction * (4 - answer)) / 3
}

/** Average answered statements per axis. Unanswered axes stay at 0. */
export function moodFromAnswers(
  statements: Statement[],
  answers: Record<string, Answer | undefined>,
): MoodVector {
  const sum: MoodVector = { ...ZERO }
  const count: MoodVector = { ...ZERO }
  for (const s of statements) {
    const a = answers[s.id]
    if (a === undefined) continue
    sum[s.axis] += answerToScore(s, a)
    count[s.axis] += 1
  }
  const out: MoodVector = { ...ZERO }
  for (const axis of AXES) out[axis] = count[axis] ? sum[axis] / count[axis] : 0
  return out
}

function dot(a: MoodVector, b: MoodVector): number {
  return AXES.reduce((acc, k) => acc + (a[k] ?? 0) * (b[k] ?? 0), 0)
}

function norm(a: MoodVector): number {
  return Math.sqrt(dot(a, a))
}

export function similarity(a: MoodVector, b: MoodVector): number {
  const n = norm(a) * norm(b)
  return n === 0 ? 0 : dot(a, b) / n
}

/** The rooms closest to the mood, best first. The top three become the doors. */
export function recommendDoors(mood: MoodVector, candidates: Room[], n = 3): Room[] {
  return [...candidates]
    .map((room, i) => ({ room, i, s: similarity(mood, room.affinity) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.room)
}

/** Small string hash (FNV-1a) so the same mood on a different day lands on a different painting. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function dailySeed(userId: string, date = new Date()): number {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  return hashString(`${day}:${userId}`)
}

/** Paintings ranked by similarity, best first. */
export function rankPaintings(mood: MoodVector, candidates: Painting[]): Painting[] {
  return [...candidates]
    .map((p, i) => ({ p, i, s: similarity(mood, p.mood) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
}

/**
 * Top three by similarity, then one of them by the daily seed. Returns the full ordered list
 * (pick first) so callers can fall back to the next one if the pick is no longer on view.
 */
export function matchPaintings(mood: MoodVector, candidates: Painting[], seed: number): Painting[] {
  const ranked = rankPaintings(mood, candidates)
  if (ranked.length <= 1) return ranked
  const top = ranked.slice(0, 3)
  const chosen = top[seed % top.length]
  return [chosen, ...ranked.filter((p) => p !== chosen)]
}

const WORDS: Record<Axis, [positive: string, negative: string, neutral: string]> = {
  energy: ['Restless', 'Calm', 'Steady'],
  warmth: ['Warm', 'Cool', 'Even'],
  outlook: ['Hopeful', 'Heavy', 'Watchful'],
  focus: ['Inward', 'Outward', 'Present'],
  social: ['Close', 'Alone', 'Easy'],
}

/** Second-position phrases so room lines read like a person wrote them. */
const TAILS: Record<Axis, [positive: string, negative: string, neutral: string]> = {
  energy: ['mind racing', 'slowing down', 'steady'],
  warmth: ['warm', 'cool-headed', 'even'],
  outlook: ['looking ahead', 'a little heavy', 'watching'],
  focus: ['keeping to yourself', 'looking around', 'present'],
  social: ['wanting company', 'wanting quiet', 'easy'],
}

/** Rough valence of each pole, used to insert "but" between a low and a high. */
const VALENCE: Record<Axis, [positive: number, negative: number]> = {
  energy: [-1, 1],
  warmth: [1, -1],
  outlook: [1, -1],
  focus: [0, 0],
  social: [0, 0],
}

const THRESHOLD = 0.25

function pole(v: number): 0 | 1 | 2 {
  return v > THRESHOLD ? 0 : v < -THRESHOLD ? 1 : 2
}

function valence(axis: Axis, v: number): number {
  const p = pole(v)
  return p === 2 ? 0 : VALENCE[axis][p]
}

function strongestAxes(mood: MoodVector, n: number): Axis[] {
  return [...AXES].sort((a, b) => Math.abs(mood[b]) - Math.abs(mood[a])).slice(0, n)
}

/** Three mood words, strongest axes first, e.g. ["Restless", "Warm", "Hopeful"]. */
export function moodWords(mood: MoodVector, n = 3): string[] {
  return strongestAxes(mood, n).map((axis) => WORDS[axis][pole(mood[axis])])
}

/** "Restless, warm, and hopeful." */
export function moodSentence(mood: MoodVector): string {
  const [a, b, c] = moodWords(mood).map((w, i) => (i === 0 ? w : w.toLowerCase()))
  return `${a}, ${b}, and ${c}.`
}

/** "restless, warm, hopeful" for the loading copy. */
export function moodList(mood: MoodVector): string {
  return moodWords(mood)
    .map((w) => w.toLowerCase())
    .join(', ')
}

/** Short phrase describing how a single room's answers came out, e.g. "Heavy, but warm". */
export function roomPhrase(mood: MoodVector): string {
  const [a, b] = strongestAxes(mood, 2)
  const first = WORDS[a][pole(mood[a])]
  const tail = TAILS[b][pole(mood[b])]
  const joiner = valence(a, mood[a]) < 0 && valence(b, mood[b]) > 0 ? ', but ' : ', '
  return `${first}${joiner}${tail}`
}

/** Phrase for the destination row: "Found it: looking ahead". */
export function destinationPhrase(mood: MoodVector): string {
  const [a] = strongestAxes(mood, 1)
  return `Found it: ${TAILS[a][pole(mood[a])]}`
}

const WHY_LEAD: Record<Axis, [positive: string, negative: string, neutral: string]> = {
  energy: ['your mind has been racing', "you've wanted things to slow down", "you're feeling steady"],
  warmth: ["you're drawn to warm light", "you're after something cool and clear", "you're feeling even"],
  outlook: ["you're looking ahead", 'something has been weighing on you', "you're keeping watch"],
  focus: ["you've been turned inward", "you've been looking outward", "you're right here"],
  social: ["you've been feeling close to people", "you've wanted some time alone", "you're easy either way"],
}

/** "Your mind has been racing, but you're drawn to warm light. {curated why}" */
export function whyThisOne(mood: MoodVector, painting: Painting): string {
  const [a, b] = strongestAxes(mood, 2)
  const first = WHY_LEAD[a][pole(mood[a])]
  const second = WHY_LEAD[b][pole(mood[b])]
  const joiner = valence(a, mood[a]) < 0 && valence(b, mood[b]) > 0 ? ', but ' : ', and '
  const lead = first.charAt(0).toUpperCase() + first.slice(1)
  const why = painting.why || defaultWhy(painting)
  return `${lead}${joiner}${second}. ${why}`.trim()
}

/** Second sentence for works without a hand-written one (the CLIP-placed part of the catalog). */
function defaultWhy(p: Painting): string {
  const what = p.medium ? p.medium.split(/[,;(]/)[0].trim().toLowerCase() : ''
  const kind = what && what.length < 40 ? what.charAt(0).toUpperCase() + what.slice(1) : 'A work'
  const when = p.date ? `, ${p.date}` : ''
  const where = p.gallery ? `, hanging in Gallery ${p.gallery}` : ''
  return `${kind}${when}${where}.`
}

/* ---------- Multi-room walks ---------- */

/** Hall plus at least two more rooms before the walk may end. */
export const MIN_ROOMS = 3
/** How clearly the best painting in the room must beat the runner-up (cosine similarity). */
export const PAINTING_MARGIN = 0.03
/** The room you are in counts as the best room if it is within this much of the best unvisited one. */
export const ROOM_SLACK = 0.03
/** Door ranking bonus per axis a room would ask about that the walk has asked about least so far. */
const COVER_BONUS = 0.12

/** How many answered statements each axis has across the rooms walked. */
export function axisCoverage(path: Room[], answers: Record<string, Answer | undefined>): Record<Axis, number> {
  const c = { ...ZERO }
  for (const room of path) for (const s of room.statements) if (answers[s.id] !== undefined) c[s.axis] += 1
  return c
}

/**
 * The next doors, best first: unvisited rooms ranked by how well they fit the mood so far, with a
 * push toward rooms whose statements ask about the axes the walk knows least about. Fewer than
 * three come back near the end of a long walk.
 */
export function nextDoors(
  mood: MoodVector,
  path: Room[],
  answers: Record<string, Answer | undefined>,
  candidates: Room[],
  n = 3,
): Room[] {
  const cov = axisCoverage(path, answers)
  const least = Math.min(...AXES.map((a) => cov[a]))
  const visited = new Set(path.map((r) => r.id))
  return candidates
    .filter((r) => !visited.has(r.id))
    .map((room, i) => {
      const asksLeast = new Set(room.statements.map((s) => s.axis).filter((a) => cov[a] === least)).size
      return { room, i, s: similarity(mood, room.affinity) + COVER_BONUS * asksLeast }
    })
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .map((x) => x.room)
}

export type Unsure = 'rooms' | 'axes' | 'room' | 'margin'

export interface WalkAssessment {
  /** True when the walk can end here: enough rooms, every axis heard from, best room, clear painting. */
  sure: boolean
  /** Why not, when not sure (first failing check). */
  why: Unsure | null
  /** Axes the walk has not asked about yet. */
  missingAxes: Axis[]
  /** Similarity gap between the best and second-best painting in this room. */
  margin: number
  /** No unvisited rooms are left, so the walk must end here. */
  noneLeft: boolean
  /** Rough 0..1 for a "getting warmer" meter. */
  score: number
}

/**
 * Decide whether the walk is sure enough to end in the room it is in. The walk keeps going while
 * any of these fail: fewer than MIN_ROOMS rooms, an axis nobody has asked about, an unvisited room
 * that fits the mood clearly better, or two paintings here still neck and neck.
 */
export function assessWalk(
  mood: MoodVector,
  path: Room[],
  answers: Record<string, Answer | undefined>,
  allRooms: Room[],
  pool: Painting[],
): WalkAssessment {
  const current = path[path.length - 1]
  const cov = axisCoverage(path, answers)
  const missingAxes = AXES.filter((a) => cov[a] === 0)
  const visited = new Set(path.map((r) => r.id))
  const unvisited = allRooms.filter((r) => !visited.has(r.id) && r.id !== path[0].id)
  const curSim = current ? similarity(mood, current.affinity) : -1
  const bestOther = unvisited.reduce((m, r) => Math.max(m, similarity(mood, r.affinity)), -1)
  const bestRoom = curSim >= bestOther - ROOM_SLACK
  const sims = pool.map((p) => similarity(mood, p.mood)).sort((a, b) => b - a)
  const margin = sims.length > 1 ? sims[0] - sims[1] : 1
  const noneLeft = unvisited.length === 0

  let why: Unsure | null = null
  if (path.length < MIN_ROOMS) why = 'rooms'
  else if (missingAxes.length) why = 'axes'
  else if (!bestRoom) why = 'room'
  else if (margin < PAINTING_MARGIN) why = 'margin'

  // Rooms and axis coverage carry most of the weight so the meter climbs with every room.
  const score = Math.min(
    1,
    0.3 * Math.min(1, (path.length - 1) / MIN_ROOMS) +
      0.3 * ((AXES.length - missingAxes.length) / AXES.length) +
      0.2 * (bestRoom ? 1 : Math.max(0, 1 - (bestOther - curSim) * 4)) +
      0.2 * Math.min(1, margin / PAINTING_MARGIN),
  )
  return { sure: why === null, why, missingAxes, margin, noneLeft, score }
}

/** Plain-words name for an axis, for "we still want to hear about ..." copy. */
export const AXIS_TOPIC: Record<Axis, string> = {
  energy: 'your energy',
  warmth: 'warm or cool',
  outlook: 'how the week has felt',
  focus: 'where your attention is',
  social: 'company or quiet',
}

/* ---------- Variety as a constraint ---------- */

/** How much a recently shown work is pushed down, in similarity units, on the day it was shown. */
export const RECENT_PENALTY = 0.08
/** Days for that push to fall to 1/e. */
export const RECENT_HALF_LIFE_DAYS = 7

export interface RecentPick {
  objectID: number
  /** Days since it was shown (0 = today). */
  daysAgo: number
}

/**
 * Choose the painting as a penalized argmax: the best match for the mood, minus a penalty that
 * decays with time since the same work was last shown to this visitor. Compared with the old
 * hash-of-the-date rotation this keeps quality first (a clear winner still wins) while making a
 * repeat visitor see something new when the top few are close. Returns the full order, pick
 * first, so the Finding screen can fall back to the next one if the pick is off view.
 */
export function pickWithHistory(mood: MoodVector, candidates: Painting[], recent: RecentPick[]): Painting[] {
  const last = new Map<number, number>()
  for (const r of recent) {
    const prev = last.get(r.objectID)
    if (prev === undefined || r.daysAgo < prev) last.set(r.objectID, r.daysAgo)
  }
  return [...candidates]
    .map((p, i) => {
      const d = last.get(p.objectID)
      const penalty = d === undefined ? 0 : RECENT_PENALTY * Math.exp(-d / RECENT_HALF_LIFE_DAYS)
      return { p, i, s: similarity(mood, p.mood) - penalty }
    })
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
}
