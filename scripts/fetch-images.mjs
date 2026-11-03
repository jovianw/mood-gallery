// Downloads the small image of every usable record in data/catalog/objects.jsonl into
// data/catalog/img/<objectID>.jpg so scripts/embed.py can run CLIP over them. Resumable and
// throttled (the Met image CDN also rate-limits). Usage: node scripts/fetch-images.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIR = new URL('../data/catalog/', import.meta.url)
const IMG = new URL('img/', DIR)
mkdirSync(IMG, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const records = readFileSync(new URL('objects.jsonl', DIR), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((r) => !r.skip && r.image)

let got = 0
let skipped = 0
let failed = 0
for (const r of records) {
  const out = new URL(`${r.objectID}.jpg`, IMG)
  if (existsSync(out)) {
    skipped++
    continue
  }
  let ok = false
  for (let t = 0; t < 3 && !ok; t++) {
    try {
      const res = await fetch(r.image)
      if (res.ok && (res.headers.get('content-type') || '').startsWith('image/')) {
        writeFileSync(out, Buffer.from(await res.arrayBuffer()))
        ok = true
      } else {
        console.warn(`status ${res.status} for ${r.objectID}, waiting`)
        await sleep(4000 * (t + 1))
      }
    } catch (e) {
      console.warn(`error for ${r.objectID}: ${e.message}`)
      await sleep(4000 * (t + 1))
    }
  }
  if (ok) got++
  else failed++
  if ((got + failed) % 50 === 0) console.log(`${got} downloaded, ${failed} failed, ${skipped} already there`)
  await sleep(400)
}
console.log(`done: ${got} downloaded, ${failed} failed, ${skipped} already there, ${records.length} records`)
