const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "db.json");

const defaultData = () => ({
  users: {},
  songs: [],        // admin/manually managed songs stored in the DB
  playCountTotal: {}, // { songId: n } aggregate play counts across all users
  nextUserId: 1,
  nextSongId: 1,
});

let db = null;

function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_PATH)) {
      db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      if (!db.users) db.users = {};
      if (!db.songs) db.songs = [];
      if (!db.playCountTotal) db.playCountTotal = {};
      if (!db.nextUserId) db.nextUserId = 1;
      if (!db.nextSongId) db.nextSongId = 1;
    } else {
      db = defaultData();
    }
  } catch (e) {
    console.error("⚠️ Could not read db.json, starting fresh:", e.message);
    db = defaultData();
  }
  return db;
}

function save() {
  try {
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error("⚠️ Could not save db.json:", e.message);
  }
}

function getUserById(id) {
  if (id == null) return null;
  return db.users[String(id)] || null;
}

function getUserByEmail(email) {
  if (!email) return null;
  const key = email.trim().toLowerCase();
  const found = Object.values(db.users).find(
    (u) => String(u.email || "").toLowerCase() === key
  );
  return found || null;
}

function createUser({ email, name, passwordHash }) {
  const id = String(db.nextUserId++);
  const isFirst = Object.keys(db.users).length === 0;
  db.users[id] = {
    id,
    email: email.trim().toLowerCase(),
    name: name || email.split("@")[0],
    passwordHash,
    createdAt: new Date().toISOString(),
    role: isFirst ? "admin" : "user", // first registered account becomes admin
    likes: [],
    downloads: [],
    playlists: [],
    playCount: {},
    recentlyPlayed: [],
    followedArtists: [],
    savedAlbums: [],
    recentSearches: [],
    history: [],
  };
  save();
  return db.users[id];
}

function updateUser(id, patch) {
  const user = getUserById(id);
  if (!user) return null;
  Object.assign(user, patch);
  save();
  return user;
}

// ─── Song store (admin/managed library) ──────────────────────────
function listSongs() {
  return [...db.songs];
}

function getSong(id) {
  return db.songs.find((s) => s.id === id) || null;
}

function addSong(data) {
  const id = data.id || String(db.nextSongId++);
  db.songs.push({ ...data, id });
  if (data.plays && !db.playCountTotal[id]) db.playCountTotal[id] = data.plays;
  save();
  return db.songs[db.songs.length - 1];
}

function updateSong(id, patch) {
  const song = getSong(id);
  if (!song) return null;
  Object.assign(song, patch);
  save();
  return song;
}

function deleteSong(id) {
  const idx = db.songs.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  db.songs.splice(idx, 1);
  save();
  return true;
}

function recordPlay(songId) {
  db.playCountTotal[songId] = (db.playCountTotal[songId] || 0) + 1;
}

module.exports = {
  load,
  save,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  listSongs,
  getSong,
  addSong,
  updateSong,
  deleteSong,
  recordPlay,
  getPlayCount: (songId) => db.playCountTotal[songId] || 0,
  _getRaw: () => db,
};