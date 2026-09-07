// MySQL repository — all data access for the BeatNest API.
// Parameterized queries only. No external services.
const { getPool } = require("./pool");
const bcrypt = require("bcryptjs");
const { pickColors, GENRES, LANGUAGES, normalize } = require("../services/music");
const storage = require("../services/storage");

const PLACEHOLDER_COVER = "/uploads/covers/placeholder.png";

// Deterministic accent colors for the React client (Hero, SongTile, ArtistTile, player).
function songColors(genre, language, title) {
  const g = GENRES.find((x) => normalize(x.name) === normalize(String(genre || "")));
  if (g) return { color: g.color, accent: g.accent };
  const l = LANGUAGES.find((x) => x.key === language || normalize(x.label) === normalize(String(language || "")));
  if (l) return { color: l.color, accent: l.accent };
  return pickColors(`${genre || ""}|${language || ""}|${title || ""}`);
}

// ─── Row mappers ─────────────────────────────────────────────────
function rowToSong(r) {
  const colors = songColors(r.genre_name, r.language, r.title);
  return {
    id: Number(r.id),
    title: r.title,
    artist: r.artist_name || "Unknown Artist",
    artistId: r.artist_id ? Number(r.artist_id) : null,
    album: r.album_title || "Single",
    albumId: r.album_id ? Number(r.album_id) : null,
    genre: r.genre_name || "Other",
    genreId: r.genre_id ? Number(r.genre_id) : null,
    language: r.language || "Other",
    duration: Number(r.duration || 0),
    plays: Number(r.plays || 0),
    cover: r.cover_path || r.album_cover || PLACEHOLDER_COVER,
    audioUrl: r.audioUrl || (String(r.audio_path || "").startsWith("http") ? r.audio_path : `/api/stream/${Number(r.id)}`),
    source: /^https?:\/\//i.test(r.audioUrl || String(r.audio_path || "")) ? (storage.isR2Url(r.audioUrl || r.audio_path) ? "owned" : "streamed") : "owned",
    license: r.license || "Owned",
    featured: !!r.featured,
    year: r.release_date ? Number(String(r.release_date).slice(0, 4)) || 0 : r.year || 0,
    track: Number(r.track_number || 0),
    labels: null,
    liked: !!r.liked,
    downloaded: !!r.downloaded,
    color: colors.color,
    accent: colors.accent,
  };
}

function rowToArtist(r) {
  const colors = pickColors(r.name || "artist");
  return {
    id: Number(r.id),
    name: r.name,
    image: r.cover_image || PLACEHOLDER_COVER,
    songCount: Number(r.song_count || 0),
    bio: r.bio || "",
    color: colors.color,
    accent: colors.accent,
  };
}

function rowToAlbum(r) {
  return {
    id: Number(r.id),
    name: r.title,
    artist: r.artist_name || "Unknown Artist",
    artistId: r.artist_id ? Number(r.artist_id) : null,
    image: r.cover_image || PLACEHOLDER_COVER,
    songCount: Number(r.song_count || 0),
    year: r.release_date ? Number(String(r.release_date).slice(0, 4)) || 0 : 0,
  };
}

function rowToPlaylist(r) {
  return {
    id: Number(r.id),
    name: r.name,
    description: r.description || "",
    cover: r.cover_image || null,
    songIds: r.song_ids || [],
    public: !!r.is_public,
    userId: r.user_id ? Number(r.user_id) : null,
    createdAt: r.created_at,
  };
}

// ─── Song queries ────────────────────────────────────────────────
const SONG_SELECT = `
  SELECT s.*, a.name AS artist_name, al.title AS album_title, al.cover_image AS album_cover,
         g.name AS genre_name,
         IF(s.cover_path IS NOT NULL, s.cover_path, al.cover_image) AS cover_path
  FROM songs s
  LEFT JOIN artists a ON a.id = s.artist_id
  LEFT JOIN albums al ON al.id = s.album_id
  LEFT JOIN genres g ON g.id = s.genre_id`;

