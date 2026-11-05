# Mood Gallery, build handoff

This folder is the spec for turning the current prototype into the full, working website. Read this file first, then look at the screenshots in `docs/figma/` (one per screen, numbered in flow order) and the map assets in `docs/map-reference/`. The Figma file is the source of truth for how things look; this document is the source of truth for how things behave.

Figma: https://www.figma.com/design/nSVuNxpCWCq0PzudTkcPZh (page "Mood Walk"). If you have the Figma MCP, use `get_design_context` on the node ids listed below for exact spacing, type sizes and colors. If you do not, the screenshots plus `src/styles/tokens.css` are enough.

Live URL when deployed: https://jovian.wang/mood-gallery/ (GitHub Pages project site, already wired up in `.github/workflows/deploy.yml`).

## What exists today

The repo is a Vite + React 19 + TypeScript app that implements an older version of the design: Entrance, Great Hall, Choose a Door, one room, Final Stretch (with a fake 4-angle map), Your Painting, Share. Paintings come from `scripts/curated.json` + `npm run fetch:met` -> `src/data/paintings.json`. Saves are objectIDs in localStorage. There is no auth, no gallery, no real 3D map, no real share image, no loading screen, no museum picker, no desktop layout.

Keep what works (routing with `basename`, the 404 fallback from `scripts/postbuild.mjs`, tokens, the matching math, the curated painting pipeline). Replace or extend everything else to match the screens below.

## Stack decisions (do not relitigate)

- Vite + React + TS, static site, no server of our own. Deployed by the existing GitHub Actions workflow to GitHub Pages under `/mood-gallery/`.
- Keep `BrowserRouter` + `basename` + the 404.html copy (that is how the current repo gets clean URLs on Pages). The Figma notes say "hash routing"; ignore that, the 404 trick already solves it. Routes: `/`, `/room/:roomId`, `/doors`, `/final`, `/finding`, `/painting`, `/share`, `/gallery`, `/w/:shareId`.
- Firebase (free Spark plan): Auth (Google + email link) and Firestore for saved paintings. Config comes from `VITE_FIREBASE_*` env vars; add `.env.example` with the variable names and read them in `src/lib/firebase.ts`. Firebase web API keys are not secrets, so it is fine for them to end up in the bundle. In CI, read them from GitHub repository secrets (`${{ secrets.VITE_FIREBASE_API_KEY }}` etc. in `deploy.yml`). If the env vars are missing, the app must still run as guest-only (saves in localStorage, sign-in sheet shows a "Sign-in is not set up yet" line instead of the buttons). Never crash because Firebase is unconfigured.
- 3D map: `three` + `@react-three/fiber` + `@react-three/drei` (OrbitControls). Nothing else heavy.
- Share image: `html-to-image` (toPng) on a hidden 1080x1920 DOM copy of the card. `color-thief` or a 20-line canvas sampler for the gradient.
- Animations: CSS transitions / the View Transitions API where available; `framer-motion` is acceptable if you prefer. Respect `prefers-reduced-motion`.
- Fonts: Playfair Display (headlines, italic for "About this room" blurbs and the loading headline) + Inter, loaded from Google Fonts in `index.html`.
- Mobile first. The app is one 390px column. On screens >= 768px the column is centered on the Stone wall color with a soft shadow (screen 12). No separate desktop layout. The route map and the share card are the only things that may grow wider (up to 560px).

## Palette and type (already in `src/styles/tokens.css`)

Met Red #E4002B, Ink #1F1D1B, Plaster #F6F3EE (page background), Stone #E3DDD3 (dividers, arches, desktop wall), Slate Blue #3D5A80 (disagree side of the scale), Mute Gray #6B6661, White cards. Dark screens (loading, final stretch, share) use Ink as the background. Only these colors anywhere; no other hues except painting images and the share gradient which is sampled from the painting.

Type: display 38, headline 30, title 26, room 20, statement 17, body 16, small 14, label 10 with 0.12em tracking and uppercase (labels like "YOU ARE IN", "ABOUT THIS ROOM", "YOUR DOOR" are Met Red). Buttons are 56px pills, full width, Met Red with white text for primary, outlined for secondary.

## The walk, end to end

