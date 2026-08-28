const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('../db/db');
const requireAuth = require('../middleware/requireAuth');
const { UPLOADS_DIR, COVERS_DIR } = require('../config');

const router = express.Router();
router.use(requireAuth);
const SALT_ROUNDS = 12;

router.patch('/', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  const username = req.body.username !== undefined ? String(req.body.username).trim() : user.username;
  const email =
    req.body.email !== undefined ? String(req.body.email).trim().toLowerCase() : user.email;

  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  const conflict = db
    .prepare('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?')
    .get(username, email, user.id);
  if (conflict) {
    return res.status(409).json({ error: 'Username or email is already in use' });
  }

  db.prepare('UPDATE users SET username = ?, email = ? WHERE id = ?').run(username, email, user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  res.json({ user: { id: updated.id, username: updated.username, email: updated.email } });
});

router.patch('/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/', (req, res, next) => {
  const userId = req.session.userId;
  const tracks = db.prepare('SELECT * FROM tracks WHERE user_id = ?').all(userId);

  for (const track of tracks) {
    fs.unlink(path.join(UPLOADS_DIR, track.filename), () => {});
    if (track.cover_path) fs.unlink(path.join(COVERS_DIR, track.cover_path), () => {});
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

module.exports = router;
