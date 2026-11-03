# Mood Gallery

Answer a few questions, walk through a couple of rooms, and find the painting at The Met that
feels like you today. A web build of the "Mood Walk" prototype designed for Cornell CS 5682
(HCI and Design, HW3) by Jovian Wang and Alexa Yang.

Live at <https://jovian.wang/mood-gallery/> once deployed.

Not affiliated with The Metropolitan Museum of Art. Artwork images and metadata come from
[The Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access)
program via the public [Collection API](https://metmuseum.github.io/).

## How it works

- Each statement maps to one of four mood axes: energy, warmth, outlook, focus.
- Answers on the 7-point scale become a vector in that space.
- The Great Hall answers pick a recommended door. The chosen room's answers refine the vector.
- The painting with the highest cosine similarity inside the chosen room wins.

Rooms, statements and doors live in `src/data/rooms.ts`. Painting mood tags live in
`scripts/curated.json`; `npm run fetch:met` merges them with live metadata (title, artist, gallery
number, image) from the Met API into `src/data/paintings.json`.

## Develop

```bash
npm install
npm run dev
```

The app is served under `/mood-gallery/` in dev too, so open <http://localhost:5173/mood-gallery/>.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the site and publishes it with
GitHub Pages. In the repository settings, set Pages to "GitHub Actions" as the source. Because the
`jovianw.github.io` user site has a custom domain, this project site appears at
`https://jovian.wang/mood-gallery/` automatically.

## Design

Palette and type scale follow the HW3 report: Met Red `#E4002B`, Ink `#1F1D1B`, Plaster `#F6F3EE`,
Stone `#E3DDD3`, Slate Blue `#3D5A80`, Mute Gray `#6B6661`; Playfair Display for headlines, Inter for
everything else. Tokens are in `src/styles/tokens.css`.
