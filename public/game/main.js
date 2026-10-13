E.init({ canvas: 'game', width: 480, height: 720 });

const BG = '#0a0a0a';
const ACCENT = '#a78bfa';
const MUTED = '#404040';
const WHITE = '#f5f3ff';
const SOFT = '#c4b5fd';
const HIT_LINE_Y = 610;
const LANE_X = E.W / 2;
const NOTE_R = 18;
const PERFECT = 0.22;
const GOOD = 0.42;
const MISS = 0.64;

const songs = [
  {
    id: 'midnight-pulse',
    title: 'Midnight Pulse',
    level: 1,
    bpm: 96,
    noteInterval: 0.62,
    pattern: [1, 1, 0.5, 1, 1, 0.5, 1.5, 0.5],
    totalNotes: 24,
    travelBeats: 3.2,
  },
  {
    id: 'neon-veil',
    title: 'Neon Veil',
    level: 2,
    bpm: 118,
    noteInterval: 0.48,
    pattern: [1, 0.5, 0.5, 1, 0.5, 1, 0.5, 0.5],
    totalNotes: 30,
    travelBeats: 2.8,
  },
  {
    id: 'blackout-run',
    title: 'Blackout Run',
    level: 3,
    bpm: 142,
    noteInterval: 0.36,
    pattern: [0.5, 0.5, 0.5, 1, 0.5, 0.5, 1, 0.5],
    totalNotes: 36,
    travelBeats: 2.4,
  },
];

const state = {
  topScores: {},
  selectedSongIndex: 0,
  scoreName: '',
  run: null,
};

const buttons = [];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pulse(speed = 350) { return 0.5 + 0.5 * Math.sin(performance.now() / speed); }
function songKey(songId) { return `song_${songId}`; }
function displayScoreName() { return state.scoreName || 'YOU'; }
function bestForSong(song) { return E.best.get(songKey(song.id)); }
function setBestForSong(song, score) { E.best.set(songKey(song.id), score); }
function normalizeName(name) {
  return String(name || '').replace(/[^a-z0-9 ]/gi, '').trim().slice(0, 12).toUpperCase();
}
function currentSong() { return songs[state.selectedSongIndex] || songs[0]; }
async function loadTopScores(song) { state.topScores[song.id] = await E.leaderboard.top(5, song.id); }
function registerButton(button) { buttons.push(button); }
function hitButton(x, y) { return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); }
function clearButtons() { buttons.length = 0; }

function drawPanel(x, y, w, h, alpha = 1) {
  E.ctx.globalAlpha = alpha;
  E.ctx.fillStyle = '#111111';
  E.ctx.beginPath();
  E.ctx.roundRect(x, y, w, h, 18);
  E.ctx.fill();
  E.ctx.strokeStyle = ACCENT;
  E.ctx.lineWidth = 2;
  E.ctx.stroke();
  E.ctx.globalAlpha = 1;
}

function drawButton(btn) {
  const fill = btn.kind === 'ghost' ? '#141414' : ACCENT;
  const text = btn.kind === 'ghost' ? WHITE : BG;
  E.draw.rrect(btn.x, btn.y, btn.w, btn.h, 14, fill);
  if (btn.kind === 'ghost') {
    E.ctx.strokeStyle = ACCENT;
    E.ctx.lineWidth = 2;
    E.ctx.strokeRect(btn.x + 1, btn.y + 1, btn.w - 2, btn.h - 2);
  }
  E.draw.text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1, { size: 18, color: text, align: 'center' });
}

function drawHeader(title, subtitle) {
  E.draw.text('RHYTHM SCROLL', 30, 42, { size: 18, color: ACCENT });
  E.draw.text(title, 30, 92, { size: 40, color: WHITE });
  E.draw.text(subtitle, 30, 126, { size: 16, color: '#b7b7b7', weight: 'normal' });
}

