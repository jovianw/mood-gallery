// Rates every work in the catalog on the mood adjectives with Claude, through the `claude` CLI
// in print mode (the way C:\dev\nestor does it): no API key, runs on the subscription, the
// model can only Read the one image copied into an otherwise empty work folder, and the answer
// is schema-validated structured output.
//
// Usage: node scripts/rate.mjs [--workers 6] [--sample 25] [--model claude-sonnet-5-5] [--timeout 300]
// Output: data/catalog/ratings.jsonl (one line per work, resumable), ratings-skipped.json.
import { spawn } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const CATALOG = join(here, '..', 'data', 'catalog')
const IMG = join(CATALOG, 'img')
const WORK = join(CATALOG, 'claude-work')
const OUT = join(CATALOG, 'ratings.jsonl')
const SKIPPED = join(CATALOG, 'ratings-skipped.json')

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : def
}
const WORKERS = Number(arg('--workers', 6))
const SAMPLE = Number(arg('--sample', 0))
const MODEL = arg('--model', 'claude-sonnet-5-5')
const TIMEOUT_MS = Number(arg('--timeout', 420)) * 1000
// Works per call: the CLI's fixed prompt overhead dominates a single-image call, so several
// images share one call. Each gets its own file name and its own block in the output schema.
const BATCH = Number(arg('--batch', 5))
const CLAUDE = existsSync(join(homedir(), '.local', 'bin', 'claude.exe'))
  ? join(homedir(), '.local', 'bin', 'claude.exe')
  : 'claude'

const ADJECTIVES = JSON.parse(readFileSync(join(here, 'llm', 'adjectives.json'), 'utf8'))
const SCHEMA = JSON.parse(readFileSync(join(here, 'llm', 'schemas', 'rate.json'), 'utf8'))
const TEMPLATE = readFileSync(join(here, 'llm', 'prompts', 'rate.md'), 'utf8')
const DISALLOWED = 'Bash,PowerShell,Edit,Write,MultiEdit,NotebookEdit,Glob,Grep,WebFetch,WebSearch,Task,Agent,Skill,TodoWrite'
const AUTH_WORDS = ['failed to authenticate', 'oauth', 'not logged in', 'run /login', 'invalid api key', 'authentication_error']

/* ---------- Records ---------- */

const catalog = readFileSync(join(CATALOG, 'objects.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => !r.skip && r.image)
const curated = JSON.parse(readFileSync(join(here, '..', 'src', 'data', 'paintings.json'), 'utf8')).filter((p) => p.why)
const byId = new Map()
for (const r of catalog) byId.set(r.objectID, r)
for (const p of curated) {
  if (!byId.has(p.objectID)) {
    byId.set(p.objectID, {
      objectID: p.objectID,
      title: p.title,
      artist: p.artist,
      date: p.date,
      medium: p.medium,
      culture: '',
      tags: p.tags ?? [],
    })
  }
}
let records = [...byId.values()].filter((r) => existsSync(join(IMG, `${r.objectID}.jpg`)))

const done = new Set()
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue
    try {
      done.add(JSON.parse(line).objectID)
    } catch {
      // torn last line
    }
  }
}
const skipped = existsSync(SKIPPED) ? JSON.parse(readFileSync(SKIPPED, 'utf8')) : {}
records = records.filter((r) => !done.has(r.objectID) && !(r.objectID in skipped))
if (SAMPLE) records = records.slice(0, SAMPLE)
console.log(`${done.size} rated, ${Object.keys(skipped).length} skipped, ${records.length} to do with ${WORKERS} workers on ${MODEL}`)

/* ---------- One call ---------- */

function describe(r, i) {
  return [
    `### work${i + 1} (file: work${i + 1}.jpg)`,
    `Title: ${r.title || 'Untitled'}`,
    `Artist: ${r.artist || 'Unknown artist'}`,
    `Date: ${r.date || 'undated'}`,
    `Medium: ${r.medium || 'unknown medium'}`,
    `Culture: ${r.culture || 'not recorded'}`,
    `Tags: ${(r.tags || []).join(', ') || 'none'}`,
  ].join('\n')
}

function render(batch) {
  return TEMPLATE.replace('$works', batch.map(describe).join('\n\n')).replace('$count', String(batch.length))
}

function batchSchema(n) {
  const properties = {}
  const required = []
  for (let i = 0; i < n; i++) {
    properties[`work${i + 1}`] = SCHEMA
    required.push(`work${i + 1}`)
  }
  return { type: 'object', additionalProperties: false, required, properties }
}

function authFailure(stdout, stderr) {
  let text = (stderr || '').slice(0, 2000).toLowerCase()
  try {
    const env = JSON.parse(stdout || '')
    if (env && env.is_error) text += ' ' + String(env.result || '').toLowerCase()
  } catch {
    text += ' ' + (stdout || '').slice(-2000).toLowerCase()
  }
  return AUTH_WORDS.some((w) => text.includes(w))
}

