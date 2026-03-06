const express = require("express");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/music", express.static(path.join(__dirname, "../music")));

// JioSaavn API instances — tries each one until one works
const SAAVN_APIS = [
  "https://powerapi-song.vercel.app",
  "https://saavn.dev",
  "https://jiosaavn-api.vercel.app",
];

async function saavnGet(path) {
  for (const base of SAAVN_APIS) {
    try {
      const resp = await fetch(`${base}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (resp.ok) {
        const data = await resp.json();
        console.log(`✅ saavnGet success: ${base}${path}`);
        return data;
      }
    } catch (e) {
      console.log(`❌ ${base} failed: ${e.message}`);
    }
  }
  throw new Error("All JioSaavn API instances failed");
}

function cleanText(str) {
  if (!str) return "Unknown";
  return String(str).replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
}

function getBestImage(images) {
  if (!images) return null;
  if (typeof images === "string") return images.replace("150x150","500x500").replace("50x50","500x500");
  if (Array.isArray(images)) {
    const best = images.find(i => (i.quality||i.size||"").includes("500")) || images[images.length-1];
    return best?.url || best?.link || null;
  }
  return null;
}

function getBestAudio(downloadUrl) {
  if (!downloadUrl) return null;
  // String URL directly
  if (typeof downloadUrl === "string") return downloadUrl;
  if (!Array.isArray(downloadUrl)) return null;
  const best = downloadUrl.find(u => u.quality === "320kbps")
    || downloadUrl.find(u => u.quality === "160kbps")
    || downloadUrl[downloadUrl.length - 1];
  return best?.url || best?.link || null;
}

function formatSaavnSong(song, i) {
  const c = COLORS[i % COLORS.length];
  const cover = getBestImage(song.image) || `https://picsum.photos/seed/sv${song.id}/400/400`;
  const audioUrl = getBestAudio(song.downloadUrl);
  const artists = Array.isArray(song.artists?.primary)
    ? song.artists.primary.map(a => a.name).join(", ")
    : (song.primaryArtists || song.singers || "Unknown");

  return {
    id: `sv-${song.id}`,
    saavnId: song.id,
    title: cleanText(song.name || song.title || song.song),
    artist: cleanText(artists),
    album: cleanText(song.album?.name || song.album || "Unknown Album"),
    genre: song.language || "Music",
    duration: parseInt(song.duration || 0),
    plays: parseInt(song.playCount || song.play_count || 0),
    cover,
    color: c.color,
    accent: c.accent,
    featured: false,
    year: parseInt(song.year || 2024),
    audioUrl,
    saavnUrl: song.url || song.perma_url || null,
    language: song.language || null,
    source: "saavn",
    liked: false,
    downloaded: false,
  };
}

const COLORS = [
  { color: "#FF6B6B", accent: "#FFE66D" },
  { color: "#4ECDC4", accent: "#A8E6CF" },
  { color: "#C77DFF", accent: "#E0AAFF" },
  { color: "#FF9F43", accent: "#FFEAA7" },
  { color: "#FD79A8", accent: "#FDCFE8" },
  { color: "#6C5CE7", accent: "#A29BFE" },
  { color: "#00B894", accent: "#55EFC4" },
  { color: "#D63031", accent: "#FF7675" },
];


// ─── Local songs ─────────────────────────────────────────────────
let localSongs = [
  { id: "local-1", title: "Mero Aanshu", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 210, plays: 48210, cover: "https://picsum.photos/seed/neon1/400/400", color: "#FF6B6B", accent: "#FFE66D", featured: true, year: 2024, audioUrl: "/music/Mero Aanshu -The Edge Band I Jeewan Gurung.mp3", source: "local" },
  { id: "local-2", title: "Nachahe Ko Hoina", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 168, plays: 31540, cover: "https://picsum.photos/seed/ocean2/400/400", color: "#4ECDC4", accent: "#A8E6CF", featured: true, year: 2024, audioUrl: "/music/Nachahe ko Hoina - The Edge Band I Jeewan Gurung [0j4XhaDjDEE].mp3", source: "local" },
  { id: "local-3", title: "Prayas", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 200, plays: 72900, cover: "https://picsum.photos/seed/road3/400/400", color: "#C77DFF", accent: "#E0AAFF", featured: true, year: 2024, audioUrl: "/music/Prayas -The Edge Band I Jeewan Gurung.mp3", source: "local" },
  { id: "local-4", title: "Samjhiney Mutu", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 208, plays: 19870, cover: "https://picsum.photos/seed/solar4/400/400", color: "#FF9F43", accent: "#FFEAA7", featured: false, year: 2024, audioUrl: "/music/Samjhiney Mutu -The Edge Band I Jeewan Gurung.mp3", source: "local" },
  { id: "local-5", title: "Thaha Chaina", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 172, plays: 55600, cover: "https://picsum.photos/seed/world5/400/400", color: "#FD79A8", accent: "#FDCFE8", featured: false, year: 2024, audioUrl: "/music/Thaha chaina -The Edge Band I Jeewan Gurung [dJqtIgvofmg].mp3", source: "local" },
  { id: "local-6", title: "Yo Dil Mero", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", duration: 129, plays: 28100, cover: "https://picsum.photos/seed/iron6/400/400", color: "#6C5CE7", accent: "#A29BFE", featured: false, year: 2024, audioUrl: "/music/Yo dil Mero -The Edge Band I Jeewan Gurung.mp3", source: "local" },
];

let playlists = [{ id: "pl1", name: "The Edge Band — Best", description: "All hits", cover: "https://picsum.photos/seed/pl1/400/400", songIds: ["local-1","local-2","local-3","local-4","local-5","local-6"], createdAt: new Date().toISOString() }];
let userLikes = new Set();
let userDownloads = new Set();

// ─── Local Routes ────────────────────────────────────────────────
app.get("/api/songs", (req, res) => {
  const { genre, search, sort } = req.query;
  let result = [...localSongs];
  if (genre && genre !== "All") result = result.filter((s) => s.genre === genre);
  if (search) { const q = search.toLowerCase(); result = result.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)); }
  if (sort === "plays") result.sort((a, b) => b.plays - a.plays);
  if (sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "recent") result.sort((a, b) => b.year - a.year);
  res.json(result.map((s) => ({ ...s, liked: userLikes.has(s.id), downloaded: userDownloads.has(s.id) })));
});
app.get("/api/songs/featured", (req, res) => res.json(localSongs.filter((s) => s.featured).map((s) => ({ ...s, liked: userLikes.has(s.id), downloaded: userDownloads.has(s.id) }))));
app.get("/api/songs/:id", (req, res) => { const song = localSongs.find((s) => s.id === req.params.id); if (!song) return res.status(404).json({ error: "Not found" }); song.plays += 1; res.json({ ...song, liked: userLikes.has(song.id), downloaded: userDownloads.has(song.id) }); });
app.post("/api/songs/:id/like", (req, res) => { const { id } = req.params; if (userLikes.has(id)) userLikes.delete(id); else userLikes.add(id); res.json({ liked: userLikes.has(id) }); });
app.post("/api/songs/:id/download", (req, res) => { userDownloads.add(req.params.id); res.json({ downloaded: true }); });
app.delete("/api/songs/:id/download", (req, res) => { userDownloads.delete(req.params.id); res.json({ downloaded: false }); });
app.get("/api/downloads", (req, res) => res.json(localSongs.filter((s) => userDownloads.has(s.id)).map((s) => ({ ...s, liked: userLikes.has(s.id), downloaded: true }))));
app.get("/api/genres", (req, res) => res.json(["All", ...new Set(localSongs.map((s) => s.genre))]));
app.get("/api/stats", (req, res) => res.json({ totalSongs: localSongs.length, totalPlays: localSongs.reduce((a, s) => a + s.plays, 0), totalLiked: userLikes.size, totalDownloaded: userDownloads.size, genres: [...new Set(localSongs.map((s) => s.genre))].length }));
app.get("/api/playlists", (req, res) => res.json(playlists.map((pl) => ({ ...pl, songs: pl.songIds.map((id) => localSongs.find((s) => s.id === id)).filter(Boolean) }))));
app.post("/api/playlists", (req, res) => { const pl = { id: uuidv4(), name: req.body.name, description: req.body.description || "", cover: `https://picsum.photos/seed/${Date.now()}/400/400`, songIds: [], createdAt: new Date().toISOString() }; playlists.push(pl); res.status(201).json({ ...pl, songs: [] }); });
app.post("/api/playlists/:id/songs", (req, res) => { const pl = playlists.find((p) => p.id === req.params.id); if (!pl) return res.status(404).json({ error: "Not found" }); if (!pl.songIds.includes(req.body.songId)) pl.songIds.push(req.body.songId); res.json({ ...pl, songs: pl.songIds.map((id) => localSongs.find((s) => s.id === id)).filter(Boolean) }); });

// ─── JioSaavn Routes ─────────────────────────────────────────────

// Extract songs from various API response shapes
function extractSongs(data) {
  return data?.data?.results
    || data?.data?.songs?.results
    || data?.results
    || data?.songs
    || [];
}

app.get("/api/saavn/search", async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q) return res.json([]);
    // Try multiple path formats
    let results = [];
    for (const path of [
      `/api/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
      `/search/songs?query=${encodeURIComponent(q)}&limit=${limit}`,
      `/search?query=${encodeURIComponent(q)}&limit=${limit}`,
    ]) {
      try {
        const data = await saavnGet(path);
        results = extractSongs(data);
        if (results.length > 0) break;
      } catch {}
    }
    res.json(results.map((s, i) => formatSaavnSong(s, i)));
  } catch (e) {
    console.error("Search error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/saavn/trending", async (req, res) => {
  try {
    let results = [];
    for (const path of [
      `/api/search/songs?query=nepali+hindi+trending&limit=10`,
      `/search/songs?query=nepali+hindi+trending&limit=10`,
    ]) {
      try {
        const data = await saavnGet(path);
        results = extractSongs(data);
        if (results.length > 0) break;
      } catch {}
    }
    res.json(results.map((s, i) => ({ ...formatSaavnSong(s, i), featured: true })));
  } catch (e) {
    res.json([]);
  }
});

app.get("/api/saavn/language", async (req, res) => {
  try {
    const { lang = "nepali", limit = 25 } = req.query;
    let results = [];
    for (const path of [
      `/api/search/songs?query=${encodeURIComponent(lang)}&limit=${limit}`,
      `/search/songs?query=${encodeURIComponent(lang)}&limit=${limit}`,
    ]) {
      try {
        const data = await saavnGet(path);
        results = extractSongs(data);
        if (results.length > 0) break;
      } catch {}
    }
    res.json(results.map((s, i) => formatSaavnSong(s, i)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`🎵 BeatNest API running on http://localhost:${PORT}`));
