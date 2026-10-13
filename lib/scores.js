/**
 * Leaderboard store — JSON file at lib/data/scores.json (EFS-persisted,
 * survives restarts). Keeps the top 100 scores, sorted high-to-low.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'scores.json');
const MAX_ENTRIES = 100;

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function persist(scores) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
  fs.renameSync(tmp, FILE);
}

/** Top scores, highest first. */
function list(limit = 10) {
  return load().slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

/**
 * Add a score. Name is trimmed to 12 chars; score clamped to a sane
 * integer. Returns { rank, entry } — rank is 1-based, or null if the
 * score didn't make the top 100.
 */
function add(name, score) {
  const entry = {
    name: String(name || 'ANON').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 12) || 'ANON',
    score: Math.max(0, Math.min(Math.floor(Number(score) || 0), 1e9)),
    at: new Date().toISOString(),
  };
  const scores = load();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_ENTRIES);
  persist(trimmed);
  const rank = trimmed.indexOf(entry);
  return { rank: rank === -1 ? null : rank + 1, entry };
}

module.exports = { list, add };