async function listSongs(opts = {}) {
  const where = [];
  const params = [];
  if (opts.featured) { where.push("s.featured = 1"); }
  if (opts.genre && opts.genre !== "All") { where.push("g.name = ?"); params.push(opts.genre); }
  if (opts.language && opts.language !== "All") { where.push("s.language = ?"); params.push(opts.language); }
  if (opts.artistId != null) { where.push("s.artist_id = ?"); params.push(opts.artistId); }
  if (opts.albumId != null) { where.push("s.album_id = ?"); params.push(opts.albumId); }
  if (opts.genreId != null) { where.push("s.genre_id = ?"); params.push(opts.genreId); }
  if (opts.search) {
    const like = `%${opts.search}%`;
    where.push("(s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ? OR g.name LIKE ?)");
    params.push(like, like, like, like);
  }
  const order = {
    plays: "s.plays DESC",
    title: "s.title ASC",
    recent: "s.release_date DESC, s.created_at DESC",
  }[opts.sort] || "s.created_at DESC";
  const limit = Math.min(parseInt(opts.limit) || 100, 500);
  const offset = Math.max(parseInt(opts.offset) || 0, 0);
  const sql = `${SONG_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const [rows] = await getPool().query(sql, params);
  return rows.map(rowToSong);
}

async function getSong(id) {
  const [rows] = await getPool().query(`${SONG_SELECT} WHERE s.id = ? LIMIT 1`, [id]);
  return rows.length ? rows[0] : null;
}

// Formatted (public-facing) song object for a single id.
async function songJson(id) {
  const row = await getSong(id);
  return row ? rowToSong(row) : null;
}

async function searchSongs(q, limit = 20) {
  return listSongs({ search: q, limit });
}

async function insertSong(data) {
  const [res] = await getPool().query(
    `INSERT INTO songs
      (title, artist_id, album_id, genre_id, language, duration, track_number, release_date,
       plays, audio_path, cover_path, featured, license, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title, data.artist_id || null, data.album_id || null, data.genre_id || null,
      data.language || "Other", data.duration || 0, data.track_number || 0,
      data.release_date || null, data.plays || 0, data.audio_path,
      data.cover_path || null, data.featured ? 1 : 0, data.license || "Owned",
      data.created_by || null,
    ]
  );
  return res.insertId;
}

async function updateSong(id, patch) {
  const allowed = ["title", "artist_id", "album_id", "genre_id", "language", "duration",
    "track_number", "release_date", "plays", "audio_path", "cover_path", "featured", "license"];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (patch[k] !== undefined) { sets.push(`\`${k}\` = ?`); params.push(patch[k]); }
  }
  if (!sets.length) return;
  params.push(id);
  await getPool().query(`UPDATE songs SET ${sets.join(", ")} WHERE id = ?`, params);
}

async function deleteSong(id) {
  const [res] = await getPool().query("DELETE FROM songs WHERE id = ?", [id]);
  return res.affectedRows > 0;
}

async function incrementPlays(id, by = 1) {
  await getPool().query("UPDATE songs SET plays = plays + ? WHERE id = ?", [by, id]);
}

// ─── Artists / Albums / Genres ───────────────────────────────────
async function upsertArtist(name, extra = {}) {
  const [rows] = await getPool().query("SELECT id FROM artists WHERE name = ?", [name]);
  if (rows.length) return Number(rows[0].id);
  const [res] = await getPool().query("INSERT INTO artists (name, bio, cover_image) VALUES (?, ?, ?)",
    [name, extra.bio || null, extra.cover_image || null]);
  return res.insertId;
}

async function getArtist(id) {
  const [rows] = await getPool().query(
    `SELECT a.*, COUNT(s.id) AS song_count FROM artists a
     LEFT JOIN songs s ON s.artist_id = a.id WHERE a.id = ? GROUP BY a.id`, [id]);
  return rows.length ? rowToArtist(rows[0]) : null;
}