function makeRun(song) {
  const notes = [];
  let t = 1.8;
  for (let i = 0; i < song.totalNotes; i++) {
    const mult = song.pattern[i % song.pattern.length];
    notes.push({ at: t, hit: false, judged: false });
    t += song.noteInterval * mult;
  }
  return {
    song,
    time: 0,
    countdown: 3,
    notes,
    combo: 0,
    score: 0,
    hits: 0,
    misses: 0,
    done: false,
    resultSaved: false,
    rank: null,
  };
}

function accuracy(run) {
  const total = run.notes.length || 1;
  return Math.round((run.hits / total) * 100);
}

function judgeTap(run, preview = false) {
  const live = run.notes.filter((n) => !n.judged);
  if (!live.length) return false;
  let best = null;
  let bestDelta = Infinity;
  for (const note of live) {
    const delta = Math.abs(run.time - note.at);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = note;
    }
  }
  if (!best) return false;

  if (bestDelta <= PERFECT) {
    best.hit = true;
    best.judged = true;
    run.combo += 1;
    run.hits += 1;
    run.score += 120 + Math.min(run.combo * 8, 160);
    if (!preview) {
      E.sfx.coin();
      E.fx.burst(LANE_X, HIT_LINE_Y, { color: ACCENT, count: 14, speed: 180 });
      E.fx.text(LANE_X, HIT_LINE_Y - 48, 'PERFECT', WHITE);
    }
    return 'perfect';
  }
  if (bestDelta <= GOOD) {
    best.hit = true;
    best.judged = true;
    run.combo += 1;
    run.hits += 1;
    run.score += 80 + Math.min(run.combo * 5, 90);
    if (!preview) {
      E.sfx.tick();
      E.fx.burst(LANE_X, HIT_LINE_Y, { color: SOFT, count: 10, speed: 120 });
      E.fx.text(LANE_X, HIT_LINE_Y - 48, 'GOOD', SOFT);
    }
    return 'good';
  }
  if (!preview) {
    run.combo = 0;
    run.misses += 1;
    E.sfx.hit();
    E.fx.shake(7, 0.12);
    E.fx.text(LANE_X, HIT_LINE_Y - 48, 'MISS', '#8d8d8d');
  }
  return false;
}

function missExpiredNotes(run) {
  for (const note of run.notes) {
    if (!note.judged && run.time - note.at > MISS) {
      note.judged = true;
      run.combo = 0;
      run.misses += 1;
      E.sfx.hit();
      E.fx.text(LANE_X, HIT_LINE_Y - 44, 'MISS', '#8d8d8d');
    }
  }
}

function runFinished(run) {
  const allJudged = run.notes.every((n) => n.judged);
  return allJudged && run.time > run.notes[run.notes.length - 1].at + 0.9;
}

E.leaderboard.top = async function top(limit = 10, song = '') {
  try {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (song) qs.set('song', song);
    const r = await fetch(`/api/scores?${qs.toString()}`);
    return (await r.json()).scores || [];
  } catch {
    return [];
  }
};

E.leaderboard.submit = async function submit(name, score, song = '') {
  try {
    const r = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, song }),
    });
    return await r.json();
  } catch {
    return null;
  }
};

