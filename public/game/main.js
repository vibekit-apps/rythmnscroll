/**
 * DEMO GAME — "Orb Dash". A placeholder that exercises every engine
 * feature (scenes, touch+keyboard input, sfx, particles, shake, best
 * score, leaderboard). REPLACE this file with the real game; keep
 * engine.js and the leaderboard wiring.
 *
 * Catch the glowing orbs, dodge the red spikes. Hold left/right (keys
 * or either half of the screen) to move.
 */
E.init({ canvas: 'game', width: 480, height: 720 });

const PURPLE = '#a78bfa', RED = '#f87171', GOLD = '#fbbf24';
let score = 0, lives = 3, speed = 1, player, drops, spawnT, topScores = [];

// ------------------------------------------------------------------- menu
E.scene('menu', {
  async enter() { topScores = await E.leaderboard.top(5); },
  onTap() { E.sfx.tick(); E.go('play'); },
  onKey(k) { if (k === 'action') { E.sfx.tick(); E.go('play'); } },
  render() {
    E.draw.clear();
    E.draw.text('ORB DASH', E.W / 2, 150, { size: 48, color: PURPLE, align: 'center' });
    E.draw.text('catch orbs · dodge spikes', E.W / 2, 200, { size: 16, color: '#9ca3af', align: 'center' });
    E.draw.text(`best: ${E.best.get()}`, E.W / 2, 250, { size: 18, color: GOLD, align: 'center' });
    if (topScores.length) {
      E.draw.text('— top pilots —', E.W / 2, 320, { size: 14, color: '#6b7280', align: 'center' });
      topScores.forEach((s, i) => {
        E.draw.text(`${i + 1}. ${s.name}  ${s.score}`, E.W / 2, 350 + i * 26, { size: 15, color: '#d1d5db', align: 'center' });
      });
    }
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
    E.ctx.globalAlpha = pulse;
    E.draw.text('tap or press space to start', E.W / 2, 560, { size: 18, color: '#fff', align: 'center' });
    E.ctx.globalAlpha = 1;
  },
});

// ------------------------------------------------------------------- play
E.scene('play', {
  enter() {
    score = 0; lives = 3; speed = 1; drops = []; spawnT = 0;
    player = { x: E.W / 2, y: E.H - 80, r: 18 };
  },
  update(dt) {
    const move = 340 * dt;
    if (E.input.held('left')) player.x -= move;
    if (E.input.held('right')) player.x += move;
    player.x = Math.max(player.r, Math.min(E.W - player.r, player.x));

    speed += dt * 0.03; // slow difficulty ramp
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 0.55 / speed;
      const bad = Math.random() < 0.35;
      drops.push({ x: 30 + Math.random() * (E.W - 60), y: -20, r: bad ? 14 : 12, bad, vy: (160 + Math.random() * 120) * speed });
    }

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.y += d.vy * dt;
      if (d.y > E.H + 30) { drops.splice(i, 1); continue; }
      if (E.hit.circles(player, d)) {
        drops.splice(i, 1);
        if (d.bad) {
          lives--;
          E.sfx.hit(); E.fx.shake(10, 0.3);
          E.fx.burst(d.x, d.y, { color: RED, count: 16 });
          if (lives <= 0) E.go('over');
        } else {
          score += 10;
          E.sfx.coin();
          E.fx.burst(d.x, d.y, { color: PURPLE });
          E.fx.text(d.x, d.y - 20, '+10', GOLD);
        }
      }
    }
  },
  render() {
    E.draw.clear();
    // drops
    for (const d of drops) {
      if (d.bad) {
        // spiky diamond
        const c = E.ctx;
        c.fillStyle = RED;
        c.beginPath();
        c.moveTo(d.x, d.y - d.r); c.lineTo(d.x + d.r, d.y); c.lineTo(d.x, d.y + d.r); c.lineTo(d.x - d.r, d.y);
        c.closePath(); c.fill();
      } else {
        E.draw.circle(d.x, d.y, d.r + 4, 'rgba(167,139,250,0.25)');
        E.draw.circle(d.x, d.y, d.r, PURPLE);
      }
    }
    // player ship
    E.draw.circle(player.x, player.y, player.r, '#fff');
    E.draw.circle(player.x, player.y, player.r - 6, PURPLE);
    // HUD
    E.draw.text(`${score}`, 20, 34, { size: 28 });
    E.draw.text('♥'.repeat(Math.max(0, lives)), E.W - 20, 34, { size: 22, color: RED, align: 'right' });
  },
});

// -------------------------------------------------------------- game over
let submitted = false;
E.scene('over', {
  enter() {
    submitted = false;
    E.sfx.over();
    E.best.set(score);
  },
  async onTap(x, y) {
    // "submit score" button zone
    if (!submitted && y > 380 && y < 440) {
      submitted = true;
      const name = (prompt('Name for the leaderboard? (3-12 chars)') || 'ANON').slice(0, 12);
      const res = await E.leaderboard.submit(name, score);
      if (res && res.rank) alert(`You're #${res.rank} on the leaderboard!`);
      return;
    }
    E.go('menu');
  },
  onKey(k) { if (k === 'action') E.go('menu'); },
  render() {
    E.draw.clear();
    E.draw.text('GAME OVER', E.W / 2, 200, { size: 42, color: RED, align: 'center' });
    E.draw.text(`score: ${score}`, E.W / 2, 270, { size: 26, align: 'center' });
    E.draw.text(`best: ${E.best.get()}`, E.W / 2, 310, { size: 18, color: GOLD, align: 'center' });
    if (!submitted) {
      E.draw.rrect(E.W / 2 - 110, 385, 220, 50, 12, PURPLE);
      E.draw.text('submit to leaderboard', E.W / 2, 410, { size: 15, color: '#0a0a0f', align: 'center' });
    }
    E.draw.text('tap anywhere else for menu', E.W / 2, 500, { size: 15, color: '#9ca3af', align: 'center' });
  },
});

E.start('menu');
