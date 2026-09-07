// Migrates backend/db.json (legacy JSON DB) into MySQL.
//   npm run db:migrate-json  [-- --path=../db.json] [--force]
// db.json is NEVER modified — delete it only after you have verified the new DB.
const path = require("path");
const fs = require("fs");

const store = require("../mysql/store");
const storage = require("../services/storage");

// The bundled local catalog that was previously hard-coded in services/music.js.
const LOCAL_SEED = [
  { id: "local-1", title: "Mero Aanshu", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 210, featured: true, year: 2024, audioUrl: "/music/Mero Aanshu -The Edge Band I Jeewan Gurung.mp3", license: "Artist-uploaded" },
  { id: "local-2", title: "Nachahe Ko Hoina", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 168, featured: true, year: 2024, audioUrl: "/music/Nachahe ko Hoina - The Edge Band I Jeewan Gurung [0j4XhaDjDEE].mp3", license: "Artist-uploaded" },
  { id: "local-3", title: "Prayas", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 200, featured: true, year: 2024, audioUrl: "/music/Prayas -The Edge Band I Jeewan Gurung.mp3", license: "Artist-uploaded" },
  { id: "local-4", title: "Samjhiney Mutu", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 208, featured: false, year: 2024, audioUrl: "/music/Samjhiney Mutu -The Edge Band I Jeewan Gurung.mp3", license: "Artist-uploaded" },
  { id: "local-5", title: "Thaha Chaina", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 172, featured: false, year: 2024, audioUrl: "/music/Thaha chaina -The Edge Band I Jeewan Gurung [dJqtIgvofmg].mp3", license: "Artist-uploaded" },
  { id: "local-6", title: "Yo Dil Mero", artist: "The Edge Band", album: "The Edge Band Collection", genre: "Nepali Pop", language: "Nepali", duration: 129, featured: false, year: 2024, audioUrl: "/music/Yo dil Mero -The Edge Band I Jeewan Gurung.mp3", license: "Artist-uploaded" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key) => {
    const hit = args.find((a) => a.startsWith(`--${key}=`));
    return hit ? hit.split("=").slice(1).join("=") : null;
  };
  return { dbPath: get("path") || path.join(__dirname, "..", "db.json"), force: args.includes("--force") };
}

// A song migrates as a local file only if it needs no external resolver.
function isLocalAudio(url) {
  if (!url) return false;
  const u = String(url);
  if (/^(https?:)?\/\//.test(u)) {
    const remote = /^(https?:)?\/\//.test(u) && !/^\/\//.test(u);
    // allow URLs that point at our own host (e.g. http://localhost:4000/music/x.mp3)
    return remote && /localhost|127\.0\.0\.1|0\.0\.0\.0|^\/(music|uploads)\//i.test(u);
  }
  return /^\/(music|uploads)\//.test(u);
}

