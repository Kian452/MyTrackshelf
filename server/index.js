require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const { DATA_DIR } = require('./config');
require('./db/db'); // creates the database + schema if they don't exist yet

const authRoutes = require('./routes/auth');
const trackRoutes = require('./routes/tracks');
const playlistRoutes = require('./routes/playlists');
const favoriteRoutes = require('./routes/favorites');
const accountRoutes = require('./routes/account');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16)) {
  console.warn(
    'WARNING: SESSION_SECRET is not set or very short. Please set a long, random value in production.'
  );
}

// Required behind Railway's reverse proxy so secure cookies are set correctly.
app.set('trust proxy', 1);

app.use(express.json());

app.use(
  session({
    store: new SQLiteStore({ dir: DATA_DIR, db: 'sessions.sqlite' }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/tracks', trackRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/account', accountRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Trackshelf server listening on port ${PORT}`);
});