1. Entrance (`/`) -> pick a starting room (the Great Hall by default, or the room the last walk ended in) -> "Enter The Met"
2. The starting room (`/room/:roomId`, normally `/room/great-hall`): 3 statements -> "Find my door"
3. Choose a Door (`/doors`): up to 3 door cards, the recommended one marked "YOUR DOOR"
4. A room (`/room/:roomId`): about card + 3 statements -> "Find my next door", or "Show my final stretch" once the walk is sure. Steps 3 and 4 repeat: at least two rooms after the starting room, and as many as it takes (see "Walk length" below).
5. The Final Stretch (`/final`): 3D route map + route recap -> "Reveal my piece"
6. Finding your piece (`/finding`): dark loading screen, advances when the work is ready
7. Your Piece (`/painting`): arrival reveal, full image, metadata, chips, "Why this one", Save, Share, Start a new walk
8. Share my path (`/share`): story card + share actions
9. My Gallery (`/gallery`): saved paintings, reachable from the user icon on the Entrance
10. Sign-in sheet: appears over Your Painting when a guest taps Save
11. Choose museum sheet: appears over Entrance when tapping "Change"

Transitions: forward = slide left 300ms, back = slide right, sheets slide up over a 55% dim scrim and close on scrim tap or drag down.

### Walk length (added 2026-11-03; superseded by the Bayesian rule the same day, see below)

The walk is not a fixed two rooms. After every room the app decides whether it is sure enough to end there (`assessWalk` in `src/lib/matching.ts`). It keeps offering doors while any of these hold:

- fewer than 3 rooms walked (hall + 2), `MIN_ROOMS`;
- an axis nobody has asked about yet (the hall covers energy, warmth and social, so at least one later room has to ask about outlook and focus);
- an unvisited room fits the mood clearly better than the room you are in (`ROOM_SLACK` 0.03 cosine);
- the best painting in this room does not beat the runner-up by `PAINTING_MARGIN` (0.03 cosine).

Doors are ranked by affinity plus a bonus for rooms whose statements ask about the least-covered axes, unvisited rooms only, so the recommended door is the one most likely to settle it. When no unvisited rooms remain the walk ends where it is. Once sure, the room button becomes "Show my final stretch" and the doors screen redirects to the Final Stretch; there is no way to keep walking past a sure match. Instead, every walk starts with a choice of starting room on the Entrance: the Great Hall by default, or the room the last finished walk ended in (`mg.lastRoom`), so "Start a new walk" from Your Painting or My Gallery returns to the Entrance with that room preselected. The Choose a Door headline and a "N rooms · M% sure" meter explain why the walk continues. Simulated over random answer patterns this gives about 22% three-room walks, 37% four, 24% five and a tail out to all eight rooms (mean 4.4).

## Screen by screen

Node ids refer to the Figma file. Each screen has a screenshot in `docs/figma/`.

### 1 Entrance (14:9) `docs/figma/01-entrance.png`
- Top bar: red arch logo (left), "Mood Gallery" in Playfair (center), user icon (right) -> `/gallery` (if signed out, the gallery still opens and shows guest saves; the header reads "GUEST" instead of "SIGNED IN AS JOVIAN").
- Hero: big red semicircle with a dark arch and a small gold painting inside. Build it in CSS/SVG, no raster.
- Headline "Find the painting that feels like you today." + body copy exactly as in the screenshot.
- "YOUR MUSEUM" card: pin icon, "The Met Fifth Avenue", "Change" with chevron -> opens the Choose museum sheet.
- "Nearby, coming soon:" + three Stone chips (MoMA, Guggenheim, Brooklyn Museum). Chips are not tappable.
- Primary button "Enter The Met ->" -> `/room/<starting room>`. Starting a walk resets any previous answers. Below the museum selector sits a second selector, "Start in", with a Change button that opens a sheet listing the eight rooms (added 2026-11-03, not in the Figma). It defaults to the Great Hall, or to the room the last finished walk ended in, in which case the label reads "Start where you left off".

### 8 Choose museum sheet (35:191) `docs/figma/08-choose-museum-sheet.png`
- Bottom sheet, drag handle, "Choose your museum" + copy. The Met card is selected (red border, red check), subtitle "New York · 490,000 works · Open Access". MoMA, Guggenheim, Brooklyn Museum are disabled rows with "Coming soon". "Request a museum" link opens `mailto:` with a prefilled subject. Only The Met is selectable; selecting it just closes the sheet.

