/**
 * VK Engine — a small, dependency-free 2D canvas game engine.
 *
 * Everything a phone-first browser game needs, pre-solved:
 *   E.init(opts)          — canvas setup: logical resolution, HiDPI, letterbox scaling
 *   E.scene(name, def)    — scene manager (menu / play / gameover / anything)
 *   E.go(name)            — switch scenes
 *   E.input               — unified keyboard + touch (left/right/up/down/action, pointer, swipes)
 *   E.sfx                 — procedural WebAudio sound (no audio files needed)
 *   E.fx                  — particles, floating text, screen shake
 *   E.draw                — text / circle / rounded-rect helpers
 *   E.hit                 — AABB + circle collision
 *   E.best                — localStorage best-score helpers
 *   E.leaderboard         — client for the server's /api/scores leaderboard
 *
 * Games define scenes and call E.start(). See main.js for a complete example.
 * Coordinates are LOGICAL (default 480x720 portrait) — the engine scales to
 * fit any screen with letterboxing, so game code never thinks about resize.
 */
(function () {
  const E = {};
  window.E = E;

  // ---------------------------------------------------------------- canvas
  E.W = 480; E.H = 720;
  let canvas, ctx, scale = 1, offX = 0, offY = 0;

  E.init = function (opts = {}) {
    E.W = opts.width || 480;
    E.H = opts.height || 720;
    canvas = document.getElementById(opts.canvas || 'game');
    ctx = canvas.getContext('2d');
    E.ctx = ctx;
    E.canvas = canvas;
    window.addEventListener('resize', fit);
    fit();
    bindInput();
    return E;
  };

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    scale = Math.min(vw / E.W, vh / E.H);
    const cssW = Math.round(E.W * scale), cssH = Math.round(E.H * scale);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    offX = (vw - cssW) / 2; offY = (vh - cssH) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  }

  // ---------------------------------------------------------------- scenes
  const scenes = {};
  let current = null;

  // def: { enter(), exit(), update(dt), render(ctx), onTap(x,y), onSwipe(dir), onKey(key) }
  E.scene = (name, def) => { scenes[name] = def; };
  E.go = (name) => {
    if (current && current.exit) current.exit();
    current = scenes[name];
    E.sceneName = name;
    if (current.enter) current.enter();
  };

  // ------------------------------------------------------------------ loop
  const STEP = 1 / 60;
  let last = 0, acc = 0, running = false;

  E.start = function (firstScene) {
    E.go(firstScene);
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };

  function tick(now) {
    if (!running) return;
    // Clamp: a backgrounded tab returns with a huge delta — don't simulate it.
    acc += Math.min((now - last) / 1000, 0.25);
    last = now;
    while (acc >= STEP) {
      if (current.update) current.update(STEP);
      updateFx(STEP);
      E.input._endFrame();
      acc -= STEP;
    }
    ctx.save();
    if (shake.t > 0) ctx.translate((Math.random() - 0.5) * shake.mag, (Math.random() - 0.5) * shake.mag);
    if (current.render) current.render(ctx);
    renderFx(ctx);
    ctx.restore();
    requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; }
    else if (!running) { running = true; last = performance.now(); acc = 0; requestAnimationFrame(tick); }
  });

  // ----------------------------------------------------------------- input
  // Unified controls. Keyboard: arrows + WASD + space. Touch: taps, swipes,
  // and hold-side-of-screen (left/right halves) for steering games.
  const keys = {};
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'action', Enter: 'action',
  };
  E.input = {
    pointer: { x: 0, y: 0, down: false },
    /** true while the named control (left/right/up/down/action) is held.
     *  Touch: holding the left/right half of the screen maps to left/right. */
    held(name) {
      if (keys[name]) return true;
      const p = E.input.pointer;
      if (p.down && name === 'left' && p.x < E.W / 2) return true;
      if (p.down && name === 'right' && p.x >= E.W / 2) return true;
      return false;
    },
    _tapped: null, _swiped: null,
    _endFrame() { E.input._tapped = null; E.input._swiped = null; },
  };

  let touchStart = null;

  function toLogical(e) {
    const t = e.touches ? (e.touches[0] || e.changedTouches[0]) : e;
    return { x: (t.clientX - offX) / scale, y: (t.clientY - offY) / scale };
  }

  function bindInput() {
    window.addEventListener('keydown', (e) => {
      const name = KEYMAP[e.code];
      if (name) { e.preventDefault(); keys[name] = true; }
      if (current && current.onKey) current.onKey(name || e.code);
    });
    window.addEventListener('keyup', (e) => {
      const name = KEYMAP[e.code];
      if (name) keys[name] = false;
    });
    const downEv = (e) => {
      e.preventDefault();
      unlockAudio();
      const p = toLogical(e);
      E.input.pointer.x = p.x; E.input.pointer.y = p.y; E.input.pointer.down = true;
      touchStart = { ...p, t: performance.now() };
    };
    const moveEv = (e) => {
      const p = toLogical(e);
      E.input.pointer.x = p.x; E.input.pointer.y = p.y;
    };
    const upEv = (e) => {
      e.preventDefault();
      const p = toLogical(e);
      E.input.pointer.down = false;
      if (touchStart) {
        const dx = p.x - touchStart.x, dy = p.y - touchStart.y;
        const dist = Math.hypot(dx, dy), dt = performance.now() - touchStart.t;
        if (dist < 20 && dt < 400) {
          E.input._tapped = p;
          if (current && current.onTap) current.onTap(p.x, p.y);
        } else if (dist >= 40) {
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          E.input._swiped = dir;
          if (current && current.onSwipe) current.onSwipe(dir);
        }
        touchStart = null;
      }
    };
    canvas.addEventListener('touchstart', downEv, { passive: false });
    canvas.addEventListener('touchmove', moveEv, { passive: false });
    canvas.addEventListener('touchend', upEv, { passive: false });
    canvas.addEventListener('mousedown', downEv);
    canvas.addEventListener('mousemove', moveEv);
    canvas.addEventListener('mouseup', upEv);
  }

  // ----------------------------------------------------------------- audio
  // Procedural WebAudio — no sound files. Unlocked on first interaction
  // (browser autoplay policy).
  let actx = null;
  function unlockAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    }
    if (actx.state === 'suspended') actx.resume();
  }

  function beep(freq, dur, type = 'square', vol = 0.15, slide = 0) {
    if (!actx || actx.state !== 'running') return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  }

  E.sfx = {
    beep,
    coin: () => { beep(880, 0.08, 'square', 0.12); setTimeout(() => beep(1320, 0.12, 'square', 0.12), 60); },
    jump: () => beep(300, 0.15, 'square', 0.12, 300),
    hit: () => beep(160, 0.25, 'sawtooth', 0.2, -100),
    over: () => { beep(400, 0.2, 'triangle', 0.15, -150); setTimeout(() => beep(250, 0.35, 'triangle', 0.15, -120), 180); },
    tick: () => beep(660, 0.05, 'sine', 0.08),
  };

  // -------------------------------------------------------------------- fx
  const particles = [], floaters = [];
  const shake = { t: 0, mag: 0 };

  E.fx = {
    /** Particle burst at (x,y). opts: { count, color, speed, life, size } */
    burst(x, y, opts = {}) {
      const n = opts.count || 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const sp = (opts.speed || 140) * (0.5 + Math.random() * 0.8);
        particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: opts.life || 0.6, max: opts.life || 0.6,
          color: opts.color || '#a78bfa', size: opts.size || 4,
        });
      }
    },
    /** Floating text (e.g. "+10") that rises and fades. */
    text(x, y, str, color = '#fff') {
      floaters.push({ x, y, str, color, life: 0.9, max: 0.9 });
    },
    shake(mag = 8, dur = 0.25) { shake.mag = mag; shake.t = dur; },
  };

  function updateFx(dt) {
    if (shake.t > 0) shake.t -= dt;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y -= 50 * dt; f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  function renderFx(c) {
    for (const p of particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;
    for (const f of floaters) {
      c.globalAlpha = Math.max(0, f.life / f.max);
      E.draw.text(f.str, f.x, f.y, { size: 20, color: f.color, align: 'center' });
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ draw
  E.draw = {
    text(str, x, y, opts = {}) {
      ctx.font = `${opts.weight || 'bold'} ${opts.size || 16}px ${opts.font || "'Courier New', monospace"}`;
      ctx.fillStyle = opts.color || '#fff';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'middle';
      ctx.fillText(str, x, y);
    },
    circle(x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    },
    rrect(x, y, w, h, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    },
    clear(color = '#0a0a0f') {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, E.W, E.H);
    },
  };

  // ------------------------------------------------------------- collision
  E.hit = {
    aabb: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    circles: (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r,
  };

  // --------------------------------------------------------------- storage
  E.best = {
    get(key = 'best') { try { return Number(localStorage.getItem('vk_' + key)) || 0; } catch { return 0; } },
    set(key, val) {
      if (val === undefined) { val = key; key = 'best'; }
      try {
        const prev = E.best.get(key);
        if (val > prev) { localStorage.setItem('vk_' + key, String(val)); return true; }
      } catch { /* private mode */ }
      return false;
    },
  };

  // ----------------------------------------------------------- leaderboard
  // Talks to this app's own server (routes/scores.js). Fails silently so
  // the game never breaks if the network hiccups.
  E.leaderboard = {
    async top(limit = 10) {
      try {
        const r = await fetch(`/api/scores?limit=${limit}`);
        return (await r.json()).scores || [];
      } catch { return []; }
    },
    async submit(name, score) {
      try {
        const r = await fetch('/api/scores', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, score }),
        });
        return await r.json(); // { ok, rank, entry }
      } catch { return null; }
    },
  };
})();