E.scene('menu', {
  async enter() {
    clearButtons();
    for (const song of songs) {
      if (!state.topScores[song.id]) await loadTopScores(song);
    }
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) btn.action();
  },
  onKey(k) {
    if (k === 'action') E.go('song-select');
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    drawHeader('Noir Tap Run', 'One lane. Tight timing. Harder levels every song.');

    drawPanel(24, 156, 432, 208);
    E.draw.text('Goal', 44, 184, { size: 18, color: ACCENT });
    E.draw.text('Hit the note as it crosses the line.', 44, 214, { size: 20, color: WHITE, weight: 'normal' });
    E.draw.text('Pick songs in level order and climb each chart.', 44, 246, { size: 16, color: '#b7b7b7', weight: 'normal' });
    E.draw.text('Phone-first touch control: tap anywhere on beat.', 44, 278, { size: 16, color: '#b7b7b7', weight: 'normal' });
    E.draw.text(`Current tag: ${displayScoreName()}`, 44, 320, { size: 16, color: SOFT, weight: 'normal' });

    const startBtn = { x: 36, y: 392, w: 408, h: 58, label: 'Start', action: () => { E.sfx.tick(); E.go('song-select'); } };
    const guideBtn = { x: 36, y: 464, w: 198, h: 52, label: 'How to Play', action: () => { E.sfx.tick(); E.go('how-to-play'); }, kind: 'ghost' };
    const scoresBtn = { x: 246, y: 464, w: 198, h: 52, label: 'High Scores', action: () => { E.sfx.tick(); E.go('high-scores'); }, kind: 'ghost' };
    [startBtn, guideBtn, scoresBtn].forEach(registerButton);
    [startBtn, guideBtn, scoresBtn].forEach(drawButton);

    drawPanel(24, 540, 432, 140, 0.95);
    E.draw.text('Level order', 44, 566, { size: 18, color: ACCENT });
    songs.forEach((song, index) => {
      E.draw.text(`${song.level}. ${song.title}`, 44, 598 + index * 24, { size: 17, color: index === state.selectedSongIndex ? WHITE : '#bdbdbd', weight: 'normal' });
      E.draw.text(`Best ${bestForSong(song)}`, 424, 598 + index * 24, { size: 15, color: SOFT, align: 'right', weight: 'normal' });
    });
  },
});

E.scene('song-select', {
  async enter() {
    clearButtons();
    await loadTopScores(currentSong());
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) return btn.action();
    songs.forEach((song, index) => {
      const top = 180 + index * 132;
      if (x >= 30 && x <= 450 && y >= top && y <= top + 108) {
        state.selectedSongIndex = index;
        loadTopScores(song);
        E.sfx.tick();
      }
    });
  },
  onSwipe(dir) {
    if (dir === 'up') state.selectedSongIndex = clamp(state.selectedSongIndex + 1, 0, songs.length - 1);
    if (dir === 'down') state.selectedSongIndex = clamp(state.selectedSongIndex - 1, 0, songs.length - 1);
  },
  onKey(k) {
    if (k === 'down' || k === 'right') state.selectedSongIndex = clamp(state.selectedSongIndex + 1, 0, songs.length - 1);
    if (k === 'up' || k === 'left') state.selectedSongIndex = clamp(state.selectedSongIndex - 1, 0, songs.length - 1);
    if (k === 'action') {
      state.run = makeRun(currentSong());
      E.go('gameplay');
    }
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    drawHeader('Song Select', 'Pick the next chart in level order.');

    songs.forEach((song, index) => {
      const y = 180 + index * 132;
      const active = index === state.selectedSongIndex;
      drawPanel(30, y, 420, 108, active ? 1 : 0.86);
      if (active) {
        E.draw.rrect(42, y + 16, 66, 28, 10, ACCENT);
        E.draw.text(`Level ${song.level}`, 75, y + 30, { size: 14, color: BG, align: 'center' });
      } else {
        E.draw.text(`Level ${song.level}`, 44, y + 30, { size: 14, color: SOFT });
      }
      E.draw.text(song.title, 44, y + 60, { size: 26, color: WHITE });
      E.draw.text(`${song.bpm} BPM`, 44, y + 88, { size: 15, color: '#b7b7b7', weight: 'normal' });
      E.draw.text(`${song.totalNotes} notes`, 220, y + 88, { size: 15, color: '#b7b7b7', weight: 'normal' });
      E.draw.text(`Best ${bestForSong(song)}`, 430, y + 88, { size: 15, color: SOFT, align: 'right', weight: 'normal' });
    });

    const backBtn = { x: 30, y: 610, w: 132, h: 52, label: 'Back', action: () => { E.sfx.tick(); E.go('menu'); }, kind: 'ghost' };
    const levelBtn = { x: 174, y: 610, w: 132, h: 52, label: 'Levels', action: () => { E.sfx.tick(); E.go('level-progress'); }, kind: 'ghost' };
    const playBtn = { x: 318, y: 610, w: 132, h: 52, label: 'Start Song', action: () => { E.sfx.tick(); state.run = makeRun(currentSong()); E.go('gameplay'); } };
    [backBtn, levelBtn, playBtn].forEach(registerButton);
    [backBtn, levelBtn, playBtn].forEach(drawButton);
  },
});

