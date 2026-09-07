// Seeds the self-hosted catalog with fictional songs (no copyrighted audio).
//   npm run db:seed [-- --force]
// Generates tiny placeholder WAV tones and gradient PNG covers locally.
const store = require("../mysql/store");
const storage = require("../services/storage");

const SEED = [
  { title: "Midnight Signals", artist: "Pixel Drift", album: "Neon Horizons", genre: "Electronic", language: "Instrumental", year: 2024, duration: 180, featured: true, license: "Artist-uploaded" },
  { title: "Chasing Comets", artist: "Pixel Drift", album: "Neon Horizons", genre: "Electronic", language: "Instrumental", year: 2024, duration: 195, featured: false, license: "Artist-uploaded" },
  { title: "Paper Boats", artist: "Cedar Lane", album: "Quiet Currents", genre: "Folk", language: "English", year: 2023, duration: 220, featured: false, license: "Artist-uploaded" },
  { title: "Worth the Wait", artist: "Cedar Lane", album: "Quiet Currents", genre: "Acoustic", language: "English", year: 2023, duration: 240, featured: true, license: "Artist-uploaded" },
  { title: "Neon Rain", artist: "Kira Volt", album: "Afterglow", genre: "Pop", language: "English", year: 2025, duration: 205, featured: true, license: "Artist-uploaded" },
  { title: "Afterglow", artist: "Kira Volt", album: "Afterglow", genre: "Pop", language: "English", year: 2025, duration: 190, featured: true, license: "Artist-uploaded" },
  { title: "Deep Blue", artist: "Maris Here", album: "Coral Theory", genre: "Lo-Fi", language: "Instrumental", year: 2024, duration: 210, featured: false, license: "Artist-uploaded" },
  { title: "Coral Theory", artist: "Maris Here", album: "Coral Theory", genre: "Ambient", language: "Instrumental", year: 2024, duration: 260, featured: false, license: "Artist-uploaded" },
  { title: "City of Fog", artist: "The North Line", album: "Tracks North", genre: "Indie", language: "English", year: 2023, duration: 230, featured: false, license: "Artist-uploaded" },
  { title: "Station Lights", artist: "The North Line", album: "Tracks North", genre: "Indie", language: "English", year: 2023, duration: 215, featured: false, license: "Artist-uploaded" },
  { title: "Gravity", artist: "Ravi Chandra", album: "Roots & Routes", genre: "Folk", language: "Hindi", year: 2025, duration: 250, featured: false, license: "Artist-uploaded" },
  { title: "Safed Raatein", artist: "Ravi Chandra", album: "Roots & Routes", genre: "Romantic", language: "Hindi", year: 2025, duration: 235, featured: true, license: "Artist-uploaded" },
  { title: "Timro Awaaz", artist: "Sangita Maya", album: "Naya Din", genre: "Folk", language: "Nepali", year: 2025, duration: 245, featured: true, license: "Artist-uploaded" },
  { title: "Naya Din", artist: "Sangita Maya", album: "Naya Din", genre: "Pop", language: "Nepali", year: 2025, duration: 200, featured: false, license: "Artist-uploaded" },
  { title: "City Lights", artist: "DJ Amara", album: "Night Shift", genre: "House", language: "Instrumental", year: 2024, duration: 300, featured: false, license: "Artist-uploaded" },
  { title: "Night Shift", artist: "DJ Amara", album: "Night Shift", genre: "Electronic", language: "Instrumental", year: 2024, duration: 285, featured: false, license: "Artist-uploaded" },
  { title: "Yatra", artist: "Bikash Raute", album: "Yatra", genre: "Devotional", language: "Nepali", year: 2023, duration: 330, featured: false, license: "Artist-uploaded" },
  { title: "Udaan", artist: "Bikash Raute", album: "Yatra", genre: "Folk", language: "Nepali", year: 2023, duration: 270, featured: true, license: "Artist-uploaded" },
];

