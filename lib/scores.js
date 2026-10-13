/**
 * Leaderboard store — JSON file at lib/data/scores.json (EFS-persisted,
 * survives restarts). Keeps the top 100 scores per song, sorted high-to-low.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'scores.json');
const MAX_ENTRIES = 100;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    if (Array.isArray(parsed)) return { global: parsed };
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persist(scoresBySong) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(scoresBySong, null, 2));
  fs.renameSync(tmp, FILE);
}

function keyForSong(song) {
  return String(song || 'global').replace(/[^a-z0-9-]/gi, '-').toLowerCase() || 'global';
}

/** Top scores, highest first, optionally per song. */
function list(limit = 10, song = '') {
  const key = keyForSong(song);
  const scoresBySong = load();
  const scores = Array.isArray(scoresBySong[key]) ? scoresBySong[key] : [];
  return scores.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

/**
 * Add a score. Name is trimmed to 12 chars; score clamped to a sane
 * integer. Returns { rank, entry } — rank is 1-based, or null if the
 * score didn't make the top 100 for that song.
 */
function add(name, score, song = '') {
  const key = keyForSong(song);
  const entry = {
    name: String(name || 'ANON').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 12) || 'ANON',
    song: key,
    score: Math.max(0, Math.min(Math.floor(Number(score) || 0), 1e9)),
    at: new Date().toISOString(),
  };
  const scoresBySong = load();
  const scores = Array.isArray(scoresBySong[key]) ? scoresBySong[key] : [];
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_ENTRIES);
  scoresBySong[key] = trimmed;
  persist(scoresBySong);
  const rank = trimmed.indexOf(entry);
  return { rank: rank === -1 ? null : rank + 1, entry };
}

module.exports = { list, add };