E.scene('level-progress', {
  enter() {
    clearButtons();
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) btn.action();
  },
  onKey(k) {
    if (k === 'action') E.go('song-select');
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    drawHeader('Level Progress', 'Each level tightens the rhythm without changing lanes.');

    drawPanel(24, 164, 432, 430);
    songs.forEach((song, index) => {
      const y = 206 + index * 122;
      const unlocked = index <= state.selectedSongIndex;
      E.draw.rrect(44, y - 12, 14, 14, 6, unlocked ? ACCENT : MUTED);
      if (index < songs.length - 1) {
        E.ctx.fillStyle = MUTED;
        E.ctx.fillRect(50, y + 10, 2, 80);
      }
      E.draw.text(`Level ${song.level}`, 84, y, { size: 16, color: ACCENT });
      E.draw.text(song.title, 84, y + 28, { size: 28, color: WHITE });
      E.draw.text('Faster patterns, denser note timing, same tap lane.', 84, y + 58, { size: 15, color: '#b7b7b7', weight: 'normal' });
      E.draw.text(`Best ${bestForSong(song)}`, 84, y + 84, { size: 15, color: SOFT, weight: 'normal' });
      E.draw.text(`${song.bpm} BPM`, 416, y + 28, { size: 15, color: '#b7b7b7', align: 'right', weight: 'normal' });
      E.draw.text(`${song.totalNotes} notes`, 416, y + 56, { size: 15, color: '#b7b7b7', align: 'right', weight: 'normal' });
    });

    const howBtn = { x: 30, y: 618, w: 132, h: 52, label: 'How to Play', action: () => { E.sfx.tick(); E.go('how-to-play'); }, kind: 'ghost' };
    const songsBtn = { x: 174, y: 618, w: 132, h: 52, label: 'Song Select', action: () => { E.sfx.tick(); E.go('song-select'); }, kind: 'ghost' };
    const playBtn = { x: 318, y: 618, w: 132, h: 52, label: 'Play Next', action: () => { E.sfx.tick(); state.run = makeRun(currentSong()); E.go('gameplay'); } };
    [howBtn, songsBtn, playBtn].forEach(registerButton);
    [howBtn, songsBtn, playBtn].forEach(drawButton);
  },
});

E.scene('how-to-play', {
  enter() {
    clearButtons();
    state.run = makeRun(songs[0]);
  },
  update(dt) {
    const run = state.run;
    if (!run) return;
    run.time += dt;
    const upcoming = run.notes.find((n) => !n.judged && Math.abs(n.at - run.time) < 0.02);
    if (upcoming) judgeTap(run, true);
    if (run.time > 5.2) state.run = makeRun(songs[0]);
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) return btn.action();
    if (state.run) judgeTap(state.run);
  },
  onKey(k) {
    if (k === 'action' && state.run) judgeTap(state.run);
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    drawHeader('How to Play', 'Learn the timing, then practice on the live lane.');

    drawPanel(24, 156, 432, 262);
    E.draw.text('1', 44, 188, { size: 18, color: ACCENT });
    E.draw.text('Wait for a note to cross the hit line near the bottom.', 74, 188, { size: 16, color: WHITE, weight: 'normal' });
    E.draw.text('2', 44, 232, { size: 18, color: ACCENT });
    E.draw.text('Tap anywhere on the screen right on the beat.', 74, 232, { size: 16, color: WHITE, weight: 'normal' });
    E.draw.text('3', 44, 276, { size: 18, color: ACCENT });
    E.draw.text('Perfect hits build combo and score. Misses break combo.', 74, 276, { size: 16, color: WHITE, weight: 'normal' });
    E.draw.text('Practice demo', 44, 328, { size: 18, color: ACCENT });
    E.draw.text('Tap now or watch the preview hit notes for you.', 44, 356, { size: 16, color: '#b7b7b7', weight: 'normal' });

    const previewTop = 438;
    E.draw.rrect(24, previewTop, 432, 210, 18, '#111111');
    drawLane(previewTop + 16, 178, state.run);

    const menuBtn = { x: 30, y: 664, w: 132, h: 42, label: 'Menu', action: () => { E.sfx.tick(); E.go('menu'); }, kind: 'ghost' };
    const songsBtn = { x: 174, y: 664, w: 132, h: 42, label: 'Song Select', action: () => { E.sfx.tick(); E.go('song-select'); }, kind: 'ghost' };
    const playBtn = { x: 318, y: 664, w: 132, h: 42, label: 'Start', action: () => { E.sfx.tick(); state.run = makeRun(currentSong()); E.go('gameplay'); } };
    [menuBtn, songsBtn, playBtn].forEach(registerButton);
    [menuBtn, songsBtn, playBtn].forEach(drawButton);
  },
});

