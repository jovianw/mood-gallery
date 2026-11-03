// Pulls the on-view, public-domain, imaged objects of the seven walk departments from The Met
// Collection API into data/catalog/objects.jsonl (one JSON record per line, resumable).
// Usage: node scripts/fetch-catalog.mjs [--max-per-dept N]
// Throttled: the API sits behind bot protection that blocks bursts. Rerunning skips ids already
// on disk, so an interrupted pull picks up where it stopped.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SEARCH = 'https://collectionapi.metmuseum.org/public/collection/v1.1/search'
const OBJECT = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/'
const OUT_DIR = new URL('../data/catalog/', import.meta.url)
const OUT = new URL('objects.jsonl', OUT_DIR)
const IDS = new URL('ids.json', OUT_DIR)

/** Met department id -> room id(s). European Paintings splits by gallery number. */
const DEPARTMENTS = {
  11: (gallery) => (gallery >= 800 ? 'nineteenth-century' : 'european-paintings'),
  1: () => 'american-wing',
  4: () => 'arms-and-armor',
  10: () => 'egyptian-art',
  6: () => 'asian-art',
  13: () => 'greek-and-roman',
}

const argMax = process.argv.indexOf('--max-per-dept')
const MAX_PER_DEPT = argMax > -1 ? Number(process.argv[argMax + 1]) : Infinity

mkdirSync(OUT_DIR, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url)
      const text = await res.text()
      if (res.status === 404) return { missing: true }
      if (text.startsWith('{')) return JSON.parse(text)
      console.warn(`throttled (${res.status}) on ${url.slice(-40)}, waiting`)
    } catch (e) {
      console.warn(`network error: ${e.message}`)
    }
    await sleep(5000 * (t + 1))
  }
  return null
}

// Step A: object ids per department (cached in ids.json).
let ids
if (existsSync(IDS)) {
  ids = JSON.parse(readFileSync(IDS, 'utf8'))
} else {
  ids = {}
  for (const dept of Object.keys(DEPARTMENTS)) {
    const url = `${SEARCH}?q=*&departmentId=${dept}&isOnView=true&hasImages=true&isPublicDomain=true&limit=5000&offset=0`
    const r = await getJson(url)
    ids[dept] = r?.objectIDs ?? []
    console.log(`department ${dept}: ${r?.total ?? '?'} objects, got ${ids[dept].length} ids`)
    await sleep(1500)
  }
  writeFileSync(IDS, JSON.stringify(ids))
}

// Step B: object records, resumable.
const done = new Set()
if (existsSync(OUT)) {
  for (const line of readFileSync(OUT, 'utf8').split('\n')) {
    if (!line) continue
    try {
      done.add(JSON.parse(line).objectID)
    } catch {
      // ignore a torn last line
    }
  }
}
console.log(`${done.size} records already on disk`)

let fetched = 0
for (const [dept, list] of Object.entries(ids)) {
  const toRoom = DEPARTMENTS[dept]
  let n = 0
  for (const id of list) {
    if (n >= MAX_PER_DEPT) break
    n++
    if (done.has(id)) continue
    const o = await getJson(OBJECT + id)
    await sleep(650)
    if (!o || o.missing) {
      if (o?.missing) appendFileSync(OUT, JSON.stringify({ objectID: id, skip: 'missing' }) + '\n')
      continue
    }
    const gallery = Number(o.GalleryNumber) || null
    const rec = {
      objectID: o.objectID,
      dept: Number(dept),
      room: toRoom(gallery ?? 0),
      title: o.title,
      artist: o.artistDisplayName || '',
      date: o.objectDate || '',
      medium: o.medium || '',
      classification: o.classification || '',
      objectName: o.objectName || '',
      culture: o.culture || '',
      gallery: o.GalleryNumber || null,
      image: o.primaryImageSmall || '',
      imageLarge: o.primaryImage || '',
      objectURL: o.objectURL,
      highlight: !!o.isHighlight,
      publicDomain: !!o.isPublicDomain,
      tags: (o.tags || []).map((t) => t.term),
    }
    if (!rec.publicDomain || !rec.image || !rec.gallery) rec.skip = 'no image, gallery or rights'
    appendFileSync(OUT, JSON.stringify(rec) + '\n')
    done.add(id)
    fetched++
    if (fetched % 50 === 0) console.log(`${fetched} fetched this run (${done.size} total)`)
  }
}
console.log(`done: ${fetched} fetched this run, ${done.size} records on disk`)
