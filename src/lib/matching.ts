import type { Answer, Axis, Door, MoodVector, Painting, Statement } from '../data/types'

export const AXES: Axis[] = ['energy', 'warmth', 'outlook', 'focus']

export const ZERO: MoodVector = { energy: 0, warmth: 0, outlook: 0, focus: 0 }

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
  return AXES.reduce((acc, k) => acc + a[k] * b[k], 0)
}

function norm(a: MoodVector): number {
  return Math.sqrt(dot(a, a))
}

export function similarity(a: MoodVector, b: MoodVector): number {
  const n = norm(a) * norm(b)
  return n === 0 ? 0 : dot(a, b) / n
}

export function recommendDoor(mood: MoodVector, doors: Door[]): Door {
  return doors.reduce((best, d) =>
    similarity(mood, d.affinity) > similarity(mood, best.affinity) ? d : best,
  )
}

export function matchPainting(mood: MoodVector, candidates: Painting[]): Painting | undefined {
  if (candidates.length === 0) return undefined
  return candidates.reduce((best, p) =>
    similarity(mood, p.mood) > similarity(mood, best.mood) ? p : best,
  )
}

const WORDS: Record<Axis, [positive: string, negative: string, neutral: string]> = {
  energy: ['Restless', 'Calm', 'Steady'],
  warmth: ['Warm', 'Cool', 'Even'],
  outlook: ['Hopeful', 'Heavy', 'Watchful'],
  focus: ['Inward', 'Outward', 'Present'],
}

/** Three mood words, strongest axes first, e.g. ["Restless", "Warm", "Hopeful"]. */
export function moodWords(mood: MoodVector, n = 3): string[] {
  return [...AXES]
    .sort((a, b) => Math.abs(mood[b]) - Math.abs(mood[a]))
    .slice(0, n)
    .map((axis) => {
      const v = mood[axis]
      const [pos, neg, neutral] = WORDS[axis]
      return v > 0.25 ? pos : v < -0.25 ? neg : neutral
    })
}

/** "Restless, warm, and hopeful." */
export function moodSentence(mood: MoodVector): string {
  const [a, b, c] = moodWords(mood).map((w, i) => (i === 0 ? w : w.toLowerCase()))
  return `${a}, ${b}, and ${c}.`
}

/** Short phrase describing how a single room's answers came out. */
export function roomPhrase(mood: MoodVector): string {
  const [first, second] = moodWords(mood, 2)
  return `${first}, ${second.toLowerCase()}`
}