async function listArtists({ q = "", limit = 30 } = {}) {
  const params = [];
  let where = "";
  if (q) { where = "WHERE a.name LIKE ?"; params.push(`%${q}%`); }
  params.push(Math.min(parseInt(limit) || 30, 200));
  const [rows] = await getPool().query(
    `SELECT a.*, COUNT(s.id) AS song_count FROM artists a
     LEFT JOIN songs s ON s.artist_id = a.id ${where}
     GROUP BY a.id ORDER BY song_count DESC LIMIT ?`, params);
  return rows.map(rowToArtist);
}

async function artistByName(name) {
  const [rows] = await getPool().query("SELECT id FROM artists WHERE name = ?", [name]);
  return rows.length ? Number(rows[0].id) : null;
}

async function upsertAlbum(title, artistId, extra = {}) {
  title = title || "Single";
  if (!artistId) return null;
  const [rows] = await getPool().query("SELECT id FROM albums WHERE title = ? AND artist_id = ?", [title, artistId]);
  if (rows.length) return Number(rows[0].id);
  const [res] = await getPool().query(
    "INSERT INTO albums (title, artist_id, cover_image, release_date) VALUES (?, ?, ?, ?)",
    [title, artistId, extra.cover_image || null, extra.release_date || null]);
  return res.insertId;
}

async function getAlbum(id) {
  const [rows] = await getPool().query(
    `SELECT al.*, a.name AS artist_name, COUNT(s.id) AS song_count FROM albums al
     LEFT JOIN artists a ON a.id = al.artist_id
     LEFT JOIN songs s ON s.album_id = al.id
     WHERE al.id = ? GROUP BY al.id`, [id]);
  return rows.length ? rowToAlbum(rows[0]) : null;
}

async function albumByName(title, artistId) {
  const [rows] = await getPool().query("SELECT id FROM albums WHERE title = ? AND artist_id = ?", [title, artistId || null]);
  return rows.length ? Number(rows[0].id) : null;
}

async function listAlbums({ q = "", limit = 30 } = {}) {
  const params = [];
  let where = "";
  if (q) { where = "WHERE al.title LIKE ? OR a.name LIKE ?"; params.push(`%${q}%`, `%${q}%`); }
  params.push(Math.min(parseInt(limit) || 30, 200));
  const [rows] = await getPool().query(
    `SELECT al.*, a.name AS artist_name, COUNT(s.id) AS song_count FROM albums al
     LEFT JOIN artists a ON a.id = al.artist_id
     LEFT JOIN songs s ON s.album_id = al.id ${where}
     GROUP BY al.id ORDER BY song_count DESC, al.created_at DESC LIMIT ?`, params);
  return rows.map(rowToAlbum);
}

async function upsertGenre(name) {
  name = name || "Other";
  const [rows] = await getPool().query("SELECT id FROM genres WHERE name = ?", [name]);
  if (rows.length) return Number(rows[0].id);
  const [res] = await getPool().query("INSERT INTO genres (name) VALUES (?)", [name]);
  return res.insertId;
}

async function listGenres() {
  const [rows] = await getPool().query("SELECT name FROM genres ORDER BY name");
  return rows.map((r) => r.name);
}

// ─── Users / Auth ────────────────────────────────────────────────
function rowToUser(r) {
  return {
    id: r.id.toString(),
    email: r.email,
    name: r.name,
    role: r.role,
    createdAt: r.created_at,
    passwordHash: r.password_hash,
  };
}

async function createUser({ email, name, passwordHash, role = "user" }) {
  const [res] = await getPool().query(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)",
    [email, name || email.split("@")[0], passwordHash, role]);
  return findUserById(res.insertId);
}

async function findUserById(id) {
  const [rows] = await getPool().query("SELECT * FROM users WHERE id = ?", [id]);
  return rows.length ? rows[0] : null;
}

async function findUserByEmail(email) {
  const [rows] = await getPool().query("SELECT * FROM users WHERE email = ?", [email]);
  return rows.length ? rows[0] : null;
}