E.scene('gameplay', {
  enter() {
    if (!state.run) state.run = makeRun(currentSong());
  },
  update(dt) {
    const run = state.run;
    if (!run || run.done) return;
    if (run.countdown > 0) {
      const before = Math.ceil(run.countdown);
      run.countdown = Math.max(0, run.countdown - dt);
      const after = Math.ceil(run.countdown);
      if (after !== before && after > 0) E.sfx.beep(540 + after * 80, 0.06, 'sine', 0.09);
      if (before > 0 && after === 0) E.sfx.coin();
      return;
    }
    run.time += dt;
    missExpiredNotes(run);
    if (runFinished(run)) {
      run.done = true;
      setBestForSong(run.song, run.score);
      E.go('results');
    }
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) return btn.action();
    const run = state.run;
    if (!run || run.countdown > 0 || run.done) return;
    judgeTap(run);
  },
  onKey(k) {
    if (k === 'action') {
      const run = state.run;
      if (!run || run.countdown > 0 || run.done) return;
      judgeTap(run);
    }
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    const run = state.run;
    drawHeader('Gameplay', `${run.song.title} · Level ${run.song.level}`);
    drawLane(164, 500, run);

    E.draw.text(`Score ${run.score}`, 36, 646, { size: 18, color: WHITE });
    E.draw.text(`Combo ${run.combo}`, 180, 646, { size: 18, color: SOFT });
    E.draw.text(`Accuracy ${accuracy(run)}%`, 328, 646, { size: 18, color: '#b7b7b7' });

    const restartBtn = { x: 30, y: 666, w: 132, h: 40, label: 'Restart', action: () => { E.sfx.tick(); state.run = makeRun(run.song); }, kind: 'ghost' };
    const songsBtn = { x: 174, y: 666, w: 132, h: 40, label: 'Songs', action: () => { E.sfx.tick(); E.go('song-select'); }, kind: 'ghost' };
    const tapBtn = { x: 318, y: 666, w: 132, h: 40, label: 'Tap', action: () => judgeTap(run) };
    [restartBtn, songsBtn, tapBtn].forEach(registerButton);
    [restartBtn, songsBtn, tapBtn].forEach(drawButton);

    if (run.countdown > 0) {
      const countText = Math.ceil(run.countdown);
      E.ctx.globalAlpha = 0.84;
      E.draw.rrect(140, 262, 200, 120, 18, '#111111');
      E.ctx.globalAlpha = 1;
      E.draw.text(countText > 0 ? String(countText) : 'GO', E.W / 2, 310, { size: 72, color: ACCENT, align: 'center' });
      E.draw.text('Get ready to tap the line.', E.W / 2, 360, { size: 16, color: WHITE, align: 'center', weight: 'normal' });
    }
  },
});

