const express = require('express');
const db = require('../db/db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const tracks = db
    .prepare(
      `SELECT t.*, f.added_at AS favorited_at FROM favorites f
       JOIN tracks t ON t.id = f.track_id
       WHERE f.user_id = ?
       ORDER BY f.added_at DESC`
    )
    .all(req.session.userId);
  res.json({ tracks });
});

router.post('/:trackId', (req, res) => {
  const track = db
    .prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?')
    .get(req.params.trackId, req.session.userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  db.prepare('INSERT OR IGNORE INTO favorites (user_id, track_id) VALUES (?, ?)').run(
    req.session.userId,
    track.id
  );
  res.status(201).json({ ok: true });
});

router.delete('/:trackId', (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND track_id = ?').run(
    req.session.userId,
    req.params.trackId
  );
  res.json({ ok: true });
});

module.exports = router;
