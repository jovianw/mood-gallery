import type { Answer, Axis, MoodVector, Statement } from '../data/types'
import { AXES, ZERO, answerToScore } from './matching'

/**
 * Bayesian model of the walk.
 *
 * The visitor's mood is an unknown vector theta in R^5. Each statement is a noisy reading of
 * one coordinate: y = theta_k + e with e ~ N(0, NOISE_VAR). With an independent Gaussian prior
 * per axis the posterior stays Gaussian and closes in one line per answer (precision adds,
 * means average). Everything downstream, how sure we are and which door is worth opening, is
 * computed by sampling theta from that posterior.
 */

/** Prior variance per axis: moods sit in [-1, 1], so a standard deviation of about 0.7. */
export const PRIOR_VAR = 0.5
/** Answer noise on the -1..1 scale: one scale step is 1/3, two steps is typical. */
export const NOISE_VAR = 0.35 * 0.35

export interface Posterior {
  mean: MoodVector
  variance: MoodVector
  /** Number of answers folded in per axis. */
  n: Record<Axis, number>
}

export const PRIOR: Posterior = {
  mean: { ...ZERO },
  variance: { energy: PRIOR_VAR, warmth: PRIOR_VAR, outlook: PRIOR_VAR, focus: PRIOR_VAR, social: PRIOR_VAR },
  n: { ...ZERO },
}

/** One conjugate update: a reading y on axis k. */
export function updatePosterior(p: Posterior, axis: Axis, y: number): Posterior {
  const prec = 1 / p.variance[axis] + 1 / NOISE_VAR
  const variance = 1 / prec
  const mean = variance * (p.mean[axis] / p.variance[axis] + y / NOISE_VAR)
  return {
    mean: { ...p.mean, [axis]: mean },
    variance: { ...p.variance, [axis]: variance },
    n: { ...p.n, [axis]: p.n[axis] + 1 },
  }
}

/** Fold every answered statement into the prior. */
export function posteriorFromAnswers(
  statements: Statement[],
  answers: Record<string, Answer | undefined>,
): Posterior {
  let p = PRIOR
  for (const s of statements) {
    const a = answers[s.id]
    if (a !== undefined) p = updatePosterior(p, s.axis, answerToScore(s, a))
  }
  return p
}

/* ---------- Sampling ---------- */

/** Small deterministic PRNG so the same posterior always yields the same numbers (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(next: () => number): number {
  // Box-Muller
  const u = Math.max(next(), 1e-12)
  const v = next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Draw theta ~ posterior, as a flat array in AXES order. */
export function sampleTheta(p: Posterior, next: () => number): number[] {
  return AXES.map((k) => p.mean[k] + Math.sqrt(p.variance[k]) * gaussian(next))
}

/* ---------- Candidates ---------- */

export interface Candidate {
  id: number
  /** Which room the work hangs in. */
  room: string
  /** Unit-normalized mood vector in AXES order. */
  unit: number[]
}

export function toCandidate(id: number, room: string, mood: MoodVector): Candidate {
  const v = AXES.map((k) => mood[k] ?? 0)
  const n = Math.hypot(...v) || 1
  return { id, room, unit: v.map((x) => x / n) }
}

/** Cosine similarity between a sampled theta and a unit candidate vector. */
function cosine(theta: number[], unit: number[]): number {
  let dot = 0
  let nn = 0
  for (let i = 0; i < theta.length; i++) {
    dot += theta[i] * unit[i]
    nn += theta[i] * theta[i]
  }
  return nn === 0 ? 0 : dot / Math.sqrt(nn)
}

function argmax(theta: number[], candidates: Candidate[]): number {
  let best = -1
  let bestS = -Infinity
  for (let i = 0; i < candidates.length; i++) {
    const s = cosine(theta, candidates[i].unit)
    if (s > bestS) {
      bestS = s
      best = i
    }
  }
  return best
}

export interface Belief {
  /** P(candidate i is the best match), indexed like `candidates`. */
  pBest: Float64Array
  /** P(the best match hangs in room r). */
  pRoom: Record<string, number>
  /** Index of the most probable best match. */
  top: number
  /** Entropy (nats) of the best-match distribution. */
  entropy: number
}

/** Monte Carlo over the posterior: how likely is each work, and each room, to be the match. */
export function belief(p: Posterior, candidates: Candidate[], samples = 256, seed = 1): Belief {
  const next = rng(seed)
  const counts = new Float64Array(candidates.length)
  for (let s = 0; s < samples; s++) {
    const i = argmax(sampleTheta(p, next), candidates)
    if (i >= 0) counts[i] += 1
  }
  const pBest = counts.map((c) => c / samples)
  const pRoom: Record<string, number> = {}
  let top = 0
  let entropy = 0
  for (let i = 0; i < candidates.length; i++) {
    const q = pBest[i]
    if (q > pBest[top]) top = i
    if (q > 0) {
      entropy -= q * Math.log(q)
      pRoom[candidates[i].room] = (pRoom[candidates[i].room] ?? 0) + q
    }
  }
  return { pBest, pRoom, top, entropy }
}

/* ---------- Doors: value of a room ---------- */

export interface DoorValue {
  room: string
  /** P(the match hangs in this room). */
  pRoom: number
  /** Expected information gain in nats: entropy now minus expected entropy after its statements. */
  eig: number
  /** Combined score used to rank doors. */
  score: number
}

/** Weight of expected information gain against "the match is probably in there" when ranking doors. */
export const EIG_WEIGHT = 0.6

/**
 * One-step lookahead. For each room: sample a plausible visitor, let them answer the room's
 * statements, update the posterior, measure how peaked the best-match distribution becomes.
 * Averaged, that is the expected entropy after the visit; subtracting it from the current entropy
 * gives the expected information gain of opening that door.
 */
export function doorValues(
  p: Posterior,
  rooms: { id: string; statements: Statement[] }[],
  candidates: Candidate[],
  now: Belief,
  opts: { outer?: number; inner?: number; seed?: number } = {},
): DoorValue[] {
  const outer = opts.outer ?? 24
  const inner = opts.inner ?? 64
  const next = rng(opts.seed ?? 7)
  return rooms
    .map((room) => {
      let expectedEntropy = 0
      for (let s = 0; s < outer; s++) {
        const theta = sampleTheta(p, next)
        let q = p
        for (const st of room.statements) {
          // The visitor answers from their sampled mood, with the usual noise.
          const y = theta[AXES.indexOf(st.axis)] + Math.sqrt(NOISE_VAR) * gaussian(next)
          q = updatePosterior(q, st.axis, Math.max(-1, Math.min(1, y)))
        }
        expectedEntropy += belief(q, candidates, inner, (s + 1) * 7919).entropy
      }
      expectedEntropy /= outer
      const eig = Math.max(0, now.entropy - expectedEntropy)
      const pRoom = now.pRoom[room.id] ?? 0
      return { room: room.id, pRoom, eig, score: pRoom + EIG_WEIGHT * eig }
    })
    .sort((a, b) => b.score - a.score)
}

/* ---------- Stopping rule ---------- */

/** Hall plus at least two more rooms before the walk may end. */
export const MIN_ROOMS = 3
/** The walk may end when the match is this likely to hang in the room you are in ... */
export const ROOM_SURE = 0.5
/** ... and one work in that room is this likely to be the match. */
export const PAINTING_SURE = 0.4