E.scene('results', {
  async enter() {
    const run = state.run;
    if (!run) return;
    state.selectedSongIndex = songs.findIndex((s) => s.id === run.song.id);
    if (!run.resultSaved) {
      const raw = prompt('Name for the high score list', state.scoreName || 'YOU');
      state.scoreName = normalizeName(raw) || state.scoreName || 'YOU';
      const res = await E.leaderboard.submit(state.scoreName, run.score, run.song.id);
      run.rank = res && res.rank ? res.rank : null;
      run.resultSaved = true;
      await loadTopScores(run.song);
      E.sfx.over();
    }
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) btn.action();
  },
  onKey(k) {
    if (k === 'action') {
      state.run = makeRun(currentSong());
      E.go('gameplay');
    }
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    const run = state.run;
    drawHeader('Run Complete', `${run.song.title} is done. Your score is in that song's board.`);

    drawPanel(24, 164, 432, 196);
    E.draw.text(`Score ${run.score}`, 44, 204, { size: 36, color: WHITE });
    E.draw.text(`Accuracy ${accuracy(run)}%`, 44, 246, { size: 18, color: SOFT });
    E.draw.text(`Hits ${run.hits} · Misses ${run.misses}`, 44, 282, { size: 18, color: '#b7b7b7', weight: 'normal' });
    E.draw.text(run.rank ? `Rank #${run.rank}` : 'Outside top 100', 44, 322, { size: 18, color: ACCENT });

    drawPanel(24, 382, 432, 206);
    E.draw.text(`${run.song.title} High Scores`, 44, 414, { size: 22, color: ACCENT });
    (state.topScores[run.song.id] || []).slice(0, 5).forEach((entry, index) => {
      E.draw.text(`${index + 1}. ${entry.name}`, 44, 454 + index * 28, { size: 18, color: WHITE, weight: 'normal' });
      E.draw.text(String(entry.score), 430, 454 + index * 28, { size: 18, color: SOFT, align: 'right', weight: 'normal' });
    });

    const retryBtn = { x: 30, y: 614, w: 132, h: 50, label: 'Restart', action: () => { E.sfx.tick(); state.run = makeRun(run.song); E.go('gameplay'); } };
    const scoresBtn = { x: 174, y: 614, w: 132, h: 50, label: 'High Scores', action: () => { E.sfx.tick(); E.go('high-scores'); }, kind: 'ghost' };
    const nextBtn = { x: 318, y: 614, w: 132, h: 50, label: 'Next Song', action: () => { E.sfx.tick(); state.selectedSongIndex = clamp(state.selectedSongIndex + 1, 0, songs.length - 1); state.run = makeRun(currentSong()); E.go('gameplay'); } };
    [retryBtn, scoresBtn, nextBtn].forEach(registerButton);
    [retryBtn, scoresBtn, nextBtn].forEach(drawButton);
  },
});

