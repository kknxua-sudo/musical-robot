# Lumin Music

An ad-free, Apple Music–inspired music streaming web app for demo projects and music you have the rights to use.

## What is included

- Responsive desktop, tablet, and mobile UI
- Home, Search, Library, and playlist navigation
- Registration and login with hashed passwords and JWT sessions
- Upload audio into a private server-side media store
- HTTP Range streaming for uploaded tracks
- Search across songs, albums, artists, and genres
- Create and manage user playlists
- Queue controls: play, pause, previous, next, shuffle, repeat, progress, and volume
- Synthesized demo previews for the included showcase catalog, so the demo is playable without bundling copyrighted recordings
- No advertising or third-party tracking UI

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm run dev
```

Open the Vite URL shown by the terminal. The Node API runs on port 3000 and Vite proxies `/api` to it during development.

For a production-style local run:

```bash
npm install
npm run build
npm start
```

The Express server will serve the built app from `dist/`.

## Storage and configuration

By default, uploaded files are written to `server/media` and user/playlist metadata is stored in `server/data/db.json`. Those paths are git-ignored. Set `JWT_SECRET` in production; the fallback value exists only to keep local setup frictionless.

For a real deployment, replace the file-based store with managed object storage and a database, add rate limiting, rotate secrets, enforce stronger authorization rules, and put the media endpoint behind authenticated CDN/object-storage access where appropriate.

## Music rights

This project intentionally does **not** ship commercial Apple Music recordings, Apple Music artwork, or Apple branding. Use only audio, cover art, metadata, and other media for which you have the necessary licenses or permissions. The synthesized previews are generated in-browser for demonstration purposes.

The UI is inspired by modern music streaming patterns but is not affiliated with Apple Inc. and should not be presented as an official Apple product.
