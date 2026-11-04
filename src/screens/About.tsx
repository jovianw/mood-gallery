import { useMemo } from 'react'
import { Math as Eq } from '../components/Math'
import { Button, Screen, TopAppBar } from '../components/ui'
import { paintings } from '../data/paintings'
import { rooms, START_ROOM } from '../data/rooms'
import embeddingStats from '../data/embedding-stats.json'
import factorStats from '../data/factor-stats.json'
import stats from '../data/stats.json'
import type { RoomId } from '../data/types'
import {
  belief,
  doorValues,
  EIG_WEIGHT,
  MIN_ROOMS,
  NEAR_EPS,
  NOISE_VAR,
  posteriorFromAnswers,
  PRIOR_VAR,
  REGRET_OK,
  toCandidate,
  type Posterior,
} from '../lib/bayes'
import { blocks, blocksOnFloor, OUTLINE } from '../lib/floorplan'
import { AXES, AXIS_LABEL, RECENT_HALF_LIFE_DAYS, RECENT_PENALTY } from '../lib/matching'
import { useNav } from '../lib/nav'
import { CELL, gridStats, legBetween } from '../lib/routing'
import { useWalk } from '../state/WalkContext'

const W = 342
const CANDIDATES = paintings.map((p) => toCandidate(p.objectID, p.room, p.mood))
const TITLE = new Map(paintings.map((p) => [p.objectID, p.title]))
const CURATED_COUNT = paintings.filter((p) => p.why).length

/* ---------- Small charts (inline SVG, palette colors only) ---------- */

function Gauss({ p, prior }: { p: Posterior; prior: Posterior }) {
  const h = 54
  const rowW = W
  const xs = Array.from({ length: 81 }, (_, i) => -1.3 + (2.6 * i) / 80)
  // Curves share one vertical scale (the sharpest posterior reaches the top of its row).
  const sharpest = Math.min(...AXES.map((k) => p.variance[k]))
  const peak = 1 / Math.sqrt(2 * Math.PI * sharpest)
  const curve = (mean: number, v: number) =>
    xs
      .map((x, i) => {
        const y = Math.exp(-((x - mean) ** 2) / (2 * v)) / Math.sqrt(2 * Math.PI * v)
        return `${i ? 'L' : 'M'}${(((x + 1.3) / 2.6) * rowW).toFixed(1)},${(h - 14 - (y / peak) * (h - 22)).toFixed(1)}`
      })
      .join(' ')
  return (
    <svg viewBox={`0 0 ${rowW} ${AXES.length * h}`} width="100%" className="chart" aria-label="Posterior over each mood axis">
      {AXES.map((k, i) => (
        <g key={k} transform={`translate(0 ${i * h})`}>
          <line x1={rowW / 2} x2={rowW / 2} y1={4} y2={h - 14} stroke="var(--stone)" />
          <line x1={0} x2={rowW} y1={h - 14} y2={h - 14} stroke="var(--stone)" />
          <path d={curve(prior.mean[k], prior.variance[k])} fill="none" stroke="var(--mute-gray)" strokeDasharray="3 3" />
          <path d={curve(p.mean[k], p.variance[k])} fill="none" stroke="var(--accent)" strokeWidth="2" />
          <text x={2} y={h - 3} fontSize="10" fontWeight="600" fill="var(--ink)">
            {AXIS_LABEL[k]}
          </text>
          <text x={rowW - 2} y={h - 3} fontSize="10" textAnchor="end" fill="var(--mute-gray)">
            mean {p.mean[k].toFixed(2)} · sd {Math.sqrt(p.variance[k]).toFixed(2)} · {p.n[k]} {p.n[k] === 1 ? 'answer' : 'answers'}
          </text>
        </g>
      ))}
    </svg>
  )
}

