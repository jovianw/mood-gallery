// Builds src/data/paintings.json from The Met Collection API plus scripts/curated.json.
// Usage: npm run fetch:met
// The API needs no key. Only public-domain objects with an image are kept.
import { readFileSync, writeFileSync } from 'node:fs'

const API = 'https://collectionapi.metmuseum.org/public/collection/v1/objects/'
const curated = JSON.parse(readFileSync(new URL('./curated.json', import.meta.url), 'utf8'))
const ids = Object.keys(curated).filter((k) => !k.startsWith('_'))

const paintings = []
for (const id of ids) {
  const res = await fetch(API + id)
  if (!res.ok) {
    console.warn(`skip ${id}: HTTP ${res.status}`)
    continue
  }
  const o = await res.json()
  if (!o.isPublicDomain || !o.primaryImageSmall) {
    console.warn(`skip ${id}: not public domain or no image (${o.title})`)
    continue
  }
  const c = curated[id]
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
    approachVia: c.approachVia,
    mood: c.mood,
    tags: c.tags,
    why: c.why,
  })
  console.log(`ok   ${id}: ${o.title} (gallery ${o.GalleryNumber || '-'})`)
  await new Promise((r) => setTimeout(r, 150))
}

writeFileSync(
  new URL('../src/data/paintings.json', import.meta.url),
  JSON.stringify(paintings, null, 2) + '\n',
)
console.log(`wrote ${paintings.length} paintings`)
