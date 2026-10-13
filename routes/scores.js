const express = require('express');
const scores = require('../lib/scores');

const router = express.Router();

// GET /api/scores?limit=10 — top scores, highest first.
router.get('/scores', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json({ scores: scores.list(limit) });
});

// POST /api/scores { name, score } — submit a run. Returns 1-based rank
// (null if outside the top 100) so the game can show "You're #3!".
router.post('/scores', (req, res) => {
  const { name, score } = req.body || {};
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return res.status(400).json({ error: 'score must be a number' });
  }
  const { rank, entry } = scores.add(name, score);
  res.json({ ok: true, rank, entry });
});

module.exports = router;
