const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/db');

const router = express.Router();
const SALT_ROUNDS = 12;

function publicUser(u) {
  return { id: u.id, username: u.username, email: u.email, createdAt: u.created_at };
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    const usernameTrim = String(username).trim();
    const emailTrim = String(email).trim().toLowerCase();
    if (usernameTrim.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }
    if (!/^\S+@\S+\.\S+$/.test(emailTrim)) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .get(usernameTrim, emailTrim);
    if (existing) {
      return res.status(409).json({ error: 'Username or email is already in use' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const info = db
      .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
      .run(usernameTrim, emailTrim, passwordHash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      res.status(201).json({ user: publicUser(user) });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }
    const normalized = String(identifier).trim().toLowerCase();
    const user = db
      .prepare('SELECT * FROM users WHERE lower(username) = ? OR lower(email) = ?')
      .get(normalized, normalized);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      res.json({ user: publicUser(user) });
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: publicUser(user) });
});

module.exports = router;
