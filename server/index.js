import express from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'server', 'data');
const MEDIA_DIR = path.join(ROOT, 'server', 'media');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'lumin-local-secret-change-me';

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], tracks: [], playlists: [] }, null, 2));
}
const readDb = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDb = (db) => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const safeUser = (u) => ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });
const auth = (req, res, next) => {
  const raw = req.headers.authorization || '';
  if (!raw.startsWith('Bearer ')) return res.status(401).json({ message: 'Authentication required.' });
  try {
    req.user = jwt.verify(raw.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Session expired.' });
  }
};

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, MEDIA_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 75 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = /^audio\/(mpeg|mp3|wav|ogg|webm|mp4|aac|flac)$/i.test(file.mimetype) || /\.(mp3|wav|ogg|webm|m4a|aac|flac)$/i.test(file.originalname);
    cb(allowed ? null : new Error('Audio files only.'), allowed);
  }
});

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'dist')));

app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name || password.length < 6) return res.status(400).json({ message: 'Name, email, and a 6+ character password are required.' });
  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'An account with that email already exists.' });
  const user = { id: crypto.randomUUID(), email: email.toLowerCase().trim(), name: name.trim(), passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDb(db);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: safeUser(user) });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: safeUser(user) });
});

app.get('/api/me', auth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: safeUser(user) });
});

app.get('/api/tracks', (_, res) => {
  const db = readDb();
  const tracks = db.tracks.map(t => ({ ...t, streamUrl: t.filename ? `/api/stream/${t.id}` : null }));
  res.json({ tracks });
});

app.post('/api/tracks', auth, upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose an audio file.' });
  const db = readDb();
  const track = {
    id: crypto.randomUUID(),
    title: String(req.body.title || path.parse(req.file.originalname).name).trim(),
    artist: String(req.body.artist || 'Your Library').trim(),
    album: String(req.body.album || 'Uploads').trim(),
    genre: String(req.body.genre || 'Uploaded').trim(),
    artwork: ['linear-gradient(135deg,#c084fc,#ec4899)', 'linear-gradient(135deg,#60a5fa,#2563eb)', 'linear-gradient(135deg,#fb7185,#f97316)'][db.tracks.length % 3],
    filename: req.file.filename,
    size: req.file.size,
    ownerId: req.user.id,
    uploadedAt: new Date().toISOString()
  };
  db.tracks.unshift(track);
  writeDb(db);
  res.status(201).json({ track: { ...track, streamUrl: `/api/stream/${track.id}` } });
});

app.get('/api/stream/:id', (req, res) => {
  const db = readDb();
  const track = db.tracks.find(t => t.id === req.params.id);
  if (!track?.filename) return res.status(404).end();
  const filePath = path.join(MEDIA_DIR, track.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  const ext = path.extname(filePath).toLowerCase();
  const types = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac' };
  res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
  if (!range) return res.status(200).set('Content-Length', stat.size).sendFile(filePath);
  const [startText, endText] = range.replace(/bytes=/, '').split('-');
  const start = Number(startText);
  const end = endText ? Number(endText) : stat.size - 1;
  const chunk = end - start + 1;
  res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': chunk });
  fs.createReadStream(filePath, { start, end }).pipe(res);
});

app.get('/api/playlists', auth, (req, res) => {
  const db = readDb();
  const playlists = db.playlists.filter(p => p.ownerId === req.user.id).map(p => ({ ...p, tracks: p.trackIds.map(id => db.tracks.find(t => t.id === id)).filter(Boolean) }));
  res.json({ playlists });
});

app.post('/api/playlists', auth, (req, res) => {
  const name = String(req.body?.name || 'New Playlist').trim();
  const db = readDb();
  const playlist = { id: crypto.randomUUID(), name, ownerId: req.user.id, trackIds: [], createdAt: new Date().toISOString() };
  db.playlists.unshift(playlist);
  writeDb(db);
  res.status(201).json({ playlist: { ...playlist, tracks: [] } });
});

app.post('/api/playlists/:id/tracks', auth, (req, res) => {
  const db = readDb();
  const playlist = db.playlists.find(p => p.id === req.params.id && p.ownerId === req.user.id);
  const track = db.tracks.find(t => t.id === req.body?.trackId);
  if (!playlist || !track) return res.status(404).json({ message: 'Playlist or track not found.' });
  if (!playlist.trackIds.includes(track.id)) playlist.trackIds.push(track.id);
  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/playlists/:id/tracks/:trackId', auth, (req, res) => {
  const db = readDb();
  const playlist = db.playlists.find(p => p.id === req.params.id && p.ownerId === req.user.id);
  if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
  playlist.trackIds = playlist.trackIds.filter(id => id !== req.params.trackId);
  writeDb(db);
  res.json({ ok: true });
});

app.delete('/api/playlists/:id', auth, (req, res) => {
  const db = readDb();
  const before = db.playlists.length;
  db.playlists = db.playlists.filter(p => !(p.id === req.params.id && p.ownerId === req.user.id));
  writeDb(db);
  res.json({ ok: db.playlists.length !== before });
});

app.use((error, _req, res, _next) => res.status(400).json({ message: error.message || 'Request failed.' }));
app.get('*', (_, res) => res.sendFile(path.join(ROOT, 'dist', 'index.html')));
app.listen(PORT, '0.0.0.0', () => console.log(`Lumin server running on ${PORT}`));