function Bars({
  rows,
  max = 1,
  unit = '%',
  label,
}: {
  rows: { name: string; value: number; second?: number }[]
  max?: number
  unit?: string
  label: string
}) {
  const rowH = 26
  return (
    <svg viewBox={`0 0 ${W} ${rows.length * rowH}`} width="100%" className="chart" aria-label={label}>
      {rows.map((r, i) => {
        const w = Math.max(0, Math.min(1, r.value / max)) * (W - 130)
        const w2 = r.second === undefined ? 0 : Math.max(0, Math.min(1, r.second / max)) * (W - 130)
        return (
          <g key={r.name} transform={`translate(0 ${i * rowH})`}>
            <text x={0} y={16} fontSize="11" fill="var(--ink)">
              {r.name.length > 20 ? `${r.name.slice(0, 19)}…` : r.name}
            </text>
            <rect x={126} y={6} width={W - 130} height={12} fill="var(--stone)" rx="2" />
            <rect x={126} y={6} width={w} height={12} fill="var(--accent)" rx="2" />
            {r.second !== undefined && <rect x={126} y={14} width={w2} height={4} fill="var(--slate-blue)" rx="1" />}
            <text x={W} y={16} fontSize="11" textAnchor="end" fill="var(--mute-gray)">
              {unit === '%' ? `${Math.round(100 * r.value)}%` : `${r.value.toFixed(2)}${unit}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Histogram({ a, b }: { a: Record<string, number>; b: Record<string, number> }) {
  const keys = ['3', '4', '5', '6', '7', '8']
  const na = Object.values(a).reduce((s, v) => s + v, 0) || 1
  const nb = Object.values(b).reduce((s, v) => s + v, 0) || 1
  const h = 120
  const bw = (W - 20) / keys.length
  return (
    <svg viewBox={`0 0 ${W} ${h + 18}`} width="100%" className="chart" aria-label="Walk length distribution">
      {keys.map((k, i) => {
        const va = (a[k] ?? 0) / na
        const vb = (b[k] ?? 0) / nb
        const x = 10 + i * bw
        return (
          <g key={k}>
            <rect x={x + 4} y={h - va * h * 2} width={bw / 2 - 6} height={va * h * 2} fill="var(--mute-gray)" />
            <rect x={x + bw / 2} y={h - vb * h * 2} width={bw / 2 - 6} height={vb * h * 2} fill="var(--accent)" />
            <text x={x + bw / 2} y={h + 14} fontSize="11" textAnchor="middle" fill="var(--ink)">
              {k}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Scatter({ points }: { points: [number, number, string][] }) {
  if (!points.length) return <p className="t-caption">Scatter appears once the embedding run has been done.</p>
  const size = W
  const color = (room: string) => (rooms[room as keyof typeof rooms]?.floor === 2 ? 'var(--slate-blue)' : 'var(--mute-gray)')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" className="chart" aria-label="Paintings in CLIP space, first two principal components">
      <rect x={0} y={0} width={size} height={size} fill="#fff" rx="12" />
      {points.map(([x, y, room], i) => (
        <circle key={i} cx={size / 2 + (x * size) / 2.2} cy={size / 2 - (y * size) / 2.2} r="2.4" fill={color(room)} opacity="0.75" />
      ))}
    </svg>
  )
}

function Heatmap({ m }: { m: number[][] }) {
  if (!m.length) return null
  const cell = 46
  return (
    <svg viewBox={`0 0 ${W} ${cell * 5 + 20}`} width="100%" className="chart" aria-label="Correlation between the five axes across the catalog">
      {m.map((row, i) =>
        row.map((v, j) => (
          <g key={`${i}-${j}`}>
            <rect
              x={60 + j * cell}
              y={i * cell}
              width={cell - 2}
              height={cell - 2}
              fill={v >= 0 ? 'var(--accent)' : 'var(--slate-blue)'}
              opacity={i === j ? 0.15 : Math.min(1, Math.abs(v)) * 0.9 + 0.05}
              rx="3"
            />
            <text x={60 + j * cell + (cell - 2) / 2} y={i * cell + cell / 2 + 3} fontSize="10" textAnchor="middle" fill="var(--ink)">
              {v.toFixed(2)}
            </text>
          </g>
        )),
      )}
      {AXES.map((k, i) => (
        <text key={k} x={56} y={i * cell + cell / 2 + 3} fontSize="10" textAnchor="end" fill="var(--ink)">
          {AXIS_LABEL[k]}
        </text>
      ))}
    </svg>
  )
}

function RouteFigure() {
  const leg = useMemo(() => legBetween(1, blocks.hall.center, blocks.amer1.center), [])
  const xs = OUTLINE.map((p) => p[0])
  const ys = OUTLINE.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const s = W / (maxX - minX)
  const h = (maxY - minY) * s
  const pt = ([x, y]: [number, number]) => `${((x - minX) * s).toFixed(1)},${((maxY - y) * s).toFixed(1)}`
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" className="chart" aria-label="Floor 1 blocks with a routed path from the Great Hall to The American Wing">
      <polygon points={OUTLINE.map(pt).join(' ')} fill="none" stroke="var(--stone)" />
      {blocksOnFloor(1).map((b) => (
        <polygon key={b.key} points={b.poly.map(pt).join(' ')} fill="var(--stone)" opacity={b.dim ? 0.35 : 0.7} stroke="#fff" strokeWidth="0.8" />
      ))}
      <polyline points={leg.points.map(pt).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle {...(() => { const [x, y] = pt(blocks.hall.center).split(',').map(Number); return { cx: x, cy: y } })()} r="4" fill="var(--ink)" />
      <circle {...(() => { const [x, y] = pt(blocks.amer1.center).split(',').map(Number); return { cx: x, cy: y } })()} r="4" fill="var(--accent)" />
    </svg>
  )
}

function Scree({ eig, noise }: { eig: number[]; noise: number[] }) {
  const n = Math.min(12, eig.length)
  if (!n) return null
  const h = 120
  const max = Math.max(...eig.slice(0, n), ...noise.slice(0, n)) * 1.1
  const x = (i: number) => 24 + (i * (W - 34)) / (n - 1)
  const y = (v: number) => h - 14 - (v / max) * (h - 24)
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" className="chart" aria-label="Scree plot with the parallel analysis noise line">
      <line x1={24} x2={W - 6} y1={h - 14} y2={h - 14} stroke="var(--stone)" />
      <polyline points={noise.slice(0, n).map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--mute-gray)" strokeDasharray="4 3" strokeWidth="1.5" />
      <polyline points={eig.slice(0, n).map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {eig.slice(0, n).map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={v > (noise[i] ?? 0) ? 'var(--accent)' : 'var(--stone)'} />
      ))}
      {eig.slice(0, n).map((_, i) => (
        <text key={`l${i}`} x={x(i)} y={h - 2} fontSize="9" textAnchor="middle" fill="var(--mute-gray)">
          {i + 1}
        </text>
      ))}
    </svg>
  )
}

function Loadings({ adjectives, loadings, names }: { adjectives: string[]; loadings: number[][]; names: string[] }) {
  if (!loadings.length) return null
  const k = names.length
  const cell = Math.min(40, (W - 70) / k)
  const rowH = 13
  // Order adjectives by the factor they load on most, then by strength.
  const order = adjectives
    .map((a, i) => {
      const abs = loadings[i].map(Math.abs)
      const m = Math.max(...abs)
      return { a, i, f: abs.indexOf(m), m }
    })
    .sort((p, q) => p.f - q.f || q.m - p.m)
  return (
    <svg viewBox={`0 0 ${W} ${order.length * rowH + 16}`} width="100%" className="chart" aria-label="Factor loadings of every adjective">
      {names.map((nm, j) => (
        <text key={nm} x={70 + j * cell + cell / 2} y={10} fontSize="9" textAnchor="middle" fill="var(--ink)" fontWeight="600">
          {nm.length > 7 ? `${nm.slice(0, 6)}.` : nm}
        </text>
      ))}
      {order.map((row, r) => (
        <g key={row.a} transform={`translate(0 ${16 + r * rowH})`}>
          <text x={66} y={10} fontSize="9" textAnchor="end" fill="var(--ink)">
            {row.a}
          </text>
          {loadings[row.i].map((v, j) => (
            <rect key={j} x={70 + j * cell + 1} y={1} width={cell - 2} height={rowH - 2} rx="2" fill={v >= 0 ? 'var(--accent)' : 'var(--slate-blue)'} opacity={Math.min(1, Math.abs(v)) * 0.95 + 0.04} />
          ))}
        </g>
      ))}
    </svg>
  )
}

/* ---------- The page ---------- */

const DEMO_ANSWERS = { 'gh-1': 2, 'gh-2': 2, 'gh-3': 6 } as const

export function About() {
  const nav = useNav()
  const walk = useWalk()
  const inWalk = Object.keys(walk.answers).length > 0
  const prior = posteriorFromAnswers([], {})
  const post = inWalk ? walk.posterior : posteriorFromAnswers(rooms[START_ROOM].statements, DEMO_ANSWERS)
  const liveRooms = useMemo(
    () => Object.values(rooms).filter((r) => r.id !== START_ROOM && (!inWalk || !walk.path.includes(r.id as RoomId) || r.id === walk.doorId)),
    [inWalk, walk.path, walk.doorId],
  )
  const liveCands = useMemo(() => {
    const ids = new Set<string>(liveRooms.map((r) => r.id))
    return CANDIDATES.filter((c) => ids.has(c.room))
  }, [liveRooms])
  const b = useMemo(() => belief(post, liveCands, 256, 3), [post, liveCands])
  const top = useMemo(
    () =>
      Array.from(b.pNear)
        .map((p, i) => ({ name: TITLE.get(liveCands[i].id) ?? '', value: p }))
        .sort((x, y) => y.value - x.value)
        .slice(0, 6),
    [b, liveCands],
  )
  const doors = useMemo(
    () => doorValues(post, liveRooms.filter((r) => r.id !== walk.doorId), liveCands, b, { seed: 3 }),
    [post, liveRooms, liveCands, b, walk.doorId],
  )
  const g1 = gridStats(1)
  const g2 = gridStats(2)
  const es = embeddingStats as unknown as {
    model: string
    catalogImages: number
    appPaintings: number
    curated: number
    fromClip: number
    axisCorrelation: number[][]
    pcaExplained: number[]
    scatter: [number, number, string][]
  }
  const hasSim = stats.walks > 0
  const fs = factorStats as {
    rated: number
    adjectives: string[]
    k: number
    eigenvalues: number[]
    noiseLine: number[]
    explained: number[]
    loadings: number[][]
    clipRegressionR2: number[]
    fallbackScored: number
  }

  return (
    <Screen
      className="about"
      footer={
        <Button onClick={() => nav.forward('/')} arrow>
          Take a walk
        </Button>
      }
    >
      <TopAppBar eyebrow="Method" title="A Bayesian adaptive walk" onLeft={() => nav.back('/')} />
      <div className="gap-16" />
      <p className="about__abstract">
        <b>Abstract.</b> We frame the selection of an artwork for a visitor as sequential Bayesian
        inference over a latent mood vector. Mood axes are not specified a priori but recovered by
        factor analysis of language-model ratings of the collection on a vocabulary of mood adjectives.
        Visitor responses on a seven-point scale are treated as noisy observations of single coordinates;
        a conjugate Gaussian posterior is maintained, and Monte Carlo sampling from it yields the
        probability that each work is the best match. Rooms are selected by a one-step expected
        information gain criterion, and the walk terminates when the expected regret of the best
        available work falls below a threshold. All quantities below are computed from the model as
        deployed{inWalk ? ', for the walk currently in progress' : ', for a fixed set of sample responses'}.
      </p>

      <h2 className="about__h">1. Problem setting</h2>
      <p className="about__p">
        Let <Eq tex={String.raw`\theta \in \mathbb{R}^{k}`} /> denote a visitor's latent mood, with{' '}
        <Eq tex={`k = ${AXES.length}`} /> coordinates ({AXES.map((k) => AXIS_LABEL[k].toLowerCase()).join(', ')}).
        Each statement presented to the visitor is associated with one coordinate <Eq tex="k" /> and a
        direction <Eq tex="d \in \{-1, +1\}" />. A response <Eq tex="a \in \{1,\dots,7\}" /> on the
        Agree to Disagree scale is mapped to an observation
      </p>
      <Eq display tex={String.raw`y = d \cdot \frac{4 - a}{3} \in [-1, 1].`} />
      <p className="about__p">
        Each work <Eq tex="i" /> in the collection is represented by a vector{' '}
        <Eq tex={String.raw`v_i \in [-1,1]^{k}`} /> in the same space (Section 9). The task is to select a
        work that is close to <Eq tex={String.raw`\theta`} /> while asking as few questions as the required
        confidence permits.
      </p>

      {fs.eigenvalues.length > 0 && (
        <>
          <h2 className="about__h">2. Axis discovery</h2>
          <p className="about__p">
            The axes were obtained empirically rather than specified. A vision-language model rated{' '}
            {fs.rated.toLocaleString()} works in the catalog on {fs.adjectives.length} mood adjectives
            from the image, each on an integer scale from 1 to 7, producing a rating matrix{' '}
            <Eq tex={String.raw`X \in \mathbb{R}^{n \times p}`} />. Columns were standardized and the
            eigenvalues of the resulting correlation matrix <Eq tex="R" /> were compared with the 95th
            percentile of eigenvalues from 200 column-permuted copies of the data (parallel analysis
            [1]). The number of factors retained, <Eq tex="k" />, is the count of eigenvalues exceeding
            this noise line; here <Eq tex={`k = ${fs.k}`} />. Loadings were extracted by principal axes
            and rotated by the varimax criterion [2] to obtain a simple structure; each axis is named
            from the adjectives with the largest absolute loadings.
          </p>
          <Scree eig={fs.eigenvalues} noise={fs.noiseLine} />
          <p className="t-caption">
            Figure 1. Scree plot. Solid: eigenvalues of <Eq tex="R" />. Dashed: parallel-analysis noise
            line. The {fs.k} retained factors account for{' '}
            {Math.round(100 * fs.explained.reduce((a, b) => a + b, 0))}% of total variance.
          </p>
          <Loadings adjectives={fs.adjectives} loadings={fs.loadings} names={AXES.map((k) => AXIS_LABEL[k])} />
          <p className="t-caption">
            Figure 2. Rotated loading matrix <Eq tex={String.raw`\Lambda \in \mathbb{R}^{p \times k}`} />,
            adjectives grouped by dominant factor (red positive, blue negative). Works without a rating
            ({fs.fallbackScored}) receive scores from a ridge regression on their image embedding;
            out-of-sample <Eq tex="R^2" /> per axis {fs.clipRegressionR2.map((r) => r.toFixed(2)).join(', ')}.
          </p>
        </>
      )}

      <h2 className="about__h">3. Observation model and posterior</h2>
      <p className="about__p">
        Coordinates are modelled independently with a Gaussian prior and Gaussian observation noise,
      </p>
      <Eq
        display
        tex={String.raw`\theta_k \sim \mathcal{N}(0,\sigma_0^2),\qquad y \mid \theta_k \sim \mathcal{N}(\theta_k,\sigma^2),`}
      />
      <p className="about__p">
        so that the posterior after each observation remains Gaussian and is obtained in closed form by
        precision addition:
      </p>
      <Eq
        display
        tex={String.raw`\frac{1}{\sigma_{k}'^{2}} = \frac{1}{\sigma_k^{2}} + \frac{1}{\sigma^{2}},\qquad
        \mu_k' = \sigma_k'^{2}\left(\frac{\mu_k}{\sigma_k^{2}} + \frac{y}{\sigma^{2}}\right).`}
      />
      <p className="about__p">
        We set <Eq tex={String.raw`\sigma_0^2 = ${PRIOR_VAR}`} /> and{' '}
        <Eq tex={String.raw`\sigma^2 = ${NOISE_VAR.toFixed(3)}`} />, the latter corresponding to a
        standard deviation of approximately one scale step. Figure 3 shows the prior (dashed) and the
        current posterior (solid) for each coordinate{inWalk ? '' : ', given three sample responses in the Great Hall'}.
      </p>
      <Gauss p={post} prior={prior} />
      <p className="t-caption">Figure 3. Marginal prior and posterior densities per axis, with posterior mean, standard deviation and observation count.</p>

      <h2 className="about__h">4. Matching under uncertainty</h2>
      <p className="about__p">
        The affinity between a mood and a work is the cosine similarity
      </p>
      <Eq display tex={String.raw`s_i(\theta) = \frac{\theta \cdot v_i}{\lVert\theta\rVert\,\lVert v_i\rVert}.`} />
      <p className="about__p">
        Because <Eq tex={String.raw`\theta`} /> is uncertain, the identity of the best work is a random
        variable. Its distribution is estimated by Monte Carlo with <Eq tex="M = 256" /> posterior
        samples <Eq tex={String.raw`\theta^{(m)}`} />:
      </p>
      <Eq
        display
        tex={String.raw`\hat P(i^\star = i) = \frac{1}{M}\sum_{m=1}^{M} \mathbf{1}\!\left[i = \arg\max_j s_j(\theta^{(m)})\right].`}
      />
      <p className="about__p">
        With a collection of this size many works are nearly equivalent, so we also estimate the
        probability that a work is within <Eq tex={String.raw`\varepsilon = ${NEAR_EPS}`} /> of the best
        in a given sample, <Eq tex={String.raw`\hat P\big(s_i \ge s_{\max} - \varepsilon\big)`} />,
        which is the quantity plotted in Figure 4.
      </p>
      <Bars rows={top} label="Probability that each work is within epsilon of the best match" />
      <p className="t-caption">Figure 4. The six works with the highest near-best probability among {liveCands.length} candidates currently reachable.</p>

      <h2 className="about__h">5. Stopping rule</h2>
      <p className="about__p">
        Let <Eq tex={String.raw`R_i = \mathbb{E}_{\theta}\big[\, s_{\max}(\theta) - s_i(\theta) \,\big]`} /> denote
        the expected regret of selecting work <Eq tex="i" />, estimated over the same posterior
        samples. The walk terminates in the current room when
      </p>
      <Eq
        display
        tex={String.raw`|\text{rooms visited}| \ge ${MIN_ROOMS} \quad\text{and}\quad \min_{i \in \text{room}} R_i \le \delta,\qquad \delta = ${REGRET_OK},`}
      />
      <p className="about__p">
        and otherwise proceeds to door selection (Section 6). Expected regret is used in preference to a
        threshold on <Eq tex={String.raw`\hat P(i^\star = i)`} /> because the latter is sensitive to the
        number of near-duplicate works, whereas regret is not; it is also the quantity measured in the
        evaluation of Section 8, so the decision rule and the evaluation metric coincide. The threshold{' '}
        <Eq tex={String.raw`\delta`} /> was selected by simulation.
        {inWalk && walk.doorId
          ? ` Current state: minimum expected regret ${walk.assessment.regret.toFixed(3)}; probability that this room contains a near-best work ${Math.round(100 * walk.assessment.pRoom)}%; near-best probability of the selected work ${Math.round(100 * walk.assessment.pPaint)}%.`
          : ''}
      </p>

      <h2 className="about__h">6. Door selection by expected information gain</h2>
      <p className="about__p">
        Let <Eq tex="H[\cdot]" /> denote Shannon entropy and <Eq tex="P(r)" /> the posterior probability
        that the best work hangs in room <Eq tex="r" />. For each unvisited room we estimate the
        expected reduction in entropy of the best-work distribution that would follow from answering
        that room's statements, by sampling a hypothetical visitor from the posterior, generating
        responses under the observation model, and recomputing the posterior [3]:
      </p>
      <Eq
        display
        tex={String.raw`\mathrm{EIG}(r) = H\big[\hat P(i^\star)\big] - \mathbb{E}_{y_r}\Big[H\big[\hat P(i^\star \mid y_r)\big]\Big],\qquad
        \text{score}(r) = P(r) + \lambda\,\mathrm{EIG}(r),\quad \lambda = ${EIG_WEIGHT}.`}
      />
      <p className="about__p">
        Rooms are offered in descending order of score; the first is marked as recommended. The outer
        expectation uses 24 hypothetical visitors and the inner entropy 64 samples each, over a candidate
        set restricted to works with non-zero posterior mass plus the 200 nearest to the posterior mean.
      </p>
      <Bars
        rows={doors.slice(0, 5).map((d) => ({ name: rooms[d.room as keyof typeof rooms].name, value: d.pRoom, second: d.eig / 2 }))}
        label="Door values: probability the match is in the room and expected information gain"
      />
      <p className="t-caption">Figure 5. Candidate rooms. Red: <Eq tex="P(r)" />. Blue: <Eq tex={String.raw`\mathrm{EIG}(r)`} /> in nats, scaled by one half.</p>

      <h2 className="about__h">7. Diversity across visits</h2>
      <p className="about__p">
        Within the terminal room the selected work maximizes similarity to the posterior mean{' '}
        <Eq tex={String.raw`\mu`} /> subject to a penalty on works shown to the same visitor recently,
      </p>
      <Eq
        display
        tex={String.raw`i^\star = \arg\max_i \Big[s_i(\mu) - \beta\,e^{-\Delta t_i / \tau}\Big],\qquad \beta = ${RECENT_PENALTY},\ \tau = ${RECENT_HALF_LIFE_DAYS}\text{ days},`}
      />
      <p className="about__p">
        where <Eq tex="\Delta t_i" /> is the elapsed time since work <Eq tex="i" /> was last selected
        for this visitor. The penalty is small relative to typical similarity gaps, so a clearly superior
        work is retained while near-ties rotate.
      </p>

      <h2 className="about__h">8. Evaluation</h2>
      {hasSim ? (
        <>
          <p className="about__p">
            In the absence of visitor data the policy was evaluated against synthetic visitors. Each
            visitor's true mood <Eq tex={String.raw`\theta`} /> was drawn around one of{' '}
            {stats.visitors.personas} persona centres taken from mutually distant works in the
            collection, with isotropic spread. Response noise: {stats.visitors.noise}. Visitors take
            the recommended door with probability {stats.visitors.follow}. Each of{' '}
            {stats.walks.toLocaleString()} visitors walked under two policies: the Bayesian policy
            above and a heuristic baseline (continue until every axis has been observed and the two
            highest-scoring works in the current room are separated by a fixed margin). Outcome measures
            are rooms visited, the proportion of walks ending at a work within <Eq tex={String.raw`\varepsilon`} />{' '}
            of the visitor's true optimum, and realized regret.
          </p>
          <table className="about__table">
            <thead>
              <tr>
                <th></th>
                <th>Heuristic</th>
                <th>Bayesian</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rooms per walk</td>
                <td>{stats.heuristic.mean.toFixed(2)}</td>
                <td>{stats.bayes.mean.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Near-best terminal work</td>
                <td>{Math.round(100 * stats.heuristic.hit)}%</td>
                <td>{Math.round(100 * stats.bayes.hit)}%</td>
              </tr>
              <tr>
                <td>Realized regret (cosine)</td>
                <td>{stats.heuristic.regret.toFixed(3)}</td>
                <td>{stats.bayes.regret.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <p className="t-caption">Table 1. Policy comparison over {stats.walks.toLocaleString()} simulated visitors.</p>
          <Histogram a={stats.heuristic.hist as Record<string, number>} b={stats.bayes.hist as Record<string, number>} />
          <p className="t-caption">Figure 6. Distribution of walk length in rooms. Grey: heuristic. Red: Bayesian.</p>
          <p className="about__p">
            Realized regret exceeds the stopping threshold <Eq tex={String.raw`\delta`} /> by a wide
            margin, indicating that the observation model is optimistic about response noise for this
            visitor population. The simulated population is a model of visitors, not a sample of them;
            calibration against recorded walks remains future work.
          </p>
        </>
      ) : (
        <p className="about__p">Simulation results are populated by scripts/simulate.mts.</p>
      )}

      <h2 className="about__h">9. Data</h2>
      <p className="about__p">
        The collection comprises {es.appPaintings.toLocaleString()} works on view at The Metropolitan
        Museum of Art, drawn from the Open Access collection API. Each work's vector is its regression
        factor score from Section 2, standardized per axis by the catalog median and the 90th percentile
        of absolute deviation,
      </p>
      <Eq
        display
        tex={String.raw`s_i = z_i\, R^{-1} \Lambda,\qquad v_{ik} = \mathrm{clip}\!\left(\frac{s_{ik} - \mathrm{med}_k}{q_{90,k}},\,-1,\,1\right),`}
      />
      <p className="about__p">
        where <Eq tex="z_i" /> is the standardized row of adjective ratings. {CURATED_COUNT} works additionally
        carry an editorial sentence; their vectors are obtained identically. Image embeddings from a
        contrastive vision-language model{es.model ? ` (${es.model})` : ''} [4] serve two purposes: a
        ridge-regression fallback for works the rater has not scored, and the two-dimensional projection
        in Figure 7.
      </p>
      <Scatter points={es.scatter} />
      {es.scatter.length > 0 && (
        <p className="t-caption">
          Figure 7. Works projected onto the first two principal components of the image-embedding space
          ({Math.round(100 * (es.pcaExplained[0] + es.pcaExplained[1]))}% of variance). Blue: second floor. Grey: first floor.
        </p>
      )}
      <Heatmap m={es.axisCorrelation} />
      {es.axisCorrelation.length > 0 && <p className="t-caption">Figure 8. Pearson correlation between axis scores across the collection. The rotated factors are orthogonal on the rated set by construction; residual correlation arises from standardization and clipping.</p>}

      <h2 className="about__h">10. Routing</h2>
      <p className="about__p">
        The traced floor plan is rasterized into {CELL} m cells (floor 1: {g1.walkable.toLocaleString()} walkable of{' '}
        {g1.cells.toLocaleString()}; floor 2: {g2.walkable.toLocaleString()} of {g2.cells.toLocaleString()}). Routes between
        rooms are shortest paths on the 8-connected grid computed by A* [5] with the octile heuristic
      </p>
      <Eq display tex={String.raw`h(n) = \max(|\Delta x|, |\Delta y|) + (\sqrt{2} - 1)\min(|\Delta x|, |\Delta y|),`} />
      <p className="about__p">
        followed by line-of-sight simplification. Walk duration is total path length at 80 m per minute
        plus a fixed allowance per change of floor.
      </p>
      <RouteFigure />
      <p className="t-caption">Figure 9. Great Hall to The American Wing, floor 1, {legBetween(1, blocks.hall.center, blocks.amer1.center).meters.toFixed(0)} m.</p>

      <h2 className="about__h">References</h2>
      <ol className="about__refs">
        <li>Horn, J. L. (1965). A rationale and test for the number of factors in factor analysis. <i>Psychometrika</i>, 30(2), 179–185.</li>
        <li>Kaiser, H. F. (1958). The varimax criterion for analytic rotation in factor analysis. <i>Psychometrika</i>, 23(3), 187–200.</li>
        <li>Lindley, D. V. (1956). On a measure of the information provided by an experiment. <i>Annals of Mathematical Statistics</i>, 27(4), 986–1005.</li>
        <li>Radford, A. et al. (2021). Learning transferable visual models from natural language supervision. <i>ICML</i>.</li>
        <li>Hart, P. E., Nilsson, N. J. and Raphael, B. (1968). A formal basis for the heuristic determination of minimum cost paths. <i>IEEE Transactions on Systems Science and Cybernetics</i>, 4(2), 100–107.</li>
      </ol>

    </Screen>
  )
}
