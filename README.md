# MyTrackshelf

A minimalist, self-hosted music player with real user accounts.
Users upload their own audio files, organize them into playlists, mark
favorites, and play them back through a built-in player.

**Tech stack:** Node.js/Express, SQLite (`better-sqlite3`), session-based auth
(`express-session` + `connect-sqlite3` + `bcrypt`), `multer` for uploads,
vanilla JS frontend (ES modules, no build tool).

## Local installation

Requirement: Node.js >= 18.

```bash
npm install
```

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

At minimum, change `SESSION_SECRET` to your own random value.
`DATA_DIR` can stay at its default of `./data` locally — that's where the
SQLite database and all uploaded files are stored (the directory is created
automatically on startup).

Start the server in development mode (with automatic restarts on changes):

```bash
npm run dev
```

Or in normal mode:

```bash
npm start
```

The app is then available at [http://localhost:3000](http://localhost:3000).
On first visit you'll be redirected to the registration page.

## Deploying to Railway

1. **Connect the repository**
   Create a new project on [railway.app](https://railway.app) and link it to
   this repository via "Deploy from GitHub repo". Railway automatically
   detects the Node project from `package.json` and uses `npm start` as the
   start command.

2. **Create a persistent volume**
   In the Railway service, under the **Volumes** tab, create a new volume and
   mount it at, e.g., `/data`. Without this volume, every redeploy would wipe
   all accounts and uploaded songs, since the container filesystem isn't
   persistent.

3. **Set environment variables**
   Under **Variables**, add the following:

   | Variable         | Value                                  |
   | ---------------- | --------------------------------------- |
   | `SESSION_SECRET` | a long, random string                   |
   | `DATA_DIR`       | `/data` (or whichever mount path you chose) |
   | `NODE_ENV`       | `production`                            |

   `PORT` does **not** need to be set — Railway sets this value itself, and
   the server reads it automatically from `process.env.PORT`.

4. **Trigger a deploy**
   A push to the connected branch automatically triggers a new deploy.
   Railway builds the project, runs `npm install`, and then starts the
   server with `npm start`.

After the first successful deploy, the server automatically creates the
SQLite database and the `uploads/` folder inside `DATA_DIR` — no manual
setup step is required.

## Project structure

```
server/     Express backend (routes, middleware, database setup)
public/     Static vanilla JS frontend (HTML/CSS/JS as ES modules)
data/       Local SQLite database + uploads (git-ignored, configurable via DATA_DIR)
```
