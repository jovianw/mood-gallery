# Mood Gallery

Answer a few questions, walk through a couple of rooms, and find the painting at The Met that
feels like you today. A web build of the "Mood Walk" prototype designed for Cornell CS 5682
(HCI and Design, HW3) by Jovian Wang and Alexa Yang.

Live at <https://jovian.wang/mood-gallery/>.

Not affiliated with The Metropolitan Museum of Art. Artwork images and metadata come from
[The Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)
program via the public [Collection API](https://metmuseum.github.io/).

## The walk

1. Entrance -> the Great Hall (3 statements)
2. Choose a Door: the three unvisited rooms closest to your answers, best first
3. A room (3 more statements), then back to the doors until the walk is sure: at least two rooms
   after the hall, usually three or four, sometimes every room in the building. You can keep
   walking after it is sure if you like.
4. The Final Stretch: a 3D map of your route through the real Met floor plan
5. Finding your painting: a live check with the Met API, then Your Painting
6. Share my path: a 9:16 story card, PNG export and share links
7. My Gallery: saved paintings, as a guest or signed in

## How matching works

- Statements map to five mood axes: energy, warmth, outlook, focus, social. Answers on the
  7-point scale become a vector in that space (`src/lib/matching.ts`).
- Every answered room so far picks the next doors: cosine similarity against each unvisited
  room's `affinity`, with a push toward rooms that ask about the axes the walk knows least.
- The walk ends when it is sure: three rooms at least, every axis heard from, no unvisited room
  that fits clearly better, and one painting in the room clearly ahead (`assessWalk`).
- In the final room, the painting is picked by cosine similarity against that room's
  curated paintings. The top three are rotated with a daily seed (date + user id), so the same
  mood on another day lands on a different painting.
- The Finding screen refreshes the chosen object from the Met API (cached 7 days) and falls back
  to the next candidate if it is no longer on view. Offline, the bundled data is used as is.

## Develop

```bash
npm install
npm run dev
```

The app is served under `/mood-gallery/` in dev too, so open <http://localhost:5173/mood-gallery/>.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run build` | type-check, build, and copy `index.html` to `404.html` for GitHub Pages |
| `npm run lint` | oxlint |
| `npm run fetch:met` | rebuild `src/data/paintings.json` from the curated files and the Met API |

Dev-only shortcuts: `?demo=<roomId>` on any route prefills a finished walk through that room
(for example `/final?demo=european-paintings`), and `?export=1` on the share screen renders the
exported PNG under the card. Neither exists in production builds.

## Firebase (optional)

The app runs as a guest without any configuration: saves and walks live in `localStorage`
(`mg.saves`, `mg.walks`). To turn on sign-in and a synced gallery:

1. Create a Firebase project (Spark plan is enough).
2. Authentication: enable Google and Email link (passwordless). Add `jovian.wang` and
   `localhost` to the authorized domains.
3. Firestore: create a database and paste `firebase/firestore.rules` into Rules.
4. Project settings > Your apps > Web app: copy the config into `.env.local`
   (see `.env.example`), and add the same six values as GitHub repository secrets so
   `.github/workflows/deploy.yml` builds with them.

Firebase web API keys are not secrets; access is controlled by the Firestore rules. The SDK
is loaded lazily, so guests never download it.

Data layout: `users/{uid}/saves/{objectID}`, `users/{uid}/walks/{walkId}`, `shares/{shareId}`.
Guest share links carry the whole walk in the URL (`/w/g?d=...`); signed-in shares use
`/w/{shareId}`.

## Adding a room or a painting

**A room** is one entry in `src/data/rooms.ts`: id, name, floor, `planKey` (a block in
`src/data/met_floorplan.json`), the about blurb, exactly three statements (each tagged with an
axis and a direction), an `affinity` vector, door copy, and the Met department. Add the id to
`RoomId` in `src/data/types.ts`.

**A painting** is one entry in a `scripts/curated-*.json` file keyed by Met object id, with
`room`, `galleryKey` (floor plan block the work hangs in), a five-axis `mood`, three `tags`
and a one-sentence `why`. Run `npm run fetch:met` to pull the live metadata; only public
domain objects with an image are kept. The fetch is throttled because the Met API blocks
bursts, and it keeps the previous record for any object it cannot reach that run.

The 3D map colors, room blocks and route waypoints all come from `met_floorplan.json`; see
`src/lib/floorplan.ts` for how a route is built from the hall through the chosen room to the
painting's gallery.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it with
GitHub Pages (source: GitHub Actions). Because the `jovianw.github.io` user site has a custom
domain, this project site appears at `https://jovian.wang/mood-gallery/`.

## Design

Palette and type follow the HW3 report: Met Red `#E4002B`, Ink `#1F1D1B`, Plaster `#F6F3EE`,
Stone `#E3DDD3`, Slate Blue `#3D5A80`, Mute Gray `#6B6661`; Playfair Display for headlines, Inter
for everything else. Tokens are in `src/styles/tokens.css`. The behavior spec is
`docs/HANDOFF.md`, the screenshots in `docs/figma/` are the visual spec, and
`docs/DECISIONS.md` records where the build had to deviate.
