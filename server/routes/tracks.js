const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../db/db');
const requireAuth = require('../middleware/requireAuth');
const { upload } = require('../middleware/upload');
const { UPLOADS_DIR, COVERS_DIR } = require('../config');

const router = express.Router();
router.use(requireAuth);

// music-metadata has been ESM-only since v8; load it once via a dynamic
// import() from this CommonJS module and cache the result.
let musicMetadataPromise;
function loadMusicMetadata() {
  if (!musicMetadataPromise) musicMetadataPromise = import('music-metadata');
  return musicMetadataPromise;
}

function getOwnedTrack(id, userId) {
  return db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, userId);
}

router.get('/', (req, res) => {
  const tracks = db
    .prepare('SELECT * FROM tracks WHERE user_id = ? ORDER BY uploaded_at DESC, id DESC')
    .all(req.session.userId);
  res.json({ tracks });
});

router.post('/upload', (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    if (err) {
      const message =
        err.message === 'UNSUPPORTED_FILE_TYPE'
          ? 'Unsupported file type. Allowed: mp3, wav, ogg, m4a, flac'
          : err.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the 50 MB limit'
          : 'Upload failed';
      return res.status(400).json({ error: message });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files received' });
    }

    const results = [];
    for (const file of files) {
      let title = path.basename(file.originalname, path.extname(file.originalname));
      let artist = null;
      let album = null;
      let duration = null;
      let coverPath = null;

      try {
        const mm = await loadMusicMetadata();
        const metadata = await mm.parseFile(file.path, { duration: true });
        if (metadata.common.title) title = metadata.common.title;
        if (metadata.common.artist) artist = metadata.common.artist;
        if (metadata.common.album) album = metadata.common.album;
        if (metadata.format.duration) duration = metadata.format.duration;
        const picture = metadata.common.picture && metadata.common.picture[0];
        if (picture) {
          const ext = picture.format && picture.format.includes('png') ? '.png' : '.jpg';
          const coverFilename = `${crypto.randomUUID()}${ext}`;
          fs.writeFileSync(path.join(COVERS_DIR, coverFilename), picture.data);
          coverPath = coverFilename;
        }
      } catch (metaErr) {
        // ID3 tags are a nice-to-have - the upload must not fail because of this.
      }

      const info = db
        .prepare(
          `INSERT INTO tracks (user_id, title, artist, album, duration_seconds, filename, original_filename, mime_type, file_size, cover_path)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          req.session.userId,
          title,
          artist,
          album,
          duration,
          file.filename,
          file.originalname,
          file.mimetype,
          file.size,
          coverPath
        );
      results.push(db.prepare('SELECT * FROM tracks WHERE id = ?').get(info.lastInsertRowid));
    }

    res.status(201).json({ tracks: results });
  });
});

router.patch('/:id', (req, res) => {
  const track = getOwnedTrack(req.params.id, req.session.userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const title = req.body.title !== undefined ? String(req.body.title).trim() : track.title;
  const artist =
    req.body.artist !== undefined ? String(req.body.artist).trim() || null : track.artist;

  if (!title) return res.status(400).json({ error: 'Title cannot be empty' });

  db.prepare('UPDATE tracks SET title = ?, artist = ? WHERE id = ?').run(title, artist, track.id);
  res.json({ track: db.prepare('SELECT * FROM tracks WHERE id = ?').get(track.id) });
});

router.delete('/:id', (req, res) => {
  const track = getOwnedTrack(req.params.id, req.session.userId);
  if (!track) return res.status(404).json({ error: 'Track not found' });

  db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id);

  fs.unlink(path.join(UPLOADS_DIR, track.filename), () => {});
  if (track.cover_path) {
    fs.unlink(path.join(COVERS_DIR, track.cover_path), () => {});
  }

  res.json({ ok: true });
});

router.get('/:id/stream', (req, res) => {
  const track = getOwnedTrack(req.params.id, req.session.userId);
  if (!track) return res.status(404).end();

  const filePath = path.join(UPLOADS_DIR, track.filename);
  fs.stat(filePath, (err, stat) => {
    if (err) return res.status(404).end();

    const range = req.headers.range;
    if (!range) {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': track.mime_type,
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (!match) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': track.mime_type,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  });
});

router.get('/:id/cover', (req, res) => {
  const track = getOwnedTrack(req.params.id, req.session.userId);
  if (!track || !track.cover_path) return res.status(404).end();
  res.sendFile(path.join(COVERS_DIR, track.cover_path));
});

module.exports = router;