E.scene('high-scores', {
  async enter() {
    clearButtons();
    await loadTopScores(currentSong());
  },
  onTap(x, y) {
    const btn = hitButton(x, y);
    if (btn) return btn.action();
    songs.forEach((song, index) => {
      const x0 = 28 + index * 142;
      if (x >= x0 && x <= x0 + 132 && y >= 150 && y <= 196) {
        state.selectedSongIndex = index;
        loadTopScores(song);
        E.sfx.tick();
      }
    });
  },
  onKey(k) {
    if (k === 'left') state.selectedSongIndex = clamp(state.selectedSongIndex - 1, 0, songs.length - 1);
    if (k === 'right') state.selectedSongIndex = clamp(state.selectedSongIndex + 1, 0, songs.length - 1);
    if (k === 'action') E.go('song-select');
  },
  render() {
    clearButtons();
    E.draw.clear(BG);
    drawHeader('High Scores', 'Each song keeps its own ranking.');

    songs.forEach((song, index) => {
      const x = 28 + index * 142;
      E.draw.rrect(x, 150, 132, 46, 12, index === state.selectedSongIndex ? ACCENT : '#141414');
      E.draw.text(song.title, x + 66, 174, { size: 13, color: index === state.selectedSongIndex ? BG : WHITE, align: 'center' });
    });

    drawPanel(24, 220, 432, 326);
    const song = currentSong();
    const board = state.topScores[song.id] || [];
    E.draw.text(song.title, 44, 256, { size: 30, color: WHITE });
    E.draw.text(`Level ${song.level}`, 44, 290, { size: 16, color: ACCENT });
    if (!board.length) E.draw.text('No scores yet. Be the first to own this chart.', 44, 346, { size: 18, color: '#b7b7b7', weight: 'normal' });
    board.slice(0, 8).forEach((entry, index) => {
      const y = 336 + index * 28;
      E.draw.text(`${index + 1}. ${entry.name}`, 44, y, { size: 18, color: WHITE, weight: 'normal' });
      E.draw.text(String(entry.score), 430, y, { size: 18, color: SOFT, align: 'right', weight: 'normal' });
    });
    E.draw.text(`Your best ${bestForSong(song)}`, 44, 520, { size: 17, color: ACCENT });

    const menuBtn = { x: 30, y: 612, w: 132, h: 50, label: 'Menu', action: () => { E.sfx.tick(); E.go('menu'); }, kind: 'ghost' };
    const songsBtn = { x: 174, y: 612, w: 132, h: 50, label: 'Song Select', action: () => { E.sfx.tick(); E.go('song-select'); }, kind: 'ghost' };
    const playBtn = { x: 318, y: 612, w: 132, h: 50, label: 'Play', action: () => { E.sfx.tick(); state.run = makeRun(song); E.go('gameplay'); } };
    [menuBtn, songsBtn, playBtn].forEach(registerButton);
    [menuBtn, songsBtn, playBtn].forEach(drawButton);
  },
});

function drawLane(topY, height, run) {
  const laneX = 100;
  const laneW = 280;
  E.draw.rrect(laneX, topY, laneW, height, 20, '#101010');
  E.ctx.strokeStyle = MUTED;
  E.ctx.lineWidth = 2;
  E.ctx.strokeRect(laneX + 1, topY + 1, laneW - 2, height - 2);

  for (let i = 0; i < 6; i++) {
    const y = topY + 40 + i * 76;
    E.ctx.strokeStyle = '#1b1b1b';
    E.ctx.lineWidth = 1;
    E.ctx.beginPath();
    E.ctx.moveTo(laneX + 18, y);
    E.ctx.lineTo(laneX + laneW - 18, y);
    E.ctx.stroke();
  }

  const lineY = topY + height - 70;
  E.ctx.fillStyle = ACCENT;
  E.ctx.fillRect(laneX + 22, lineY, laneW - 44, 4);
  E.draw.text('TAP', E.W / 2, lineY + 26, { size: 18, color: ACCENT, align: 'center' });

  if (run) {
    const travelTime = (60 / run.song.bpm) * run.song.travelBeats;
    run.notes.forEach((note) => {
      const dt = note.at - run.time;
      const progress = 1 - dt / travelTime;
      if (progress < -0.1 || progress > 1.2 || note.hit) return;
      const y = topY + 30 + progress * (height - 120);
      const alpha = clamp(1 - Math.abs(dt) * 0.35, 0.18, 1);
      E.ctx.globalAlpha = alpha;
      E.draw.circle(LANE_X, y, NOTE_R + 6, 'rgba(167,139,250,0.18)');
      E.draw.circle(LANE_X, y, NOTE_R, note.judged ? MUTED : ACCENT);
      E.ctx.globalAlpha = 1;
    });
  }

  const tapPulse = 0.82 + pulse(240) * 0.18;
  E.ctx.globalAlpha = tapPulse;
  E.draw.circle(LANE_X, lineY + 2, 28, 'rgba(167,139,250,0.12)');
  E.ctx.globalAlpha = 1;
}

E.start('menu');