async function updateUser(id, patch) {
  const allowed = ["name", "role", "bio", "avatar", "password_hash"];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (patch[k] !== undefined) { sets.push(`\`${k}\` = ?`); params.push(patch[k]); }
  }
  if (!sets.length) return findUserById(id);
  params.push(id);
  await getPool().query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
  return findUserById(id);
}

async function listUsers() {
  const [rows] = await getPool().query("SELECT id, email, name, role, created_at FROM users ORDER BY id");
  return rows;
}

async function userStats(id) {
  const [[u]] = await getPool().query(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM songs) AS totalSongs,
            (SELECT IFNULL(SUM(plays),0) FROM songs) AS totalPlays,
            (SELECT COUNT(*) FROM genres) AS genres`);
  const [[me]] = await getPool().query(
    "SELECT COUNT(*) AS liked FROM favorites WHERE user_id = ?", [id]);
  const [[dl]] = await getPool().query(
    "SELECT COUNT(*) AS downloaded FROM downloads WHERE user_id = ?", [id]);
  return { ...u, totalLiked: Number(me.liked), totalDownloaded: Number(dl.downloaded) };
}

// ─── Favorites (likes) ───────────────────────────────────────────
async function toggleLike(userId, songId, forceAdd) {
  const [rows] = await getPool().query("SELECT 1 FROM favorites WHERE user_id = ? AND song_id = ?", [userId, songId]);
  if (rows.length) {
    if (forceAdd) return true;
    await getPool().query("DELETE FROM favorites WHERE user_id = ? AND song_id = ?", [userId, songId]);
    return false;
  }
  await getPool().query("INSERT IGNORE INTO favorites (user_id, song_id) VALUES (?, ?)", [userId, songId]);
  return true;
}

async function isLiked(userId, songId) {
  const [rows] = await getPool().query("SELECT 1 FROM favorites WHERE user_id = ? AND song_id = ?", [userId, songId]);
  return rows.length > 0;
}

async function likedSongIds(userId) {
  const [rows] = await getPool().query("SELECT song_id FROM favorites WHERE user_id = ?", [userId]);
  return new Set(rows.map((r) => Number(r.song_id)));
}

async function likedSongs(userId) {
  const limit = 500;
  const [rows] = await getPool().query(
    `${SONG_SELECT} JOIN favorites f ON f.song_id = s.id WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT ?`,
    [userId, limit]);
  return rows.map(rowToSong);
}

// ─── Downloads ───────────────────────────────────────────────────
async function addDownload(userId, songId) {
  await getPool().query("INSERT IGNORE INTO downloads (user_id, song_id) VALUES (?, ?)", [userId, songId]);
}

async function removeDownload(userId, songId) {
  await getPool().query("DELETE FROM downloads WHERE user_id = ? AND song_id = ?", [userId, songId]);
}

async function isDownloaded(userId, songId) {
  const [rows] = await getPool().query("SELECT 1 FROM downloads WHERE user_id = ? AND song_id = ?", [userId, songId]);
  return rows.length > 0;
}

async function downloadedSongIds(userId) {
  const [rows] = await getPool().query("SELECT song_id FROM downloads WHERE user_id = ?", [userId]);
  return new Set(rows.map((r) => Number(r.song_id)));
}

async function downloadedSongs(userId) {
  const [rows] = await getPool().query(
    `${SONG_SELECT} JOIN downloads d ON d.song_id = s.id WHERE d.user_id = ? ORDER BY d.created_at DESC`,
    [userId]);
  return rows.map(rowToSong);
}

// ─── Playlists ───────────────────────────────────────────────────
async function userPlaylists(userId) {
  const [rows] = await getPool().query(
    `SELECT p.*, COUNT(ps.song_id) AS song_count FROM playlists p
     LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
     WHERE p.user_id = ? GROUP BY p.id ORDER BY p.created_at`, [userId]);
  return rows.map((r) => ({ ...rowToPlaylist(r), songs: [] }));
}

async function getPlaylist(id) {
  const [rows] = await getPool().query("SELECT * FROM playlists WHERE id = ?", [id]);
  return rows.length ? rowToPlaylist(rows[0]) : null;
}

async function createPlaylist(userId, { name, description = "", cover = null, isPublic = false }) {
  const [res] = await getPool().query(
    "INSERT INTO playlists (user_id, name, description, cover_image, is_public) VALUES (?, ?, ?, ?, ?)",
    [userId, name, description, cover, isPublic ? 1 : 0]);
  return res.insertId;
}

async function updatePlaylist(id, patch) {
  const allowed = ["name", "description", "cover_image", "is_public"];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (patch[k] !== undefined) { sets.push(`\`${k}\` = ?`); params.push(patch[k]); }
  }
  if (!sets.length) return;
  params.push(id);
  await getPool().query(`UPDATE playlists SET ${sets.join(", ")} WHERE id = ?`, params);
}

