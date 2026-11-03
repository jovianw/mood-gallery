# Prompt for the coding agent

Paste the block below as the first message. If the agent has the Figma MCP, leave the Figma line in; otherwise delete it.

---

Build out the full Mood Gallery website in this repo. Start by reading CLAUDE.md, then docs/HANDOFF.md end to end, then look at every screenshot in docs/figma/ and the renders in docs/map-reference/. The Figma file is https://www.figma.com/design/nSVuNxpCWCq0PzudTkcPZh (page "Mood Walk"); use get_design_context on the node ids in the handoff whenever you need exact spacing, sizes or colors.

The repo currently has an older, partial version of the design. Keep the routing setup, tokens, matching math and the curated painting pipeline, and bring everything else up to the handoff. The end state is a complete, working site: all 12 screens, the freely rotatable 3D route map on the Final Stretch, the real share image and share links, Firebase sign-in with a personal gallery (working as guest when Firebase is not configured), the loading and error states, and the desktop layout.

Work in this order and commit after each step so I can review as you go:

1. Data: rooms (8 rooms, 3 statements each, 5 mood axes), expanded curated paintings (10+ per room, public domain, on view, with images), met_floorplan.json wired into the app.
2. Screens 1 to 4 and 6 pixel-matched to the screenshots at 390px, including the disabled button states and the breadcrumb header. Statement scale is single select.
3. Final Stretch with the three.js / react-three-fiber map (OrbitControls, free orbit in any direction, auto-rotate when idle, Rotate pill toggles auto-rotate, the palette in the handoff, route line, You are here marker, destination pin, HTML labels).
4. Finding screen with real loading and error states.
5. Share screen: story card with the painting-derived gradient, the Strava style route map, PNG export at 1080x1920, Web Share, Save image, Copy link, and the /w/:shareId read-only page.
6. Firebase auth + Firestore saves + My Gallery (and its empty state), guest fallback, guest-to-account merge prompt.
7. Choose museum sheet, desktop layout, transitions, reduced motion, direct-URL redirects.
8. README, .env.example, firebase/firestore.rules, lint and build clean.

Check your own work: run the dev server and screenshot each screen at 390x844 and compare against docs/figma/ before you call a step done. If something in the handoff is impossible or contradicts the screenshots, pick the option closest to the screenshot, leave a short note in docs/DECISIONS.md, and keep going. Do not ask me questions unless you are truly blocked; make the sensible call and write it down.

Leave TODO comments where Firebase config or GitHub secrets are needed; I will fill those in.
