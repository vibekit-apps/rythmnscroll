const express = require('express');
const scores = require('../lib/scores');

const router = express.Router();

// GET /api/scores?limit=10&song=night-drive — top scores, highest first.
router.get('/scores', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  const song = typeof req.query.song === 'string' ? req.query.song : '';
  res.json({ scores: scores.list(limit, song), song: song || null });
});

// POST /api/scores { name, score, song } — submit a run. Returns 1-based rank
// (null if outside the top 100 for that song) so the game can show ranking.
router.post('/scores', (req, res) => {
  const { name, score, song } = req.body || {};
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return res.status(400).json({ error: 'score must be a number' });
  }
  const { rank, entry } = scores.add(name, score, song);
  res.json({ ok: true, rank, entry });
});

module.exports = router;