### 2 The Great Hall (14:47) and 4 Room (14:148) `docs/figma/02-great-hall.png`, `04-room-european-paintings.png`
Same component, `RoomScreen`, fed by a room definition.
- Header: back chevron, "YOU ARE IN" label, room name in Playfair, then a breadcrumb line: visited rooms as red dots joined by a red line, current room as a filled red dot with its name, and four small gray dots for the rest of the walk. In the Great Hall there is just "● Great Hall ····". In a room: "○ Great Hall ―● European Paintings ····".
- "ABOUT THIS ROOM" white card with the blurb in Playfair italic.
- Three statements. Each statement: centered text (17px), the 7-dot scale, "AGREE" (red) left and "DISAGREE" (slate blue) right under it.
- Scale: 7 circles. Sizes from the outside in: 48, 40, 32, 26 (middle), 32, 40, 48. Left three are red outlines, middle is Mute Gray outline, right three are Slate Blue outlines. Tapping fills that circle with its color (red / gray / blue) and a white check; single select per statement; tapping another dot moves the selection. The dots in the Figma are all drawn as outlines, which is the unanswered state.
- Primary button at the bottom ("Find my door ->" in the Great Hall, "Show my final stretch ->" in rooms) is disabled (Mute Gray, 50% opacity) until all three statements are answered. No empty space: the three statements fill the screen between the about card and the button.
- Back on the Great Hall goes to Entrance; back in a room goes to Choose a Door and keeps answers.

### 3 Choose a Door (14:108) `docs/figma/03-choose-a-door.png`
- "LEAVING THE GREAT HALL" label, headline "Three doors open from here.", copy "We picked one based on how you answered. Feel free to take a different one."
- Door card component (13:206). The recommended door: white card with a 2px Met Red border, red arch illustration with a dark opening, "YOUR DOOR" label, room name in Playfair 26, reason sentence. "OTHER DOORS" label, then two cards with Stone arches, name in Playfair 20 and a shorter reason.
- Which doors: compute the mood vector from every room answered so far and show the 3 unvisited rooms with the highest similarity to their `affinity` (plus the coverage bonus described under "Walk length"), best first. Fewer than 3 near the end of a long walk. The set of doors changes with the answers (footer: "Your doors change every walk."). From the second visit on, the headline and copy say why the walk continues ("Not sure yet.", "Getting warmer.", "Almost there.") above a warmth meter.
- Tapping a card -> `/room/:roomId`.

