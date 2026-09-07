require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const rateLimit = require("express-rate-limit");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const store = require("./mysql/store");
const music = require("./services/music");
const storage = require("./services/storage");

const app = express();
const PORT = process.env.PORT || 4000;

// In production always set JWT_SECRET (see .env.example). The random fallback
// keeps local dev safe but invalidates existing tokens on restart.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const TOKEN_TTL = "30d";
const LEGACY_MUSIC_DIR = storage.LEGACY_MUSIC_DIR;

// CORS — restrict to known origins in production via CORS_ORIGINS (comma-separated).
const corsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length ? {
  origin: corsOrigins,
  allowedHeaders: ["Content-Type", "Authorization", "Range"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposedHeaders: ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"],
} : { exposedHeaders: ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"] }));
app.use(express.json({ limit: "120mb" }));

// ─── Rate limiting ───────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, try again later." },
});
app.use("/api", apiLimiter);

// ─── Static media ────────────────────────────────────────────────
storage.ensureDirs();
storage.ensurePlaceholders();
app.use("/uploads", express.static(storage.UPLOADS_DIR));

// ─── Auth helpers ────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign({ id: String(user.id), email: user.email }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.id == null) return null;
    return await store.findUserById(payload.id);
  } catch (e) {
    return null;
  }
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  userFromToken(token).then((user) => {
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    req.user = user;
    next();
  }).catch(() => res.status(401).json({ error: "Not authenticated" }));
}

// Attach req.user if a valid token is present, but never block.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  userFromToken(header.startsWith("Bearer ") ? header.slice(7) : null)
    .then((user) => { req.user = user || undefined; next(); })
    .catch(() => next());
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function requireUploader(req, res, next) {
  if (!req.user || !["admin", "artist"].includes(req.user.role)) {
    return res.status(403).json({ error: "Admin or artist access required" });
  }
  next();
}

function publicUser(user) {
  return {
    id: String(user.id), email: user.email, name: user.name, createdAt: user.created_at,
    role: user.role || "user",
  };
}

function annotate(song, s) {
  return {
    ...song,
    liked: s.likes.has(song.id),
    downloaded: s.downloads.has(song.id),
  };
}

// ─── Scoped user data helpers ────────────────────────────────────
let anonLikes = new Set();
let anonDownloads = new Set();
let anonPlaylists = [];

// recent searches are session-level, keyed by user id (kept in memory only)
const recentSearchCache = new Map();

async function scope(req) {
  if (!req.user) return { likes: anonLikes, downloads: anonDownloads, userId: null };
  const [likes, downloads] = await Promise.all([
    store.likedSongIds(req.user.id),
    store.downloadedSongIds(req.user.id),
  ]);
  return { likes, downloads, userId: req.user.id };
}

async function toggleScopeLike(req, s, songId) {
  const id = Number(songId);
  if (req.user) return store.toggleLike(req.user.id, id || songId);
  if (s.likes.has(id)) s.likes.delete(id); else s.likes.add(id);
  return s.likes.has(id);
}

async function addScopeDownload(req, s, songId) {
  const id = Number(songId);
  if (req.user) return store.addDownload(req.user.id, id || songId);
  s.downloads.add(id);
}

async function removeScopeDownload(req, s, songId) {
  const id = Number(songId);
  if (req.user) return store.removeDownload(req.user.id, id || songId);
  s.downloads.delete(id);
}

async function seedDefaultPlaylist(userId) {
  const existing = await store.userPlaylists(userId);
  if (existing.length > 0) return;
  const first = await store.listSongs({ limit: 6, sort: "plays" });
  if (first.length === 0) return;
  const id = await store.createPlaylist(userId, { name: "My First Mix", description: "Your starter playlist" });
  for (const s of first) await store.addSongToPlaylist(id, s.id);
}

async function resolvePlaylists(req) {
  if (req.user) {
    await seedDefaultPlaylist(req.user.id);
    return store.userPlaylists(req.user.id);
  }
  return anonPlaylists;
}

// Expand a playlist row into the JSON shape the frontend expects ({ ...pl, songs }). 
async function playlistSongsFor(pl, userId) {
  let songs;
  if (userId) {
    songs = await store.playlistSongs(pl.id);
  } else {
    const ids = pl.songIds || [];
    const found = await Promise.all(ids.map((id) => store.getSong(id)));
    songs = found.filter(Boolean);
  }
  const s = { likes: new Set(), downloads: new Set() };
  const annotated = songs.map((x) => annotate(x, s));
  return { ...pl, songs: annotated, cover: pl.cover || annotated[0]?.cover || null };
}

