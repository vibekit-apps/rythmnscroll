const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // fits a base64 phone photo; shrink images client-side

// Health check — used by the platform to detect when the app is ready.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Global leaderboard (persists to lib/data/scores.json on EFS).
// The game's score submits are REAL — top scores survive restarts.
app.use('/api', require('./routes/scores'));

// Serve everything in /public as static files.
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