async function deletePlaylist(id) {
  await getPool().query("DELETE FROM playlists WHERE id = ?", [id]);
}

async function addSongToPlaylist(playlistId, songId) {
  const [rows] = await getPool().query("SELECT MAX(position) AS m FROM playlist_songs WHERE playlist_id = ?", [playlistId]);
  const position = (rows[0]?.m ?? -1) + 1;
  await getPool().query("INSERT IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)",
    [playlistId, songId, position]);
}

async function removeSongFromPlaylist(playlistId, songId) {
  await getPool().query("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", [playlistId, songId]);
}

async function setPlaylistOrder(playlistId, songIds) {
  for (let i = 0; i < songIds.length; i++) {
    await getPool().query("UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?",
      [i, playlistId, songIds[i]]);
  }
}

async function playlistSongs(playlistId) {
  const [rows] = await getPool().query(
    `${SONG_SELECT} JOIN playlist_songs ps ON ps.song_id = s.id WHERE ps.playlist_id = ? ORDER BY ps.position, ps.added_at`,
    [playlistId]);
  return rows.map(rowToSong);
}

async function publicPlaylists() {
  const [rows] = await getPool().query(
    `SELECT p.*, u.name AS owner FROM playlists p
     JOIN users u ON u.id = p.user_id WHERE p.is_public = 1 ORDER BY p.created_at DESC`);
  const out = [];
  for (const r of rows) {
    const pl = { ...rowToPlaylist(r), owner: r.owner, songs: await playlistSongs(r.id) };
    out.push(pl);
  }
  return out;
}

// ─── History ─────────────────────────────────────────────────────
async function addHistory(userId, songId) {
  if (!songId) return;
  await getPool().query("INSERT INTO listening_history (user_id, song_id) VALUES (?, ?)", [userId, songId]);
}

async function recentHistory(userId, limit = 100) {
  const [rows] = await getPool().query(
    `SELECT s.*, a.name AS artist_name, al.title AS album_title, al.cover_image AS album_cover,
            g.name AS genre_name, h.played_at
     FROM listening_history h
     JOIN songs s ON s.id = h.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN albums al ON al.id = s.album_id
     LEFT JOIN genres g ON g.id = s.genre_id
     WHERE h.user_id = ?
     GROUP BY h.song_id, h.played_at
     ORDER BY h.played_at DESC LIMIT ?`, [userId, limit]);
  return rows.map(rowToSong);
}

async function clearHistory(userId) {
  await getPool().query("DELETE FROM listening_history WHERE user_id = ?", [userId]);
}

async function deleteHistoryEntry(userId, songId) {
  await getPool().query("DELETE FROM listening_history WHERE user_id = ? AND song_id = ?", [userId, songId]);
}

// ─── Follows / Saved albums ──────────────────────────────────────
async function followArtist(userId, artistId) {
  if (!artistId) return false;
  await getPool().query("INSERT IGNORE INTO followed_artists (user_id, artist_id) VALUES (?, ?)", [userId, artistId]);
  return true;
}

