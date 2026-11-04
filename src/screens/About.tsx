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
      <TopAppBar eyebrow="How it works" title="The math of a walk" onLeft={() => nav.back('/')} />
      <div className="gap-16" />
      <p className="t-body t-body--15 t-body--muted">
        Mood Gallery is a Bayesian adaptive test wearing a museum. This page shows the actual model,
        with the numbers it is producing {inWalk ? 'for your walk right now' : 'for a sample set of answers'}.
      </p>

      <h2 className="about__h">1. Your mood is a point in {AXES.length} dimensions</h2>
      <p className="about__p">
        Every statement measures one axis: {AXES.map((k) => AXIS_LABEL[k].toLowerCase()).join(', ')}. An answer{' '}
        <Eq tex="a \in \{1,\dots,7\}" /> on the Agree to Disagree scale becomes a reading
      </p>
      <Eq display tex={String.raw`y = d \cdot \frac{4 - a}{3} \in [-1, 1],`} />
      <p className="about__p">
        where <Eq tex="d = \pm 1" /> says which way the statement points. The hidden quantity is your
        mood vector <Eq tex={String.raw`\theta \in \mathbb{R}^5`} />, and each reading is a noisy look at
        one coordinate of it.
      </p>

      {fs.eigenvalues.length > 0 && (
        <>
          <h2 className="about__h">1b. The axes were found, not chosen</h2>
          <p className="about__p">
            Nobody picked these {fs.k} axes. Claude rated {fs.rated.toLocaleString()} works in the catalog on{' '}
            {fs.adjectives.length} mood adjectives from their images (1 to 7 each). Standardize that matrix,
            take the eigenvalues of its correlation matrix, and keep the factors that rise above what shuffled
            data would produce (parallel analysis, the dashed line). {fs.k} do. A varimax rotation makes each
            factor load on a small set of adjectives, and the strongest adjectives name the axis.
          </p>
          <Scree eig={fs.eigenvalues} noise={fs.noiseLine} />
          <p className="t-caption">
            Red: eigenvalues of the rating correlation matrix. Dashed: 95th percentile of 200 shuffled copies.
            The {fs.k} kept factors explain {Math.round(100 * fs.explained.reduce((a, b) => a + b, 0))}% of the variance.
          </p>
          <Loadings adjectives={fs.adjectives} loadings={fs.loadings} names={AXES.map((k) => AXIS_LABEL[k])} />
          <p className="t-caption">
            Loading of each adjective on each axis (red positive, blue negative). Works that were not rated
            ({fs.fallbackScored}) get scores from a ridge regression on their CLIP embedding, R² per axis{' '}
            {fs.clipRegressionR2.map((r) => r.toFixed(2)).join(', ')}.
          </p>
        </>
      )}

      <h2 className="about__h">2. Answers update a posterior, not an average</h2>
      <p className="about__p">
        Each axis starts with a wide prior and every answer narrows it. With a Gaussian prior and
        Gaussian noise the update is exact:
      </p>
      <Eq
        display
        tex={String.raw`\theta_k \sim \mathcal{N}(0,\sigma_0^2),\qquad y \mid \theta_k \sim \mathcal{N}(\theta_k,\sigma^2)`}
      />
      <Eq
        display
        tex={String.raw`\frac{1}{\sigma_{k}'^{2}} = \frac{1}{\sigma_k^{2}} + \frac{1}{\sigma^{2}},\qquad
        \mu_k' = \sigma_k'^{2}\left(\frac{\mu_k}{\sigma_k^{2}} + \frac{y}{\sigma^{2}}\right)`}
      />
      <p className="about__p">
        Here <Eq tex={String.raw`\sigma_0^2 = ${PRIOR_VAR}`} /> and <Eq tex={String.raw`\sigma^2 = ${NOISE_VAR.toFixed(3)}`} />{' '}
        (about one scale step of noise). The dashed curve is the prior; the red curve is the posterior{' '}
        {inWalk ? 'after your answers so far' : 'after three sample answers in the Great Hall'}.
      </p>
      <Gauss p={post} prior={prior} />

      <h2 className="about__h">3. Which painting? Sample, do not guess</h2>
      <p className="about__p">
        Every work has its own five-dimensional vector <Eq tex="v_i" />. For a given mood the match
        score is the cosine
      </p>
      <Eq display tex={String.raw`s_i(\theta) = \frac{\theta \cdot v_i}{\lVert\theta\rVert\,\lVert v_i\rVert}.`} />
      <p className="about__p">
        Because <Eq tex={String.raw`\theta`} /> is uncertain, so is the winner. We draw{' '}
        <Eq tex="M = 256" /> samples from the posterior and count how often each work comes first:
      </p>
      <Eq
        display
        tex={String.raw`P(i\text{ is the match}) \approx \frac{1}{M}\sum_{m=1}^{M} \mathbf{1}\!\left[i = \arg\max_j s_j(\theta^{(m)})\right].`}
      />
      <Bars rows={top} label="Probability that each work is as good as the best match" />
      <p className="t-caption">Top six of {liveCands.length} works still in play: the probability each is within {NEAR_EPS} of the best (section 4), not its score.</p>

      <h2 className="about__h">4. When the walk stops</h2>
      <p className="about__p">
        With a thousand works, many sit within a hair of each other and the single best is never
        certain. So the walk asks a kinder question: is a work <em>as good as</em> the best? A work
        counts as near-best in a sample when its score is within <Eq tex={String.raw`\varepsilon = ${NEAR_EPS}`} /> of
        the top score. The quantity that decides the walk is the <em>expected regret</em> of the
        work it would pick in this room, averaged over the same samples:
      </p>
      <Eq
        display
        tex={String.raw`R_i = \mathbb{E}_{\theta}\big[\, s_{\max}(\theta) - s_i(\theta) \,\big],\qquad
        \text{stop when } \text{rooms} \ge ${MIN_ROOMS} \text{ and } \min_{i \in \text{room}} R_i \le ${REGRET_OK}.`}
      />
      <p className="about__p">
        Regret is also what the simulation in section 7 measures, so the rule and the yardstick are
        the same thing. <Eq tex="P(\text{room})" />, the chance this room holds a near-best work, is
        shown alongside as the plainer number.
      </p>
      <p className="about__p">
        {inWalk && walk.doorId
          ? `Right now: expected regret ${walk.assessment.regret.toFixed(3)}, P(this room) = ${Math.round(100 * walk.assessment.pRoom)}%, the pick is as good as the best with ${Math.round(100 * walk.assessment.pPaint)}% probability.`
          : 'The thresholds were chosen by simulation (section 7) so a typical walk takes four to five rooms and a clear mood can end in three.'}
      </p>

      <h2 className="about__h">5. Which door? Expected information gain</h2>
      <p className="about__p">
        A door is worth opening if the match is probably behind it, or if the questions in that room
        would tell us the most. Let <Eq tex="H" /> be the entropy of the best-match distribution. For
        each candidate room we imagine a plausible you answering its three statements, update the
        posterior, and measure how much sharper the picture gets:
      </p>
      <Eq
        display
        tex={String.raw`\mathrm{EIG}(r) = H\big[P(i)\big] - \mathbb{E}_{y_r}\Big[H\big[P(i \mid y_r)\big]\Big],\qquad
        \text{score}(r) = P(r) + ${EIG_WEIGHT}\,\mathrm{EIG}(r).`}
      />
      <Bars
        rows={doors.slice(0, 5).map((d) => ({ name: rooms[d.room as keyof typeof rooms].name, value: d.pRoom, second: d.eig / 2 }))}
        label="Door values: probability the match is in the room (red) and information gain (blue)"
      />
      <p className="t-caption">Red: probability the match is in that room. Blue: expected information gain in nats, halved to fit.</p>

      <h2 className="about__h">6. Seeing something new, as a constraint</h2>
      <p className="about__p">
        Inside the final room the pick is a penalized argmax over the posterior mean: the best match,
        minus a push on works this visitor was given recently.
      </p>
      <Eq
        display
        tex={String.raw`i^\star = \arg\max_i \Big[s_i(\mu) - ${RECENT_PENALTY}\,e^{-\Delta t_i / ${RECENT_HALF_LIFE_DAYS}}\Big]`}
      />
      <p className="about__p">
        <Eq tex="\Delta t_i" /> is days since work <Eq tex="i" /> was last shown. A clear winner still
        wins; when the top few are close you see a different one tomorrow.
      </p>

      <h2 className="about__h">7. Does it work? Simulated visitors</h2>
      {hasSim ? (
        <>
          <p className="about__p">
            {stats.walks.toLocaleString()} synthetic visitors walked the museum twice: once with the
            Bayesian policy above and once with a plain rule-of-thumb policy (visit until every axis has
            been asked about and the top two works are far apart). Visitors are not a uniform cloud:{' '}
            {stats.visitors.personas} personas with correlated axes, {stats.visitors.noise}, and they
            take the recommended door {Math.round(100 * stats.visitors.follow)}% of the time.
          </p>
          <table className="about__table">
            <thead>
              <tr>
                <th></th>
                <th>Rule of thumb</th>
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
                <td>Found the true best work</td>
                <td>{Math.round(100 * stats.heuristic.hit)}%</td>
                <td>{Math.round(100 * stats.bayes.hit)}%</td>
              </tr>
              <tr>
                <td>Regret (cosine lost)</td>
                <td>{stats.heuristic.regret.toFixed(3)}</td>
                <td>{stats.bayes.regret.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
          <Histogram a={stats.heuristic.hist as Record<string, number>} b={stats.bayes.hist as Record<string, number>} />
          <p className="t-caption">Rooms per walk, grey rule of thumb, red Bayesian. Regret is the similarity the visitor gave up versus the single best work for their true mood.</p>
        </>
      ) : (
        <p className="about__p">Simulation numbers appear once scripts/simulate.mts has been run.</p>
      )}

      <h2 className="about__h">8. Where the painting vectors come from</h2>
      <p className="about__p">
        Every one of the {es.appPaintings.toLocaleString()} works in the app has a vector <Eq tex="v_i" /> in
        the {AXES.length} discovered axes: its regression factor scores from section 1b, standardized per axis
      </p>
      <Eq
        display
        tex={String.raw`v_{ik} = \mathrm{clip}\!\left(\frac{s_{ik} - \mathrm{med}_k}{q_{90,k}},\,-1,\,1\right),\qquad s_i = z_i\, R^{-1} \Lambda`}
      />
      <p className="about__p">
        where <Eq tex="z_i" /> is the work's standardized row of adjective ratings, <Eq tex="R" /> the adjective
        correlation matrix and <Eq tex={String.raw`\Lambda`} /> the rotated loadings. {CURATED_COUNT} works also carry
        a hand-written sentence about why they fit; their vectors are rated like everything else. A
        vision-language model{es.model ? ` (${es.model})` : ''} still embeds every image: the embedding
        predicts the factor scores well enough (section 1b) to place any future work the rater has not seen, and
        it draws the map below.
      </p>
      <Scatter points={es.scatter} />
      {es.scatter.length > 0 && (
        <p className="t-caption">
          Every work in the app, projected onto the first two principal components of CLIP space ({Math.round(100 * (es.pcaExplained[0] + es.pcaExplained[1]))}% of
          variance). Blue sits on floor 2, grey on floor 1.
        </p>
      )}
      <Heatmap m={es.axisCorrelation} />
      {es.axisCorrelation.length > 0 && <p className="t-caption">Correlation between the axis scores across the catalog (after rotation the factors are nearly orthogonal on the rated works; CLIP-scored works add a little).</p>}

      <h2 className="about__h">9. Routes follow the galleries</h2>
      <p className="about__p">
        The floor plan is rasterized into {CELL} m cells (floor 1: {g1.walkable.toLocaleString()} walkable of{' '}
        {g1.cells.toLocaleString()}; floor 2: {g2.walkable.toLocaleString()} of {g2.cells.toLocaleString()}). A route is A* on that grid with the octile
        heuristic, then string-pulled so it only bends at walls:
      </p>
      <Eq display tex={String.raw`h(n) = \max(|\Delta x|, |\Delta y|) + (\sqrt{2} - 1)\min(|\Delta x|, |\Delta y|)`} />
      <RouteFigure />
      <p className="t-caption">Great Hall to The American Wing on floor 1, {legBetween(1, blocks.hall.center, blocks.amer1.center).meters.toFixed(0)} m. Minutes on the map are the whole walk at 80 m per minute, plus a staircase per floor change.</p>

      <div className="gap-16" />
    </Screen>
  )
}
