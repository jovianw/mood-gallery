# Mood Gallery

Mood questionnaire framed as a walk through The Met that ends at a painting picked for your mood. Vite + React + TypeScript, static, deployed to GitHub Pages at https://jovian.wang/mood-gallery/.

Before changing anything, read `docs/HANDOFF.md`. It is the behavior spec. The screenshots in `docs/figma/` are the visual spec (numbered in flow order). `docs/map-reference/` and `src/data/met_floorplan.json` cover the 3D route map and the share-card map.

Rules of the road:
- Only the palette in `src/styles/tokens.css` (Met Red, Ink, Plaster, Stone, Slate Blue, Mute Gray, white). No other hues.
- Playfair Display for headlines, Inter for everything else.
- One 390px column, centered on desktop. Match the screenshots at 390px.
- Keep `BrowserRouter` + `basename` + the 404 fallback in `scripts/postbuild.mjs`.
- Firebase is optional at runtime: the app must work as a guest when `VITE_FIREBASE_*` is missing.
- `npm run build` and `npm run lint` must pass before you stop.
- Copy in the UI: casual, plain words, no em dashes, no emojis.