### 5 The Final Stretch (14:212) `docs/figma/05-final-stretch.png`
Dark screen (Ink). "THE FINAL STRETCH" label, headline "Your piece is just ahead." in Playfair italic, copy "Here's the rest of your route, and a look back at the path that got you here."
- Map card (component 20:300, see `docs/figma/component-gallery-map-4-angles.png` and `docs/map-reference/final-stretch-map-angle-*.png`): a rounded dark card (#2A2725) 342x200 with "Drag to turn" hint top left and a "Rotate" pill top right, a small compass bottom right. Inside, the 3D map. See "The 3D map" below.
- Legend line: "● You are here   📍 Gallery 822  · about a 4 min walk". Walk minutes = route length in meters / 80, rounded, min 1.
- Route recap list: one row per room in the walk plus the destination. Visited rooms: red circle with white check, name, then a muted line "Where you started · Restless energy" (the first row) or the room's mood phrase. The next room (walk straight through): hollow white circle, dotted connector. Destination: red glowing dot, name in Playfair 20, red line "Your piece is waiting here". Connectors between rows: solid red for visited, dotted for ahead.
- Primary button "Reveal my piece" -> `/finding`.

### 9 Finding your piece (35:237) `docs/figma/09-loading.png`
Dark. Spinner (Mute Gray ring with a red arc), "Finding your piece..." Playfair italic, "Searching The Met's open collection for restless, warm, hopeful." (the three mood words), a 3-step checklist (red dots turn on as steps complete: Reading your answers, Searching 490,000 works, Picking the one for today), footer "Usually takes a second or two".
- Not a timer. It shows while the painting is being resolved (fetch the live `/objects/{id}` record for the chosen painting to refresh gallery number and image, with a 600ms minimum so it does not flash). On success -> `/painting`. On failure: same dark screen, headline "The Met is not answering right now", a Retry button and a "Try a different door" link.

### 6 Your Piece (14:265) `docs/figma/06-your-painting.png`
- Top bar: X (-> Entrance, after confirming nothing; the walk is kept in memory until a new walk starts), "YOUR PIECE" label, share icon (-> `/share`).
- The work in a Met Red frame (8px), whole and at its own proportions (updated 2026-11-04: the old 230px crop cut most works). Width is the column; height follows, capped at 62dvh so very tall works are matted on the sides, never cropped. Use `primaryImageSmall`; swap in `primaryImage` once loaded.
- Arrival reveal (added 2026-11-04), only when the screen is reached from Finding (Finding sets `sessionStorage.mg.reveal`, the screen clears it on mount; a reload, back navigation or a saved work never replays it, and reduced motion skips it). Phases in `useReveal` (`src/screens/YourPainting.tsx`): **hold**, the screen is Ink, everything but the framed work, title and artist line is invisible, and that group fades in centered in the viewport once the image has painted (2.5 s timeout if it never does), for 1.3 s; **settle**, the background and text colors cross to Plaster and Ink over 700 ms while the group slides up to its normal place (650 ms) and the remaining blocks fade in top to bottom, each a `.reveal__item` with a 55 ms stagger; **done** 1.1 s later, when every reveal class is removed. The centering is a measured translateY (`--reveal-shift`), so the final layout is the ordinary one and nothing is laid out twice.
- Title in Playfair 30, "Artist · Date · Medium" muted, pin icon + "On view in Gallery 822, The Met Fifth Avenue" (use GalleryNumber; if empty, "Not currently on view").
- Three mood chips (Stone background, Ink text).
- "WHY THIS ONE" white card: 2 to 3 sentences built from a template using the two strongest axes plus the painting's curated `why` sentence.
- "HOW THIS WORK READS" white card (added 2026-11-04): one row per tag of the work, with the two adjective ratings that pushed it furthest toward that pole, phrased against the catalog mean ("Everyday · less ancient, less sacred"). Data: `ev` in `paintings.json`, written by `scripts/evidence.py`; text built by `tagEvidence` in `src/lib/matching.ts`. A link "How the words were found" opens `/about`. Hidden for works without `ev`.
- "Save to My Gallery" outlined red button with a bookmark icon. Saved state: filled red, white text, "Saved to My Gallery" with a filled bookmark; tapping again unsaves. Guests get the sign-in sheet (screen 10) on first tap; "Not now, keep it on this device only" saves to localStorage and closes the sheet.
- "Share my path" outlined Ink button -> `/share`. "Start a new walk" underlined text -> resets and goes to `/room/great-hall`.

### 10 Sign-in sheet (35:259) `docs/figma/10-sign-in-sheet.png`
"Keep this one" + copy, "Continue with Google" (Google G icon), "Email me a sign-in link" (envelope icon; asks for the address in a small inline field, then sends the Firebase email link and shows "Check your inbox"), "Not now, keep it on this device only" link, footnote "Guest saves live in this browser and are lost if you clear it." After a successful sign-in: save the painting, close the sheet, and if there are guest saves in localStorage ask once "Move your 3 guest saves to your account?" (Yes / Not now).

### 7 Share my path (14:309) `docs/figma/07-share-my-path.png`
Dark screen. X (back), "SHARE YOUR PATH" label. The story card is 300x533 on screen (9:16), rendered at 1080x1920 for export.
- Card background: vertical gradient of the 3 dominant colors sampled from the painting (top -> bottom). Text on it is white.
- "MY MOOD WALK" label left, "Nov 2 · The Met" right (walk date).
- Mood sentence in Playfair 30, e.g. "Restless, warm, and hopeful."
- Route map (see `docs/map-reference/share-card-route-map.png`): the real Met footprint as a thin white outline (60% opacity, 8% white fill), visited rooms as flat white blocks, the destination block white with a small red inner block, one solid Met Red line through the room centers from a red start dot (Great Hall) to a red pin at the destination gallery, white room labels (Inter 11, 80%). This is a static SVG/canvas at the default angle, not the 3D scene. Only the floor of the walk is drawn.
- Walk stats row: "3 rooms", "9 answers", "4 min walk" (big numbers in Playfair, small labels).
- Route log: one line per room: "● Great Hall · Arrived restless, mind racing", "● European Paintings · Heavy, but warm", "● Gallery 822 · Found it: looking ahead" (dots white, last one red). The phrase after the dot comes from that room's answers (see Matching).
- Painting strip: thumbnail + title (Playfair) + "Artist, year" on a 25% black rounded panel.
- Footer: small red arch + "Mood Gallery" in Playfair, and a muted credit "Image: The Metropolitan Museum of Art" (not in the Figma, add it, Met Open Access asks for it).
- Action row: four round buttons with labels: Story (red, uses the Web Share API with the PNG file; falls back to download), Messages (Web Share API with text + link), Save image (downloads the PNG), Copy link (copies `https://jovian.wang/mood-gallery/w/<shareId>`).
- Share links: for signed-in users write `shares/{shareId}` to Firestore (public read, owner write) with everything needed to re-render the card. For guests, encode the walk in the URL (`/w/g?d=<base64url json>`) so no backend is needed. `/w/:shareId` renders the card read-only with a "Take your own walk" button.

### 11 My Gallery (35:285, empty state 35:354) `docs/figma/11-my-gallery.png`, `11b-my-gallery-empty.png`
- Header: back chevron, "SIGNED IN AS JOVIAN" (first name) or "GUEST" label, "My Gallery" Playfair, user icon (opens a tiny menu: Sign out / Sign in).
- Three stat cards: walks (count of walks completed on this device/account), paintings saved, museums (always 1 for now).
- "SAVED PAINTINGS" label, then white cards: 80x80 thumbnail with 10px radius, title Playfair 20, "Artist, year", "Oct 28 · The Met", mood chips. Tapping a card opens Your Painting for that save with "Start a new walk" hidden and the back chevron returning to the gallery. Swipe or long-press is not needed; the Save toggle on that screen unsaves.
- Empty state: dashed square icon, "Nothing hanging here yet." Playfair 26, copy, "Start a walk ->" button.
- Order: newest first. Signed-in: read from Firestore with a live listener. Guest: localStorage.

### 12 Desktop (37:202) `docs/figma/12-desktop-layout.png`
Phone column centered on Stone with a soft shadow at >= 768px. Nothing else changes.

### 13 Privacy and terms `/privacy` (added 2026-11-04)
Plain-language page, same typography as About: what a guest's browser keeps, what signing in stores in Firebase (saves, one record per walk, share cards), that the site sets no cookies and runs no analytics, how to request account deletion (GitHub issue), and short terms (unofficial, Met Open Access CC0, not an assessment or advice, provided as is). Linked from the Entrance footer, the sign-in sheet's small print, and About section 11.9. No cookie banner: nothing on the site needs consent under the cookie rules, and the page says so.

### Accessibility and interaction rules (added 2026-11-04)
- One `main` per screen and one `h1` (the app bar title or the screen headline). `RouteEffects` in `App.tsx` sets `document.title` per route and moves focus to `main` after each navigation.
- The 7-point scale is a `radiogroup` with a roving tab stop: arrows move and select, Home and End jump to the poles. Every dot has a 44 px hit area whatever its visual size.
- Bottom sheets return focus to the control that opened them; Escape, scrim tap, handle drag and the "not now" link all close them.
- Rooms show "N of M left to answer." under the disabled button until every statement is answered.
- Text in the accent uses `--accent-text` (Met Red 10% darker on light screens, a lighter tint on dark) so it clears 4.5:1; buttons and marks keep `--accent`.
- Copy never says the model is "sure"; it says the answer is clear, or that another room would not change it.

## Rooms are data

`src/data/rooms.ts` becomes the list below. A room = `{ id, name, floor, planKey, about, statements[3], affinity, reason, shortReason, department }`. `planKey` is the key in `met_floorplan.json`; `department` is the Met department name used when curating paintings.

| id | name | floor | planKey | destination galleries |
|---|---|---|---|---|
| great-hall | The Great Hall | 1 | hall | (start) |
| european-paintings | European Paintings, 1250–1800 | 2 | eurp | 600s–640s |
| nineteenth-century | 19th-Century European Paintings | 2 | c19 (822 is `g822`) | 800s–830s |
| american-wing | The American Wing | 2 | amer | 740s–760s |
| arms-and-armor | Arms and Armor | 1 | arms | 370s |
| egyptian-art | Egyptian Art and the Temple of Dendur | 1 | egypt / dendur | 100s–130s |
| asian-art | Asian Art | 2 | asian | 200s |
| modern | Modern and Contemporary Art | 1 | modern1 | 900s |

Keep the existing Great Hall, European Paintings, 19th-Century and American Wing statements and write three new statements each for the other four. Statements are plain, first person, present tense, casual ("I could use some warmth today."). Every room has 3; no room may have fewer, the screen is designed for exactly three.

Mood axes: keep the four in `src/data/types.ts` (energy restless↔calm, warmth warm↔cool, outlook hopeful↔heavy, focus inward↔outward) and add `social` (alone↔together) so the "I'd rather be around people" style statements have somewhere to go. Door affinities and painting moods are vectors over these 5 axes.

Room mood phrases (used in the Final Stretch list and the share route log): the top two words from that room's own answers, e.g. "Restless, mind racing" for the hall. Add a small phrase table per axis sign so the lines read like a person wrote them ("Heavy, but warm", "Calm, looking back", "Found it: looking ahead" for the destination).

## Matching

> Update 2026-11-04: the five axes below were replaced by six discovered from Claude's adjective ratings of the catalog (`scripts/rate.mjs`, `scripts/factor.py`, `src/data/axes.json`); statements are now 12 in the starting room and 7 elsewhere, tagged with the new axis ids. See docs/DECISIONS.md "Discovered axes".
>
> Update 2026-11-03: the shipped walk uses the Bayesian model in `src/lib/bayes.ts` (posterior per axis, Monte Carlo best-match belief, expected-information-gain doors, stop after three rooms when the expected regret of the pick is at most 0.08). The cosine similarity below is still the match score inside that model, and the in-app `/about` page documents it with the live numbers. Painting vectors beyond the 109 curated ones come from CLIP (`scripts/embed.py`). Routes come from A* on a walkable grid (`src/lib/routing.ts`).

Unchanged idea, better pool:
- Mood vector = average of answered statements per axis (existing `moodFromAnswers`).
- Door recommendation = cosine similarity against each room's affinity; show the top 3 as doors.
- Painting = cosine similarity against the curated paintings of the chosen room. Take the top 3 and pick one by a daily seed (hash of date + uid/guest id) so the same mood on a different day gives a different painting.
- Pool: expand `scripts/curated.json` to at least 10 public domain, on view, has-image paintings per room (80+ total). Use the Met search API to find candidates (`/search?q=...&hasImages=true&isOnView=true&departmentId=...`), then hand-write `mood`, `tags`, `why`, `galleryKey` for each. `npm run fetch:met` keeps pulling the live metadata. Commit the resulting `paintings.json`.
- Live refresh: on the Finding screen, fetch `/objects/{id}` once (cache in localStorage, key `mg.obj.<id>`, 7 days) to update GalleryNumber and image URLs. If the object is no longer on view, fall back to the next candidate.

## The 3D map (Final Stretch)

This is the one piece the Figma can only hint at. Read `docs/map-reference/` and `src/data/met_floorplan.json`.

- The floor plan JSON is traced from the Met's own map. Units are meters; x points toward Fifth Avenue, y points north, origin is the center of the Great Hall. `outline` is the building footprint; `floor1` and `floor2` are rooms as `x0,y0,x1,y1` rectangles (or `poly`). Flags: `dim` (exists, draw dimmed), `stairs` (Grand Staircase, draw as a ramp), `inner` (small block on top of its parent, e.g. gallery 822 inside the 19th-century block), `small` (no label). `exampleWalks` shows four real routes with their `visited`, `nxt`, `dest` keys and `route` waypoints.
- Build it with react-three-fiber. World units = meters, y up. Floor 1 plate at y=0, floor 2 plate at y=12 (34 when both floors are drawn). Each room is an extruded box 5m tall. A floor the walk did not use is only a faint outline of its footprint. Add the Fifth Avenue strip and a "CENTRAL PARK" / "FIFTH AVENUE" label pair like the reference renders.
- Colors (only these): canvas #2A2725, park strip #262422, street #3A3632, building plate #353230 with a Stone #E3DDD3 outline at 70%, other rooms #403C38 (sides #2F2C2A), dimmed rooms #373431 (sides #2C2927), visited rooms #7E1226 (sides #5C0E1C), next room #6B6661 (sides #4F4B47), destination #E4002B (sides #A8001F), stairs #B5AEA4, route and labels Plaster #F6F3EE.
- Route: a fat line through the waypoints. Behind the "You are here" marker it is thin, dashed and half transparent (where you have been); ahead of it, solid and bold (where you are going). Every room the line passes through carries a numbered Ink badge (1 = where the walk began, counted across both floors), so a route that doubles back along a corridor still reads in order. The line starts inside the room the walk began in. A walk that used both floors draws both: floor 2 is lifted to 34 m above floor 1 (an exploded view; the true gap is 12 m), its unvisited rooms and plate are ghosted so the floor below shows through, each floor carries its own part of the line, and a dashed segment joins them at the Grand Staircase. `routeFor` returns the final floor's route with the other floor's part as `other`. (Updated 2026-11-04; the original spec said one floor at a time, solid behind, dashed ahead.) "You are here" = Plaster dot with a soft halo at the last visited room; destination = Met Red pin with a Plaster dot, standing on the destination block. Small Plaster capsule markers at doorways between rooms are optional.
- Labels "You are here" and "Gallery 822" are HTML overlays (drei `<Html>`) that stay upright and follow their anchors. Other room names are not shown in the small card; they are shown in the example renders only for reference.
- Camera: OrbitControls, default = isometric-ish (azimuth 45°, polar ~55°), free orbit in every direction by drag or touch, a little zoom (0.8x–1.5x), auto-rotate slowly when idle, double-tap or the compass resets to default. The "Rotate" pill toggles auto-rotate; it is not a 90° stepper. The four Figma variants are just snapshots at 0/90/180/270 to show the agent what it looks like from each side.
- Route waypoints: compute from room centers in the floor plan, hall -> (stairs if floor 2) -> chosen room -> next room -> destination gallery. The example walks in the JSON show hand-tuned waypoints you can copy for those rooms.
- Keep it light: no shadows, no post-processing, `dpr` capped at 2, pause the render loop when the card is off screen.

## Firebase

- `users/{uid}/saves/{objectID}`: `{ objectID, title, artist, date, medium, imageUrl, imageLargeUrl, galleryNumber, museum: "met", moodVector, moodWords[3], route: [{ roomId, moodPhrase }], savedAt }`.
- `users/{uid}/walks/{walkId}`: `{ route, moodVector, paintingId, finishedAt }` (for the walks count).
- `shares/{shareId}`: the share card payload, `ownerUid`, `createdAt`.
- Rules: users can read/write only `users/{their uid}/**`; `shares` are world readable, writable by the owner only. Put the rules in `firebase/firestore.rules` in the repo even though they are deployed by hand.
- Guest storage keys: `mg.saves`, `mg.walks`, `mg.guestId` (random id for the daily seed).
- Auth persistence: local. Sign-out from the user menu on the gallery.

## States not drawn (build them anyway)

- Disabled primary buttons on room screens until all 3 statements are answered.
- Loading error on the Finding screen (see above).
- Image load failure on Your Painting: show a Stone placeholder with the title.
- Offline: the walk still works from the bundled `paintings.json`; only the live refresh is skipped.
- Share when the Web Share API is missing (desktop Chrome/Firefox): Story and Messages fall back to downloading the PNG and copying the link, with a 2s toast "Saved image, link copied".
- Gallery when Firebase is not configured: works as guest.
- Any route hit directly (e.g. `/painting` with no walk in memory) redirects to `/`.

## Things only Jovian can do (leave TODOs, do not block on them)

1. Create the Firebase project, enable Google and Email link sign-in, create a Firestore database, paste the rules, add `jovian.wang` to the authorized domains, and put the config in `.env.local` and in GitHub secrets.
2. Confirm the GitHub Pages source is "GitHub Actions".

## Definition of done

- `npm run build` and `npm run lint` pass with no warnings.
- Every screen above exists and matches its screenshot at 390px, and the desktop layout at 1440px.
- A full walk works with no network (bundled data) and with network (live refresh).
- The 3D map orbits freely with mouse and touch, auto-rotates when idle, and shows the correct rooms lit for whichever door was chosen.
- Share exports a 1080x1920 PNG that looks like the card, and `/w/:shareId` re-renders it.
- Save works as guest and as a signed-in user when Firebase env vars are present, and degrades cleanly when they are not.
- README updated: how to run, how to configure Firebase, how to add a room or a painting.