async function migrate() {
  const { dbPath, force } = parseArgs();
  if (!fs.existsSync(dbPath)) throw new Error(`db.json not found at ${dbPath}`);
  const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  const { migrate: ensureSchema } = require("../mysql/schema");
  await ensureSchema();
  storage.ensurePlaceholders();

  const existing = await store.listSongs({ limit: 1 });
  if (existing.length && !force) {
    console.log("⚠ Songs table is not empty — skipping migration (use --force to reset and re-run).");
    return;
  }
  if (force) {
    await store.resetAll();
  }

  const report = {
    dbPath,
    users: 0, artists: 0, albums: 0, genres: 0, songs: 0, playlists: 0,
    playlistEntries: 0, favorites: 0, downloads: 0, history: 0, follows: 0,
    savedAlbums: 0, skippedExternalSongs: 0, skippedUnknownRefs: 0,
  };

  const legacyIdToSongId = new Map();
  const genToId = new Map();
  const artistIdCache = new Map();
  const albumIdCache = new Map();
  const oldUserIdToNewId = new Map();
  const seenArtists = new Set();
  const seenAlbums = new Set();
  const seenGenres = new Set();

  async function ensureGenre(name) {
    if (genToId.has(name)) return genToId.get(name);
    const id = await store.upsertGenre(name);
    genToId.set(name, id);
    seenGenres.add(name);
    report.genres = seenGenres.size;
    return id;
  }

  async function ensureArtist(name) {
    if (seenArtists.has(name)) return artistIdCache.get(name);
    const id = await store.upsertArtist(name);
    seenArtists.add(name);
    artistIdCache.set(name, id);
    report.artists = seenArtists.size;
    return id;
  }

  async function ensureAlbum(title, artistId) {
    const key = `${title}||${artistId}`;
    if (seenAlbums.has(key)) return albumIdCache.get(key);
    const id = await store.upsertAlbum(title, artistId);
    seenAlbums.add(key);
    albumIdCache.set(key, id);
    report.albums = seenAlbums.size;
    return id;
  }

  // ── 1. Bundled local catalog ──
  for (const ls of LOCAL_SEED) {
    const genreId = await ensureGenre(ls.genre);
    const artistId = await ensureArtist(ls.artist);
    const albumId = await ensureAlbum(ls.album, artistId);
    const id = await store.insertSong({
      title: ls.title, artist_id: artistId, album_id: albumId, genre_id: genreId,
      language: ls.language, duration: ls.duration, release_date: `${ls.year}-01-01`,
      audio_path: ls.audioUrl, cover_path: storage.PLACEHOLDER_COVER,
      featured: ls.featured ? 1 : 0, license: ls.license,
      plays: data.playCountTotal?.[ls.id] || 0,
    });
    legacyIdToSongId.set(ls.id, id);
    report.songs += 1;
  }

  // ── 2. Managed songs (db.songs) ──
  for (const s of data.songs || []) {
    if (!isLocalAudio(s.audioUrl)) {
      report.skippedExternalSongs += 1;
      console.log(`  • skipped managed song "${s.title}" (external audio URL: ${String(s.audioUrl).slice(0, 60)}…)`);
      continue;
    }
    const genreId = await ensureGenre(s.genre || "Other");
    const artistId = await ensureArtist(s.artist);
    const albumId = await ensureAlbum(s.album, artistId);
    const id = await store.insertSong({
      title: s.title, artist_id: artistId, album_id: albumId, genre_id: genreId,
      language: s.language || "Other", duration: s.duration || 0,
      release_date: `${s.year || 2025}-01-01`,
      audio_path: s.audioUrl,
      cover_path: s.cover && /^\/(uploads|covers)\//.test(s.cover) ? s.cover : storage.PLACEHOLDER_COVER,
      featured: s.featured ? 1 : 0, license: s.license || "Owned",
      plays: (s.plays || 0) + (data.playCountTotal?.[s.id] || 0),
    });
    legacyIdToSongId.set(s.id, id);
    report.songs += 1;
  }

  // ── 3. Users ──
  for (const u of Object.values(data.users || {})) {
    const user = await store.createUser({
      email: u.email, name: u.name || u.email.split("@")[0], passwordHash: u.passwordHash,
      role: ["admin", "artist", "user"].includes(u.role) ? u.role : "user",
    });
    oldUserIdToNewId.set(u.id, user.id);
    report.users += 1;

    for (const likedId of u.likes || []) {
      const songId = legacyIdToSongId.get(likedId);
      if (songId) { await store.toggleLike(user.id, songId, true); report.favorites += 1; }
      else report.skippedUnknownRefs += 1;
    }
    for (const dlId of u.downloads || []) {
      const songId = legacyIdToSongId.get(dlId);
      if (songId) { await store.addDownload(user.id, songId); report.downloads += 1; }
      else report.skippedUnknownRefs += 1;
    }
    for (const fa of u.followedArtists || []) {
      const artistId = await store.upsertArtist(fa.name);
      await store.followArtist(user.id, artistId);
      report.follows += 1;
    }
    for (const sa of u.savedAlbums || []) {
      const artistId = sa.artist ? await store.artistByName(sa.artist) : null;
      const albumId = await store.upsertAlbum(sa.name, artistId, { cover_image: sa.cover });
      await store.saveAlbum(user.id, albumId);
      report.savedAlbums += 1;
    }
    for (const h of u.history || []) {
      const songId = legacyIdToSongId.get(h.id);
      if (!songId) continue;
      await store.addHistory(user.id, songId);
      report.history += 1;
    }
    // playCount per-song aggregate for this user lives in songs.plays;
    // per-user playCount granularity is superseded by listening_history.

    // ── 4. Playlists ──
    for (const pl of u.playlists || []) {
      const plId = await store.createPlaylist(user.id, {
        name: pl.name, description: pl.description || "",
        cover: pl.cover && /^\/(uploads|covers)\//.test(pl.cover) ? pl.cover : null,
        isPublic: !!pl.public,
      });
      report.playlists += 1;
      for (const sid of pl.songIds || []) {
        const songId = legacyIdToSongId.get(sid);
        if (songId) { await store.addSongToPlaylist(plId, songId); report.playlistEntries += 1; }
        else report.skippedUnknownRefs += 1;
      }
    }
  }

  // ── 5. Report ──
  report.notes = report.notes || [];
  if (report.skippedExternalSongs) {
    report.notes.push(`${report.skippedExternalSongs} managed song(s) skipped — they only existed as external (YouTube-style) links that are being removed with the external resolver.`);
  }
  if (report.skippedUnknownRefs) {
    report.notes.push(`${report.skippedUnknownRefs} references to songs that no longer exist in the catalog were dropped.`);
  }

  const reportPath = path.join(__dirname, "migration-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("── Migration report ──");
  for (const [k, v] of Object.entries(report)) {
    if (Array.isArray(v)) continue;
    console.log(`  ${k.padEnd(22)} ${v}`);
  }
  for (const n of report.notes) console.log(`  • ${n}`);
  console.log(`\nFull report written to ${reportPath}`);
}

migrate().then(() => process.exit(0)).catch((e) => { console.error("Migration failed:", e); process.exit(1); });