const GRADS = [
  [76, 209, 196, 108, 92, 231], [255, 107, 107, 255, 230, 109], [199, 125, 255, 224, 170, 255],
  [255, 159, 67, 255, 234, 167], [253, 121, 168, 253, 207, 232], [9, 132, 227, 116, 185, 255],
  [0, 184, 148, 85, 239, 196], [214, 48, 49, 255, 118, 117], [108, 92, 231, 162, 155, 254],
  [78, 205, 196, 168, 230, 207], [179, 55, 113, 232, 160, 191], [45, 52, 54, 99, 110, 114],
  [26, 26, 46, 45, 52, 54], [255, 71, 87, 255, 160, 122], [72, 202, 228, 240, 231, 51],
  [17, 153, 142, 56, 239, 125], [84, 160, 255, 95, 39, 205], [255, 214, 10, 245, 87, 108],
];

function makeWav(seconds = 2, freq = 440, sampleRate = 44100) {
  const n = Math.round(sampleRate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, i / (sampleRate * 0.05), (n - i) / (sampleRate * 0.08));
    let v = Math.sin(2 * Math.PI * freq * t) * 0.25 * fade;
    v += Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.1 * fade;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);      // PCM
  header.writeUInt16LE(1, 22);      // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

async function seed() {
  const { migrate: ensureSchema } = require("../mysql/schema");
  await ensureSchema();
  storage.ensurePlaceholders();

  const force = process.argv.includes("--force");
  if (force) await store.resetAll();

  // Seed is additive: it only runs when the fictional catalog is not present yet.
  const anySeeded = (await store.searchSongs("Pixel Drift", 1)).length > 0;
  if (anySeeded && !force) {
    console.log("⚠ Fictional seed catalog already present — skipping (use --force to reset and reseed).");
    return;
  }

  if (!(await store.listUsers()).length) {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash("beatnest123", 10);
    await store.createUser({ email: "demo@beatnest.dev", name: "Demo Listener", passwordHash, role: "user" });
    console.log("✔ Created demo account: demo@beatnest.dev / beatnest123");
  }

  let added = 0;

  // deterministic gradient cover per song (reused across runs)
  const coverCache = new Map();
  async function coverFor(g) {
    const key = g.join("-");
    if (coverCache.has(key)) return coverCache.get(key);
    const fs = require("fs");
    const path = require("path");
    const name = `seed-${key}.png`;
    const p = path.join(storage.COVERS_DIR, name);
    if (!fs.existsSync(p)) fs.writeFileSync(p, storage.makeGradientPng(600, 600, g.slice(0, 3), g.slice(3)));
    const publicPath = `/uploads/covers/${name}`;
    coverCache.set(key, publicPath);
    return publicPath;
  }

  for (let i = 0; i < SEED.length; i++) {
    const s = SEED[i];
    const g = GRADS[i % GRADS.length];
    const audio = storage.writeAudio(makeWav(2.0 + (i % 4) * 0.5, 300 + i * 15), "audio/wav");
    const coverPath = await coverFor(g);
    const artistId = await store.upsertArtist(s.artist);
    const albumId = await store.upsertAlbum(s.album, artistId);
    const genreId = await store.upsertGenre(s.genre);
    const id = await store.insertSong({
      title: s.title, artist_id: artistId, album_id: albumId, genre_id: genreId,
      language: s.language, duration: s.duration, release_date: `${s.year}-01-01`,
      audio_path: audio, cover_path: coverPath, featured: s.featured ? 1 : 0,
      license: s.license || "Artist-uploaded",
      plays: Math.floor(Math.random() * 9000) + 500,
    });
    added += 1;
    if (i === 0) console.log("✔ First seed song id:", id);
  }

  console.log(`✔ Seeded ${added} fictional songs.`);
  console.log(`✔ Placeholder cover: ${storage.ensurePlaceholders()}`);
}

seed().then(() => process.exit(0)).catch((e) => { console.error("Seed failed:", e); process.exit(1); });