function runClaude(cwd, prompt, schema) {
  return new Promise((resolve) => {
    const args = [
      '-p', prompt,
      '--output-format', 'json',
      '--json-schema', JSON.stringify(schema),
      '--max-turns', '4',
      '--permission-mode', 'dontAsk',
      '--model', MODEL,
      '--allowedTools', 'Read',
      '--disallowedTools', DISALLOWED,
    ]
    const proc = spawn(CLAUDE, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => (out += d))
    proc.stderr.on('data', (d) => (err += d))
    const timer = setTimeout(() => proc.kill(), TIMEOUT_MS)
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, out, err })
    })
    proc.on('error', (e) => {
      clearTimeout(timer)
      resolve({ code: -1, out: '', err: String(e) })
    })
  })
}

class AuthExpired extends Error {}

async function rateBatch(worker, batch) {
  const cwd = join(WORK, `w${worker}`)
  rmSync(cwd, { recursive: true, force: true })
  mkdirSync(cwd, { recursive: true })
  batch.forEach((r, i) => copyFileSync(join(IMG, `${r.objectID}.jpg`), join(cwd, `work${i + 1}.jpg`)))
  const res = await runClaude(cwd, render(batch), batchSchema(batch.length))
  rmSync(cwd, { recursive: true, force: true })
  if (res.code !== 0) {
    if (authFailure(res.out, res.err)) throw new AuthExpired('the claude CLI is logged out: run `claude auth login`, then rerun; progress is kept')
    return { error: `exit ${res.code}: ${(res.err || res.out).slice(-200).replace(/\s+/g, ' ')}` }
  }
  let envelope
  try {
    envelope = JSON.parse(res.out)
  } catch {
    return { error: `no JSON: ${res.out.slice(-200)}` }
  }
  if (envelope.is_error) {
    if (authFailure(res.out, res.err)) throw new AuthExpired('the claude CLI is logged out: run `claude auth login`, then rerun; progress is kept')
    return { error: `is_error: ${String(envelope.result || '').slice(0, 200)}` }
  }
  let data = envelope.structured_output
  if (!data) {
    try {
      data = JSON.parse(envelope.result || '')
    } catch {
      return { error: 'no structured output' }
    }
  }
  const all = []
  for (let i = 0; i < batch.length; i++) {
    const block = data[`work${i + 1}`]
    if (!block || typeof block !== 'object') return { error: `missing work${i + 1}` }
    const ratings = {}
    for (const a of ADJECTIVES) {
      const v = block[a]
      if (!Number.isInteger(v) || v < 1 || v > 7) return { error: `bad value for work${i + 1}.${a}: ${v}` }
      ratings[a] = v
    }
    all.push(ratings)
  }
  return { all, cost: envelope.total_cost_usd ?? null, ms: envelope.duration_ms ?? null }
}

/* ---------- Workers ---------- */

let next = 0
let okCount = 0
let failCount = 0
let cost = 0
const t0 = Date.now()
let stop = false

async function worker(id) {
  while (!stop) {
    const start = next
    next += BATCH
    if (start >= records.length) return
    const batch = records.slice(start, start + BATCH)
    let result = await rateBatch(id, batch)
    if (result.error) result = await rateBatch(id, batch) // one retry
    if (result.error) {
      failCount += batch.length
      for (const r of batch) skipped[r.objectID] = result.error
      writeFileSync(SKIPPED, JSON.stringify(skipped, null, 2))
      console.warn(`skip ${batch.map((r) => r.objectID).join(',')}: ${result.error}`)
      continue
    }
    cost += result.cost || 0
    const perWork = result.cost ? result.cost / batch.length : null
    batch.forEach((r, i) => {
      appendFileSync(OUT, JSON.stringify({ objectID: r.objectID, model: MODEL, cost: perWork, ratings: result.all[i] }) + '\n')
    })
    okCount += batch.length
    const perMin = okCount / ((Date.now() - t0) / 60000)
    if (okCount % 50 < BATCH || SAMPLE) {
      console.log(`${okCount} rated (${failCount} failed), ${perMin.toFixed(1)}/min, $${cost.toFixed(2)} metered, ${((records.length - start - batch.length) / Math.max(perMin, 0.1)).toFixed(0)} min left`)
    }
  }
}

mkdirSync(WORK, { recursive: true })
try {
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)))
  console.log(`done: ${okCount} rated, ${failCount} failed, $${cost.toFixed(2)} metered, ${((Date.now() - t0) / 60000).toFixed(1)} min`)
} catch (e) {
  stop = true
  console.error(e.message)
  process.exit(2)
}