async function unfollowArtist(userId, artistId) {
  if (!artistId) return false;
  await getPool().query("DELETE FROM followed_artists WHERE user_id = ? AND artist_id = ?", [userId, artistId]);
  return true;
}

async function followedArtists(userId) {
  const [rows] = await getPool().query(
    `SELECT a.* FROM followed_artists fa JOIN artists a ON a.id = fa.artist_id
     WHERE fa.user_id = ? ORDER BY fa.created_at DESC`, [userId]);
  return rows.map(rowToArtist);
}

async function saveAlbum(userId, albumId) {
  if (!albumId) return false;
  await getPool().query("INSERT IGNORE INTO saved_albums (user_id, album_id) VALUES (?, ?)", [userId, albumId]);
  return true;
}

async function unsaveAlbum(userId, albumId) {
  if (!albumId) return false;
  await getPool().query("DELETE FROM saved_albums WHERE user_id = ? AND album_id = ?", [userId, albumId]);
  return true;
}

async function savedAlbums(userId) {
  const [rows] = await getPool().query(
    `SELECT al.*, a.name AS artist_name FROM saved_albums sa
     JOIN albums al ON al.id = sa.album_id
     LEFT JOIN artists a ON a.id = al.artist_id
     WHERE sa.user_id = ? ORDER BY sa.created_at DESC`, [userId]);
  return rows.map((r) => rowToAlbum({ ...r, song_count: 0 }));
}

// ─── Stats / misc ────────────────────────────────────────────────
async function stats() {
  const [[r]] = await getPool().query(
    `SELECT (SELECT COUNT(*) FROM songs) AS totalSongs,
            (SELECT IFNULL(SUM(plays),0) FROM songs) AS totalPlays,
            (SELECT COUNT(*) FROM genres) AS genres,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM playlists) AS playlists`);
  return {
    totalSongs: Number(r.totalSongs),
    totalPlays: Number(r.totalPlays),
    totalLiked: 0,
    totalDownloaded: 0,
    genres: Number(r.genres),
    users: Number(r.users),
    playlists: Number(r.playlists),
  };
}

async function adminStats() {
  const [[r]] = await getPool().query(
    `SELECT (SELECT COUNT(*) FROM songs) AS songs,
            (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM playlists) AS playlists,
            (SELECT IFNULL(SUM(plays),0) FROM songs) AS totalPlays`);
  return {
    songs: Number(r.songs), dbSongs: Number(r.songs), users: Number(r.users),
    playlists: Number(r.playlists), totalPlays: Number(r.totalPlays),
  };
}

// Dangerous: wipes all app data. Only used by migration --force.
async function resetAll() {
  const tables = ["listening_history", "downloads", "favorites", "playlist_songs", "playlists",
    "saved_albums", "followed_artists", "songs", "albums", "artists", "genres", "users"];
  for (const t of tables) await getPool().query(`SET FOREIGN_KEY_CHECKS=0`);
  for (const t of tables) await getPool().query(`TRUNCATE TABLE \`${t}\``);
  await getPool().query(`SET FOREIGN_KEY_CHECKS=1`);
}

module.exports = {
  PLACEHOLDER_COVER,
  listSongs, getSong, songJson, searchSongs, insertSong, updateSong, deleteSong, incrementPlays,
  upsertArtist, getArtist, listArtists, artistByName,
  upsertAlbum, getAlbum, listAlbums, albumByName,
  upsertGenre, listGenres,
  createUser, findUserById, findUserByEmail, updateUser, listUsers, userStats,
  toggleLike, isLiked, likedSongIds, likedSongs,
  addDownload, removeDownload, isDownloaded, downloadedSongIds, downloadedSongs,
  userPlaylists, getPlaylist, createPlaylist, updatePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist, setPlaylistOrder, playlistSongs, publicPlaylists,
  addHistory, recentHistory, clearHistory, deleteHistoryEntry,
  followArtist, unfollowArtist, followedArtists,
  saveAlbum, unsaveAlbum, savedAlbums,
  stats, adminStats, resetAll,
};