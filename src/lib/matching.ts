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
  return `${lead}${joiner}${second}. ${painting.why}`
}
