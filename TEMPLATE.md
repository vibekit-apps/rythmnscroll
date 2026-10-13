# Template: Game

2D game engine with touch controls, sound, and a leaderboard

## What's already built and wired (do NOT rebuild it)

This is a working game starter: a small 2D canvas engine + a REAL server-side leaderboard, with a placeholder demo game ("Orb Dash") proving the wiring. REPLACE the demo with the user's game; KEEP the engine and the leaderboard.

What's wired:
- public/game/engine.js — reusable engine (global `E`, ~350 lines, read it before writing game code): fixed-timestep loop, scene manager (E.scene/E.go/E.start), unified input (keyboard arrows/WASD/space + touch: taps, swipes, hold-left/right-half via E.input.held), procedural WebAudio sfx (E.sfx.coin/hit/jump/over/beep — no audio files), particles + floating text + screen shake (E.fx), draw helpers, AABB/circle collision, localStorage best score, and a leaderboard client (E.leaderboard.top/submit).
- public/game/main.js — the demo game (menu/play/gameover scenes). THIS is the file to rewrite into the user's game.
- server.js + routes/scores.js + lib/scores.js — GET/POST /api/scores, top-100 JSON-file leaderboard on EFS (survives restarts).
- public/index.html — fullscreen mobile-locked canvas page (no scroll/zoom/select). Logical resolution 480x720, auto-letterboxed — game code never handles resize.

Game requests vary wildly — fit the approach to the genre:
- Real-time 2D (arcade, runner, flappy, snake, shooter, platformer): rewrite main.js on the engine.
- Turn-based / word / card / quiz / board games: a DOM+CSS page is often better than canvas — rebuild index.html freely, drop engine.js if unused, keep the leaderboard API.
- 3D: add three.js via a CDN <script> tag.
Non-negotiables for ANY genre: playable by TOUCH on a phone (most users are mobile) AND keyboard on desktop; all art procedural (canvas shapes, CSS, emoji/unicode sprites) — never reference image or audio files that don't exist; sound via E.sfx, not audio files.

The demo boots and is pre-installed. Build the user's actual game in the first turn — don't reskin the falling-orbs demo unless they literally asked for a catch-things game.

## Suggested features

- Touch + keyboard controls
- Menu / play / game-over scenes
- Score + best score
- Global leaderboard
- Particles + screen shake
- Procedural sound FX
- Mobile fullscreen

---

This starter already boots and is pre-installed — it is NOT a placeholder to replace. Follow the "what's already built" guidance above.

Do NOT deploy on your own initiative. Your FIRST real build publishes automatically once you commit it (the platform posts the live link) — end that turn with: "Changes saved, publishing your first version now." After that first publish, the user ships: they tap **Deploy** (the play icon only opens the app), or they ask you outright to deploy — then do it per TOOLS.md §Deploy. Close later build turns per AGENTS.md: the `[Live-state:]` line says whether a change is already live or needs Deploy.
