const express = require('express');
const db = require('../db/db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

function getOwnedPlaylist(id, userId) {
  return db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(id, userId);
}

router.get('/', (req, res) => {
  const playlists = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS track_count
       FROM playlists p WHERE p.user_id = ? ORDER BY p.created_at DESC`
    )
    .all(req.session.userId);
  res.json({ playlists });
});

router.post('/', (req, res) => {
  const name = req.body && String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  const info = db
    .prepare('INSERT INTO playlists (user_id, name) VALUES (?, ?)')
    .run(req.session.userId, name);
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ playlist: { ...playlist, track_count: 0 } });
});

router.get('/:id', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const tracks = db
    .prepare(
      `SELECT t.*, pt.position FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       WHERE pt.playlist_id = ?
       ORDER BY pt.position ASC`
    )
    .all(playlist.id);

  res.json({ playlist, tracks });
});

router.patch('/:id', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(name, playlist.id);
  res.json({ playlist: db.prepare('SELECT * FROM playlists WHERE id = ?').get(playlist.id) });
});

router.delete('/:id', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare('DELETE FROM playlists WHERE id = ?').run(playlist.id);
  res.json({ ok: true });
});

router.post('/:id/tracks', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const trackId = req.body && req.body.trackId;
  const track = db
    .prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?')
    .get(trackId, req.session.userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const already = db
    .prepare('SELECT id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
    .get(playlist.id, track.id);
  if (already) return res.status(409).json({ error: 'Track is already in the playlist' });

  const row = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM playlist_tracks WHERE playlist_id = ?')
    .get(playlist.id);
  db.prepare('INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)').run(
    playlist.id,
    track.id,
    row.maxPos + 1
  );

  res.status(201).json({ ok: true });
});

router.delete('/:id/tracks/:trackId', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(
    playlist.id,
    req.params.trackId
  );
  res.json({ ok: true });
});

router.patch('/:id/reorder', (req, res) => {
  const playlist = getOwnedPlaylist(req.params.id, req.session.userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const trackIds = req.body && req.body.trackIds;
  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds must be an array' });
  }

  const update = db.prepare(
    'UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?'
  );
  const tx = db.transaction((ids) => {
    ids.forEach((trackId, index) => update.run(index, playlist.id, trackId));
  });
  tx(trackIds);

  res.json({ ok: true });
});

module.exports = router;
