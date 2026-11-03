# Mood Gallery

Answer a few questions, walk through a couple of rooms, and find the painting at The Met that
feels like you today. A web build of the "Mood Walk" prototype designed for Cornell CS 5682
(HCI and Design, HW3) by Jovian Wang and Alexa Yang.

Live at <https://jovian.wang/mood-gallery/>.

Not affiliated with The Metropolitan Museum of Art. Artwork images and metadata come from
[The Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)
program via the public [Collection API](https://metmuseum.github.io/).

## The walk

1. Entrance -> pick where to start (the Great Hall, or where your last walk ended) -> 3 statements
2. Choose a Door: the three unvisited rooms closest to your answers, best first
3. A room (3 more statements), then back to the doors until the walk is sure: at least two rooms
   after the starting room, usually three or four, sometimes every room in the building.
4. The Final Stretch: a 3D map of your route through the real Met floor plan
5. Finding your painting: a live check with the Met API, then Your Painting
6. Share my path: a 9:16 story card, PNG export and share links
7. My Gallery: saved paintings, as a guest or signed in

## How matching works

The walk is a Bayesian adaptive test. The in-app page at `/about` shows the equations with live
numbers; the short version:

- Statements map to five mood axes: energy, warmth, outlook, focus, social. Each answer on the
  7-point scale is a noisy reading of one axis. A Gaussian prior per axis is updated in closed
  form after every answer (`src/lib/bayes.ts`).
- Every work has a five-dimensional vector. The match score is cosine similarity, but because the
  mood is uncertain the winner is too: 256 posterior samples give P(work i is the match) and,
  summed by room, P(the match hangs in room r).
- Doors are ranked by P(room) plus expected information gain: a one-step lookahead that imagines
  a plausible visitor answering the room's statements and measures how much the best-match
  distribution sharpens.
- The walk ends after at least three rooms when the expected regret of the work it would pick
  in this room (E[s_max - s_i] over the posterior samples, in cosine) is at most 0.08. The
  threshold was tuned with `scripts/simulate.mts` (synthetic visitors with personas, correlated
  axes, noise and an agree bias); results are in `src/data/stats.json`.
- In the final room the pick is a penalized argmax: similarity to the posterior mean minus a
  decaying penalty for works this visitor was shown recently (`pickWithHistory`).
- Painting vectors: 109 curated by hand, the rest projected from CLIP image embeddings onto the
  five axes (`scripts/embed.py`, numbers in `src/data/embedding-stats.json`).
- Routes are A* on a 2 m walkable grid of the traced floor plan (`src/lib/routing.ts`).
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
| `npm run fetch:met` | rebuild the curated records from the curated files and the Met API |
| `node scripts/fetch-catalog.mjs` | pull on-view public-domain records for the walk departments into `data/catalog/` |
| `node scripts/fetch-images.mjs` | download their small images for embedding |
| `.venv/Scripts/python scripts/embed.py` | CLIP embeddings, axis projection, and the expanded `paintings.json` |
| `npx tsx scripts/simulate.mts --write` | simulate visitors, tune the stopping rule, write `stats.json` |

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