// ─── Auth Routes ─────────────────────────────────────────────────
app.post("/api/auth/register", authLimiter, async (req, res) => {
  try {
    const { email, name, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await store.findUserByEmail(normalizedEmail)) return res.status(409).json({ error: "An account with that email already exists" });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await store.createUser({ email: normalizedEmail, name, passwordHash });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await store.findUserByEmail(String(email || "").trim().toLowerCase());
    if (!user) return res.status(401).json({ error: "No account found with that email" });
    const ok = await bcrypt.compare(String(password || ""), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Incorrect password" });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ─── Local / Library Routes ─────────────────────────────────────
app.get("/api/songs", optionalAuth, async (req, res) => {
  const { genre, search, sort, language, limit } = req.query;
  const s = await scope(req);
  let result = await store.listSongs({ genre: genre || undefined, search: search || undefined, language: language || undefined, sort, limit });
  res.json(result.map((x) => annotate(x, s)));
});

app.get("/api/songs/featured", optionalAuth, async (req, res) => {
  const s = await scope(req);
  res.json((await store.listSongs({ featured: true })).map((x) => annotate(x, s)));
});

app.get("/api/songs/:id", optionalAuth, async (req, res) => {
  const { id } = req.params;
  const s = await scope(req);
  let song = await store.getSong(id);
  if (!song) {
    song = { id, title: id.replace(/^[a-z]+-/, "").replace(/-/g, " "), artist: "Unknown", duration: 0, plays: 0 };
  } else {
    song = await store.songJson(id);
    await store.incrementPlays(id);
    if (req.user) await store.addHistory(req.user.id, id);
  }
  res.json(annotate(song, s));
});

app.post("/api/songs/:id/like", optionalAuth, async (req, res) => {
  const s = await scope(req);
  const liked = await toggleScopeLike(req, s, req.params.id);
  res.json({ liked });
});

app.post("/api/songs/:id/download", optionalAuth, async (req, res) => {
  const s = await scope(req);
  await addScopeDownload(req, s, req.params.id);
  res.json({ downloaded: true });
});

app.delete("/api/songs/:id/download", optionalAuth, async (req, res) => {
  const s = await scope(req);
  await removeScopeDownload(req, s, req.params.id);
  res.json({ downloaded: false });
});

app.get("/api/downloads", optionalAuth, async (req, res) => {
  const s = await scope(req);
  const songs = req.user
    ? await store.downloadedSongs(req.user.id)
    : (await store.listSongs({ limit: 200 })).filter((x) => s.downloads.has(x.id));
  res.json(songs.map((x) => annotate(x, s)));
});

app.get("/api/genres", async (req, res) => {
  const genres = await store.listGenres();
  res.json(["All", ...genres]);
});

app.get("/api/stats", optionalAuth, async (req, res) => {
  const s = await scope(req);
  const base = await store.stats();
  let totalLiked = req.user ? (await store.userStats(req.user.id)).totalLiked : s.likes.size;
  let totalDownloaded = req.user ? (await store.userStats(req.user.id)).totalDownloaded : s.downloads.size;
  res.json({ ...base, totalLiked, totalDownloaded });
});

// ─── Stream (HTTP Range) ─────────────────────────────────────────
app.get("/api/stream/:id", async (req, res) => {
  try {
    const song = await store.getSong(req.params.id);
    if (!song) return res.status(404).json({ error: "Song not found" });
    const filePath = storage.resolveMediaPath(song.audio_path);
    if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ error: "Audio file not found" });
    const stat = fs.statSync(filePath);
    const total = stat.size;
    const mime = storage.mimeForFile(filePath);
    res.set("Accept-Ranges", "bytes");
    res.set("Content-Type", mime);
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(String(range).trim());
      let start = null, end = null;
      if (m && m[1]) {
        start = parseInt(m[1], 10);
        end = m[2] ? parseInt(m[2], 10) : total - 1;
      } else if (m && m[2]) {
        const suffix = parseInt(m[2], 10);
        start = Math.max(total - suffix, 0);
        end = total - 1;
      }
      if (start === null || start >= total || start > end) {
        res.status(416).set("Content-Range", `bytes */${total}`).end();
        return;
      }
      end = Math.min(end, total - 1);
      res.status(206);
      res.set("Content-Range", `bytes ${start}-${end}/${total}`);
      res.set("Content-Length", String(end - start + 1));
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.set("Content-Length", String(total));
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Playlists ───────────────────────────────────────────────────
app.get("/api/playlists", optionalAuth, async (req, res) => {
  const pls = await resolvePlaylists(req);
  const out = [];
  for (const pl of pls) out.push(await playlistSongsFor(pl, req.user?.id));
  res.json(out);
});

app.get("/api/playlists/public", async (req, res) => {
  const all = await store.publicPlaylists();
  const out = [];
  for (const pl of all) out.push(await playlistSongsFor(pl, null));
  res.json(all.map((pl, i) => ({ ...out[i], owner: pl.owner })));
});

app.post("/api/playlists", optionalAuth, async (req, res) => {
  const pl = {
    name: req.body.name || "New Playlist",
    description: req.body.description || "",
    cover: req.body.cover || null,
    songIds: [],
    public: !!req.body.public,
  };
  if (req.user) {
    const id = await store.createPlaylist(req.user.id, {
      name: pl.name, description: pl.description, cover: pl.cover, isPublic: pl.public,
    });
    if (Array.isArray(req.body.songIds)) for (const sid of req.body.songIds) await store.addSongToPlaylist(id, sid);
    const created = await store.getPlaylist(id);
    res.status(201).json(await playlistSongsFor(created, req.user.id));
  } else {
    const anon = { id: uuidv4(), ...pl, createdAt: new Date().toISOString() };
    anonPlaylists.push(anon);
    res.status(201).json(await playlistSongsFor(anon, null));
  }
});

app.patch("/api/playlists/:id", optionalAuth, async (req, res) => {
  if (req.user) {
    const pl = await store.getPlaylist(req.params.id);
    if (!pl || pl.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    const patch = {};
    if ("name" in req.body) patch.name = req.body.name || pl.name;
    if ("description" in req.body) patch.description = req.body.description || "";
    if ("cover" in req.body) patch.cover_image = req.body.cover || null;
    if ("public" in req.body) patch.is_public = !!req.body.public;
    await store.updatePlaylist(req.params.id, patch);
    res.json(await playlistSongsFor(await store.getPlaylist(req.params.id), req.user.id));
  } else {
    const pl = anonPlaylists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Not found" });
    if ("name" in req.body) pl.name = req.body.name || pl.name;
    if ("description" in req.body) pl.description = req.body.description || "";
    if ("cover" in req.body) pl.cover = req.body.cover || null;
    if ("public" in req.body) pl.public = !!req.body.public;
    res.json(await playlistSongsFor(pl, null));
  }
});

app.post("/api/playlists/:id/reorder", optionalAuth, async (req, res) => {
  if (req.user) {
    const pl = await store.getPlaylist(req.params.id);
    if (!pl || pl.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    if (Array.isArray(req.body.songIds)) await store.setPlaylistOrder(req.params.id, req.body.songIds);
    res.json(await playlistSongsFor(await store.getPlaylist(req.params.id), req.user.id));
  } else {
    const pl = anonPlaylists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Not found" });
    if (Array.isArray(req.body.songIds)) pl.songIds = req.body.songIds.map(Number);
    res.json(await playlistSongsFor(pl, null));
  }
});

app.post("/api/playlists/:id/songs", optionalAuth, async (req, res) => {
  const songId = Number(req.body.songId);
  if (req.user) {
    const pl = await store.getPlaylist(req.params.id);
    if (!pl || pl.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    await store.addSongToPlaylist(req.params.id, songId);
    res.json(await playlistSongsFor(await store.getPlaylist(req.params.id), req.user.id));
  } else {
    const pl = anonPlaylists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Not found" });
    if (!pl.songIds.includes(songId)) pl.songIds.push(songId);
    res.json(await playlistSongsFor(pl, null));
  }
});

app.delete("/api/playlists/:id", optionalAuth, async (req, res) => {
  if (req.user) {
    const pl = await store.getPlaylist(req.params.id);
    if (!pl || pl.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    await store.deletePlaylist(req.params.id);
  } else {
    const idx = anonPlaylists.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    anonPlaylists.splice(idx, 1);
  }
  res.json({ ok: true });
});

app.delete("/api/playlists/:id/songs/:songId", optionalAuth, async (req, res) => {
  if (req.user) {
    const pl = await store.getPlaylist(req.params.id);
    if (!pl || pl.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
    await store.removeSongFromPlaylist(req.params.id, Number(req.params.songId));
    res.json(await playlistSongsFor(await store.getPlaylist(req.params.id), req.user.id));
  } else {
    const pl = anonPlaylists.find((p) => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: "Not found" });
    pl.songIds = pl.songIds.filter((id) => Number(id) !== Number(req.params.songId));
    res.json(await playlistSongsFor(pl, null));
  }
});

// ─── History / Recently Played ───────────────────────────────────
app.post("/api/history/play", optionalAuth, async (req, res) => {
  const song = req.body?.song;
  if (!song || !song.id || !song.title) return res.status(400).json({ error: "song is required" });
  try {
    if (req.user) await store.addHistory(req.user.id, Number(song.id));
    await store.incrementPlays(song.id);
  } catch (e) {
    // history/logging must never break playback
  }
  res.json({ ok: true });
});

app.get("/api/recently-played", optionalAuth, async (req, res) => {
  if (!req.user) return res.json([]);
  res.json(await store.recentHistory(req.user.id));
});

app.delete("/api/recently-played/:id", optionalAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required" });
  await store.deleteHistoryEntry(req.user.id, Number(req.params.id));
  res.json({ ok: true });
});

app.delete("/api/recently-played", optionalAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in required" });
  await store.clearHistory(req.user.id);
  res.json({ ok: true });
});

// ─── Profile scoped endpoints ────────────────────────────────────
app.get("/api/users/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get("/api/users/me/history", auth, async (req, res) => {
  res.json(await store.recentHistory(req.user.id));
});

app.get("/api/users/me/favorites", auth, async (req, res) => {
  const s = await scope(req);
  res.json((await store.likedSongs(req.user.id)).map((x) => annotate(x, s)));
});

// ─── Follow artists / save albums ────────────────────────────────
app.post("/api/artists/:name/follow", auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  let artistId = await store.artistByName(name);
  if (!artistId) artistId = await store.upsertArtist(name);
  await store.followArtist(req.user.id, artistId);
  res.json({ followed: true });
});

app.delete("/api/artists/:name/follow", auth, async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const artistId = await store.artistByName(name);
  await store.unfollowArtist(req.user.id, artistId);
  res.json({ followed: false });
});

app.post("/api/albums/:id/save", auth, async (req, res) => {
  const body = req.body || {};
  let albumId = Number(req.params.id);
  const existing = await store.getAlbum(albumId);
  if (!existing) {
    const artistId = body.artist ? await store.artistByName(String(body.artist)) : null;
    albumId = await store.upsertAlbum(body.name || "Single", artistId, { cover_image: body.cover });
  }
  await store.saveAlbum(req.user.id, albumId);
  res.json({ saved: true, id: String(albumId) });
});

app.delete("/api/albums/:id/save", auth, async (req, res) => {
  await store.unsaveAlbum(req.user.id, Number(req.params.id));
  res.json({ saved: false });
});

// ─── Library umbrella ────────────────────────────────────────────
app.get("/api/library", optionalAuth, async (req, res) => {
  const s = await scope(req);
  const likedSongs = req.user
    ? (await store.likedSongs(req.user.id)).map((x) => annotate(x, s))
    : (await store.listSongs({ limit: 200 })).filter((x) => s.likes.has(x.id)).map((x) => annotate(x, s));
  const playlists = [];
  for (const pl of await resolvePlaylists(req)) playlists.push(await playlistSongsFor(pl, req.user?.id));
  res.json({
    likedSongs,
    playlists,
    recentlyPlayed: req.user ? await store.recentHistory(req.user.id) : [],
    followedArtists: req.user ? await store.followedArtists(req.user.id) : [],
    savedAlbums: req.user ? await store.savedAlbums(req.user.id) : [],
  });
});

// ─── Artists / Albums browse ─────────────────────────────────────
app.get("/api/artists", optionalAuth, async (req, res) => {
  const { q = "", limit = 30 } = req.query;
  res.json(await store.listArtists({ q, limit }));
});

app.get("/api/artists/:id", optionalAuth, async (req, res) => {
  const artist = await store.getArtist(req.params.id);
  if (!artist) return res.status(404).json({ error: "Artist not found" });
  const songs = await store.listSongs({ artistId: artist.id });
  res.json({ artist, songs });
});

app.get("/api/albums", optionalAuth, async (req, res) => {
  const { q = "", limit = 30 } = req.query;
  res.json(await store.listAlbums({ q, limit }));
});

app.get("/api/albums/:id", optionalAuth, async (req, res) => {
  const album = await store.getAlbum(req.params.id);
  if (!album) return res.status(404).json({ error: "Album not found" });
  const songs = await store.listSongs({ albumId: album.id });
  res.json({ album, songs });
});

// ─── Unified search ──────────────────────────────────────────────
app.get("/api/search", optionalAuth, async (req, res) => {
  const { q = "", limit = 20 } = req.query;
  const s = await scope(req);
  const [songs, artists, albums, genres] = await Promise.all([
    store.searchSongs(q, limit),
    store.listArtists({ q, limit: 6 }),
    store.listAlbums({ q, limit: 6 }),
    store.listGenres(),
  ]);
  res.json({
    songs: songs.map((x) => annotate(x, s)),
    artists: artists.slice(0, 6),
    albums: albums.slice(0, 6),
    genres: genres.filter((g) => g.toLowerCase().includes(q.toLowerCase())).slice(0, 6),
  });
});

// ─── Music discovery ─────────────────────────────────────────────
app.get("/api/music/languages", (req, res) => res.json(music.LANGUAGES));
app.get("/api/music/genres", (req, res) => res.json(music.GENRES));

app.get("/api/music/search", optionalAuth, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    const s = await scope(req);
    const [songs, artists, albums] = await Promise.all([
      store.searchSongs(q || "", limit),
      store.listArtists({ q: q || "", limit: 6 }),
      store.listAlbums({ q: q || "", limit: 6 }),
    ]);
    res.json({
      songs: songs.map((x) => annotate(x, s)),
      artists: artists.slice(0, 6),
      albums: albums.slice(0, 6),
      suggestions: music.searchSuggestions(q, req.user?.id ? recentSearchCache.get(req.user.id) || [] : []),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/suggestions", optionalAuth, (req, res) => {
  const { q = "" } = req.query;
  res.json({ queries: music.searchSuggestions(q, req.user?.id ? recentSearchCache.get(req.user.id) || [] : []) });
});

app.post("/api/music/recent-search", auth, (req, res) => {
  const q = (req.body?.q || "").toString().trim().slice(0, 60);
  if (!q) return res.json({ ok: true });
  const list = [q].concat((recentSearchCache.get(req.user.id) || []).filter((x) => x !== q)).slice(0, 8);
  recentSearchCache.set(req.user.id, list);
  res.json({ ok: true });
});

app.get("/api/music/trending", optionalAuth, async (req, res) => {
  try {
    const s = await scope(req);
    const limit = Math.min(parseInt(req.query.limit) || 15, 100);
    res.json((await store.listSongs({ sort: "plays", limit })).map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/new-releases", optionalAuth, async (req, res) => {
  try {
    const s = await scope(req);
    const limit = Math.min(parseInt(req.query.limit) || 15, 100);
    res.json((await store.listSongs({ sort: "recent", limit })).map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/language", optionalAuth, async (req, res) => {
  try {
    const s = await scope(req);
    const { lang = "nepali", limit = 25 } = req.query;
    const label = music.languageLabel(lang).label;
    res.json((await store.listSongs({ language: label, limit })).map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/genre", optionalAuth, async (req, res) => {
  try {
    const s = await scope(req);
    const { name = "pop", limit = 25 } = req.query;
    res.json((await store.listSongs({ genre: name, limit })).map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/artists", optionalAuth, async (req, res) => {
  try {
    const { q = "", limit = 30 } = req.query;
    res.json(await store.listArtists({ q, limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/albums", optionalAuth, async (req, res) => {
  try {
    const { q = "", limit = 30 } = req.query;
    res.json(await store.listAlbums({ q, limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/artist", optionalAuth, async (req, res) => {
  try {
    const s = await scope(req);
    const { name = "", limit = 30 } = req.query;
    const artistId = await store.artistByName(name);
    if (!artistId) return res.json([]);
    res.json((await store.listSongs({ artistId, limit })).map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/music/album", optionalAuth, async (req, res) => {
  try {
    const { name = "", artist = "", limit = 30 } = req.query;
    const artistId = artist ? await store.artistByName(artist) : null;
    const albumId = await store.albumByName(name, artistId);
    if (!albumId) return res.json([]);
    res.json(await store.listSongs({ albumId, limit }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Recommendations ─────────────────────────────────────────────
app.get("/api/recommendations", optionalAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const s = await scope(req);
    const preferGenres = new Set();
    const preferLanguages = new Set();
    const preferArtists = new Set();
    const recentIds = new Set();

    if (req.user) {
      const history = await store.recentHistory(req.user.id, 100);
      for (const h of history) {
        recentIds.add(h.id);
        if (h.genre) preferGenres.add(h.genre);
        if (h.language) preferLanguages.add(h.language);
        if (h.artist) preferArtists.add(h.artist);
      }
      const liked = await store.likedSongs(req.user.id);
      for (const l of liked) {
        if (l.genre) preferGenres.add(l.genre);
        if (l.language) preferLanguages.add(l.language);
        if (l.artist) preferArtists.add(l.artist);
      }
    }

    const pool = await store.listSongs({ limit: 200 });
    const rank = (x) => {
      let n = 0;
      if (preferGenres.has(x.genre)) n += 3;
      if (preferLanguages.has(x.language)) n += 3;
      if (preferArtists.has(x.artist)) n += 2;
      n += Math.min((x.plays || 0) / 10000, 5);
      if (recentIds.has(x.id)) n -= 3;
      return n;
    };
    const out = pool.filter((x) => !recentIds.has(x.id))
      .sort((a, b) => rank(b) - rank(a))
      .slice(0, limit);
    res.json(out.map((x) => annotate(x, s)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Uploads / Content Management ────────────────────────────────
function sanitizeSongInput(body) {
  return {
    title: String(body.title || "").trim().slice(0, 150),
    artist: String(body.artist || "").trim().slice(0, 120),
    album: String(body.album || "Single").trim().slice(0, 150),
    genre: String(body.genre || "Other").trim().slice(0, 60),
    language: String(body.language || "Other").trim().slice(0, 60),
    duration: parseInt(body.duration) || 0,
    year: parseInt(body.year) || new Date().getFullYear(),
    cover: body.cover || null,
    featured: !!body.featured,
    license: body.license === "Artist-uploaded" && body.licenseConfirmed
      ? "Artist-uploaded"
      : String(body.license || "Owned").slice(0, 60),
    plays: parseInt(body.plays) || 0,
  };
}

function base64Upload(dataUri, defaultMime, maxBytes) {
  if (!dataUri) return null;
  const raw = String(dataUri);
  let buffer, mime = defaultMime;
  const m = raw.match(/^data:([^;]+);base64,(.+)$/);
  if (m) { mime = m[1]; buffer = Buffer.from(m[2], "base64"); }
  else buffer = Buffer.from(raw, "base64");
  if (!buffer.length || buffer.length > maxBytes) return null;
  return { buffer, mime };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024, files: 2 },
  fileFilter(req, file, cb) {
    const ok = file.fieldname === "audio"
      ? storage.isAudioMime(file.mimetype)
      : String(file.mimetype).startsWith("image/");
    cb(null, ok);
  },
});

async function createSongRecord(req, mode) {
  const body = req.body || {};
  const input = sanitizeSongInput(body);
  if (!input.title) return { error: { status: 400, message: "Title is required" } };
  if (input.license === "Artist-uploaded" && !body.licenseConfirmed) {
    return { error: { status: 400, message: "Please confirm you own or have permission to distribute this audio" } };
  }

  // ── audio: multipart file, base64 JSON, or a direct media URL ──
  let audioPath = null;
  if (req.files?.audio?.[0]) {
    audioPath = await storage.saveAudio(req.files.audio[0].buffer, req.files.audio[0].mimetype);
  } else if (body.audioBase64) {
    const up = base64Upload(body.audioBase64, "audio/mpeg", 30 * 1024 * 1024);
    if (!up) return { error: { status: 400, message: "Audio upload is invalid or too large" } };
    audioPath = await storage.saveAudio(up.buffer, up.mime);
  } else if (String(body.audioUrl || "").trim()) {
    const url = String(body.audioUrl).trim();
    if (/^https?:\/\//i.test(url) && url.length <= 500) audioPath = url;
    else if (/^\/(music|uploads)\//.test(url)) audioPath = url;
    else return { error: { status: 400, message: "Provide a valid audio URL" } };
  }
  if (!audioPath) return { error: { status: 400, message: "Provide audioUrl, audioBase64, or an audio file" } };

  // ── cover: multipart file, base64 JSON, or provided URL/path ──
  let coverPath = input.cover || null;
  if (req.files?.cover?.[0]) {
    coverPath = await storage.saveCover(req.files.cover[0].buffer, req.files.cover[0].mimetype);
  } else if (body.coverBase64) {
    const up = base64Upload(body.coverBase64, "image/jpeg", 6 * 1024 * 1024);
    if (up) coverPath = await storage.saveCover(up.buffer, up.mime);
  } else if (coverPath) {
    const cp = String(coverPath);
    if (/^https?:\/\//i.test(cp) && cp.length <= 500) { /* keep remote cover as-is */ }
    else if (/^\/(uploads|covers)\//.test(cp)) coverPath = cp;
    else coverPath = null;
  }
  if (!coverPath) coverPath = storage.PLACEHOLDER_COVER;

  const artistId = await store.upsertArtist(input.artist || "Unknown Artist");
  const albumId = await store.upsertAlbum(input.album, artistId, { cover_image: coverPath });
  const genreId = await store.upsertGenre(input.genre || "Other");

  const id = await store.insertSong({
    title: input.title,
    artist_id: artistId,
    album_id: albumId,
    genre_id: genreId,
    language: input.language,
    duration: input.duration,
    release_date: `${Math.min(Math.max(input.year, 1900), 2100)}-01-01`,
    plays: input.plays,
    audio_path: audioPath,
    cover_path: coverPath,
    featured: input.featured,
    license: input.license,
    created_by: req.user?.id,
  });
  return { id };
}

app.get("/api/admin/songs", auth, requireAdmin, async (req, res) => {
  const songs = await store.listSongs({ limit: 200, sort: "recent" });
  res.json({ songs: songs.map((x) => ({ ...x, managed: true })) });
});

app.post("/api/admin/songs", auth, requireUploader, upload.fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const { id, error } = await createSongRecord(req, "admin");
    if (error) return res.status(error.status).json({ error: error.message });
    const song = await store.songJson(id);
    const s = await scope(req);
    res.status(201).json(annotate(song, s));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/admin/songs/:id", auth, requireUploader, upload.fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const existing = await store.getSong(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    const input = sanitizeSongInput(req.body || {});
    const patch = {
      title: input.title,
      duration: input.duration,
      language: input.language,
      featured: input.featured ? 1 : 0,
      license: input.license,
      release_date: `${Math.min(Math.max(input.year, 1900), 2100)}-01-01`,
      plays: input.plays,
    };
    if (req.files?.audio?.[0]) {
      patch.audio_path = await storage.saveAudio(req.files.audio[0].buffer, req.files.audio[0].mimetype);
    } else if (req.body.audioBase64) {
      const up = base64Upload(req.body.audioBase64, "audio/mpeg", 30 * 1024 * 1024);
      if (up) patch.audio_path = await storage.saveAudio(up.buffer, up.mime);
    }
    if (req.files?.cover?.[0]) {
      patch.cover_path = await storage.saveCover(req.files.cover[0].buffer, req.files.cover[0].mimetype);
    } else if (req.body.coverBase64) {
      const up = base64Upload(req.body.coverBase64, "image/jpeg", 6 * 1024 * 1024);
      if (up) patch.cover_path = await storage.saveCover(up.buffer, up.mime);
    }
    if (input.artist) { patch.artist_id = await store.upsertArtist(input.artist); }
    if (input.album) { patch.album_id = await store.upsertAlbum(input.album, patch.artist_id || existing.artist_id); }
    if (input.genre) { patch.genre_id = await store.upsertGenre(input.genre); }
    await store.updateSong(req.params.id, patch);
    res.json(await store.songJson(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/admin/songs/:id", auth, requireUploader, async (req, res) => {
  const existing = await store.getSong(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "artist" && existing.created_by && existing.created_by !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own songs" });
  }
  await store.deleteSong(req.params.id);
  res.json({ ok: true });
});

// Artist-facing upload endpoints (same validated upload pipeline)
app.post("/api/songs", auth, requireUploader, upload.fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  try {
    const { id, error } = await createSongRecord(req, "artist");
    if (error) return res.status(error.status).json({ error: error.message });
    const song = await store.songJson(id);
    const s = await scope(req);
    res.status(201).json(annotate(song, s));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/songs/:id", auth, requireUploader, upload.fields([{ name: "audio", maxCount: 1 }, { name: "cover", maxCount: 1 }]), async (req, res) => {
  const existing = await store.getSong(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "artist" && existing.created_by && existing.created_by !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own songs" });
  }
  const input = sanitizeSongInput(req.body || {});
  const patch = { title: input.title, duration: input.duration, language: input.language, featured: input.featured ? 1 : 0, license: input.license, release_date: `${Math.min(Math.max(input.year, 1900), 2100)}-01-01`, plays: input.plays };
  if (req.files?.audio?.[0]) patch.audio_path = await storage.saveAudio(req.files.audio[0].buffer, req.files.audio[0].mimetype);
  if (req.files?.cover?.[0]) patch.cover_path = await storage.saveCover(req.files.cover[0].buffer, req.files.cover[0].mimetype);
  if (input.artist) patch.artist_id = await store.upsertArtist(input.artist);
  if (input.album) patch.album_id = await store.upsertAlbum(input.album, patch.artist_id || existing.artist_id);
  if (input.genre) patch.genre_id = await store.upsertGenre(input.genre);
  await store.updateSong(req.params.id, patch);
  res.json(await store.songJson(req.params.id));
});

app.delete("/api/songs/:id", auth, requireUploader, async (req, res) => {
  const existing = await store.getSong(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (req.user.role === "artist" && existing.created_by && existing.created_by !== req.user.id) {
    return res.status(403).json({ error: "You can only delete your own songs" });
  }
  await store.deleteSong(req.params.id);
  res.json({ ok: true });
});

app.get("/api/admin/stats", auth, requireAdmin, async (req, res) => {
  res.json(await store.adminStats());
});

app.get("/api/admin/users", auth, requireAdmin, async (req, res) => {
  const users = await store.listUsers();
  const out = [];
  for (const u of users) {
    const [likes, playlists] = await Promise.all([
      store.likedSongIds(u.id),
      store.userPlaylists(u.id),
    ]);
    out.push({
      id: String(u.id), name: u.name, email: u.email, role: u.role || "user", createdAt: u.created_at,
      likes: likes.size, playlists: playlists.length, plays: (await store.recentHistory(u.id, 10000)).length,
    });
  }
  res.json(out);
});

app.patch("/api/admin/users/:id/role", auth, requireAdmin, async (req, res) => {
  if (!["user", "admin", "artist"].includes(req.body.role)) return res.status(400).json({ error: "Invalid role" });
  const u = await store.findUserById(req.params.id);
  if (!u) return res.status(404).json({ error: "Not found" });
  if (Number(u.id) === Number(req.user.id) && req.body.role !== "admin") {
    return res.status(400).json({ error: "You cannot demote yourself" });
  }
  await store.updateUser(u.id, { role: req.body.role });
  res.json({ ok: true });
});

app.get("/api/admin/playlists", auth, requireAdmin, async (req, res) => {
  const users = await store.listUsers();
  const all = [];
  for (const u of users) {
    const pls = await store.userPlaylists(u.id);
    for (const pl of pls) {
      const songs = await store.playlistSongs(pl.id);
      all.push({ ...pl, songs, songIds: songs.map((x) => x.id), ownerId: u.id, owner: u.name || u.email });
    }
  }
  res.json({ playlists: all });
});

app.get("/api/admin/artists", auth, requireAdmin, async (req, res) => {
  res.json(await store.listArtists({ limit: 200 }));
});

// ─── 404 / errors ────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ error: err.code === "LIMIT_FILE_SIZE" ? "File too large" : err.message });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => console.log(`🎵 BeatNest API running on http://localhost:${PORT}`));