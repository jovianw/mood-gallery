// Builds src/data/paintings.json from The Met Collection API plus scripts/curated*.json.
// Usage: npm run fetch:met
// The API needs no key. Only public-domain objects with an image are kept. Requests are
// throttled because the Met sits behind bot protection that blocks bursts; if an object
// cannot be fetched this run, the previous record from paintings.json is kept.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const API = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/'
const here = new URL('.', import.meta.url)
const outUrl = new URL('../src/data/paintings.json', import.meta.url)

const curated = {}
for (const f of readdirSync(here).filter((n) => /^curated.*\.json$/.test(n)).sort()) {
  const data = JSON.parse(readFileSync(new URL(f, here), 'utf8'))
  for (const [id, entry] of Object.entries(data)) {
    if (id.startsWith('_')) continue
    if (curated[id]) console.warn(`duplicate ${id} in ${f}, keeping the first`)
    else curated[id] = entry
  }
}
const ids = Object.keys(curated)

const previous = new Map()
if (existsSync(outUrl)) {
  for (const p of JSON.parse(readFileSync(outUrl, 'utf8'))) previous.set(String(p.objectID), p)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchObject(id, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(API + id)
      const text = await res.text()
      if (res.status === 404) return { missing: true }
      if (text.startsWith('{')) return JSON.parse(text)
      console.warn(`throttled on ${id}, waiting`)
    } catch (e) {
      console.warn(`network error on ${id}: ${e.message}`)
    }
    await sleep(4000 * (t + 1))
  }
  return null
}

const paintings = []
let fetched = 0
let reused = 0
for (const id of ids) {
  const c = curated[id]
  const o = await fetchObject(id)
  if (o && !o.missing) {
    if (!o.isPublicDomain || !o.primaryImageSmall) {
      console.warn(`skip ${id}: not public domain or no image (${o.title})`)
      continue
    }
    paintings.push({
      objectID: o.objectID,
      title: o.title,
      artist: o.artistDisplayName || 'Unknown artist',
      date: o.objectDate,
      medium: o.medium,
      gallery: o.GalleryNumber || null,
      image: o.primaryImageSmall,
      imageLarge: o.primaryImage,
      objectURL: o.objectURL,
      room: c.room,
      galleryKey: c.galleryKey,
      mood: c.mood,
      tags: c.tags,
      why: c.why,
    })
    fetched++
    console.log(`ok   ${id}: ${o.title} (gallery ${o.GalleryNumber || '-'})`)
  } else if (o?.missing) {
    console.warn(`skip ${id}: not found`)
  } else if (previous.has(id)) {
    const p = previous.get(id)
    paintings.push({ ...p, room: c.room, galleryKey: c.galleryKey, mood: c.mood, tags: c.tags, why: c.why })
    reused++
    console.log(`kept ${id}: ${p.title} (from previous run)`)
  } else {
    console.warn(`skip ${id}: could not fetch and no previous record`)
  }
  await sleep(700)
}

const perRoom = {}
for (const p of paintings) perRoom[p.room] = (perRoom[p.room] || 0) + 1

writeFileSync(outUrl, JSON.stringify(paintings, null, 2) + '\n')
console.log(`wrote ${paintings.length} paintings (${fetched} fetched, ${reused} reused)`)
console.log(perRoom)
