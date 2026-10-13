# Game Starter

A 2D browser game starter: small canvas engine, touch + keyboard controls,
procedural sound, and a real server-side leaderboard. A demo game ("Orb
Dash") proves the wiring — it's meant to be replaced with your game.

## Layout

- `server.js` — Express: static `/public` + leaderboard API + `/health`.
- `routes/scores.js` — `GET/POST /api/scores` (top-100 leaderboard).
- `lib/scores.js` — JSON-file score store at `lib/data/scores.json` (persists across restarts).
- `public/index.html` — fullscreen, mobile-locked canvas page.
- `public/game/engine.js` — the engine (`window.E`): game loop, scenes, input, sfx, particles, collision, best-score, leaderboard client. **Keep this.**
- `public/game/main.js` — the demo game. **Replace this** with your game's scenes.

## Engine cheat sheet

```js
E.init({ canvas: 'game', width: 480, height: 720 }); // logical coords, auto-scales
E.scene('play', { enter, update(dt), render(ctx), onTap(x,y), onSwipe(dir), onKey(k) });
E.go('play'); E.start('menu');
E.input.held('left'|'right'|'up'|'down'|'action')  // keys AND touch halves
E.sfx.coin() / .hit() / .jump() / .over() / .beep(freq, dur)
E.fx.burst(x, y, {color}) / .text(x, y, '+10') / .shake()
E.draw.clear() / .text() / .circle() / .rrect()
E.hit.circles(a, b) / E.hit.aabb(a, b)
E.best.get() / E.best.set(score)
await E.leaderboard.top(10) / E.leaderboard.submit(name, score)
```

Not every game needs canvas — turn-based, word, card, or quiz games can be
plain DOM/CSS pages instead; keep the leaderboard API either way. For 3D,
add three.js via a CDN `<script>` tag.
