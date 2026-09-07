// File storage helpers for the self-hosted catalog.
//   - audio/covers land in backend/uploads/music and backend/uploads/covers by default
//   - when Cloudflare R2 is configured (R2_ACCOUNT_ID + creds + bucket + public URL),
//     new uploads go straight to R2 and are referenced by their public URL
//   - legacy local files in <root>/music are still streamed (metadata-only migration)
//   - all paths validated against traversal before touching the disk
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const { v4: uuidv4 } = require("uuid");
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");
const MUSIC_DIR = path.join(UPLOADS_DIR, "music");
const COVERS_DIR = path.join(UPLOADS_DIR, "covers");
const LEGACY_MUSIC_DIR = path.join(__dirname, "..", "..", "music");
const LEGACY_COVERS_DIR = path.join(LEGACY_MUSIC_DIR, "covers");

const PLACEHOLDER_COVER = "/uploads/covers/placeholder.png";

const AUDIO_TYPES = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/wave", "audio/x-wav"],
  ogg: ["audio/ogg", "application/ogg"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  aac: ["audio/aac", "audio/x-aac"],
  flac: ["audio/flac", "audio/x-flac"],
};
const IMAGE_TYPES = {
  jpg: ["image/jpeg", "image/jpg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  svg: ["image/svg+xml"],
};

function ensureDirs() {
  for (const d of [UPLOADS_DIR, MUSIC_DIR, COVERS_DIR]) fs.mkdirSync(d, { recursive: true });
}

// ─── Path sanitization ───────────────────────────────────────────
function resolveMediaPath(storedPath) {
  if (!storedPath || typeof storedPath !== "string") return null;
  const p = storedPath.trim();
  if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")) return null;
  // reject path traversal and OS-absolute paths (drive letters / UNC), while
  // allowing our own URL-style roots like /uploads/music/x.mp3
  if (p.includes("..") || p.includes("\0")) return null;
  if (/^[a-zA-Z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^[\\/][\\/]/.test(p)) return null;
  let root;
  if (p.startsWith("/uploads/music/")) root = MUSIC_DIR;
  else if (p.startsWith("/uploads/covers/")) root = COVERS_DIR;
  else if (p.startsWith("/music/")) root = LEGACY_MUSIC_DIR;
  else if (p.startsWith("/covers/")) root = LEGACY_COVERS_DIR;
  else return null;
  const name = path.basename(p);
  return path.join(root, name);
}

// ─── MIME/extension helpers ──────────────────────────────────────
function extFromMime(mime) {
  const m = String(mime || "").toLowerCase().split(";")[0].trim();
  for (const [ext, mimes] of Object.entries(AUDIO_TYPES)) if (mimes.includes(m)) return ext;
  for (const [ext, mimes] of Object.entries(IMAGE_TYPES)) if (mimes.includes(m)) return ext;
  return null;
}

function mimeForFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  for (const [e, mimes] of Object.entries(AUDIO_TYPES)) if (e === ext) return mimes[0];
  for (const [e, mimes] of Object.entries(IMAGE_TYPES)) if (e === ext) return mimes[0];
  return "application/octet-stream";
}

function isAudioMime(mime) {
  const ext = extFromMime(mime);
  return ext ? !!AUDIO_TYPES[ext] : false;
}

// ─── Cloudflare R2 (S3-compatible object storage) ───────────────
let r2 = null;
function r2Config() {
  const id = (process.env.R2_ACCOUNT_ID || "").trim();
  const key = (process.env.R2_ACCESS_KEY_ID || "").trim();
  const secret = (process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = (process.env.R2_BUCKET || "").trim();
  if (!id || !key || !secret || !bucket) return null;
  return { id, key, secret, bucket };
}

function r2Client() {
  const c = r2Config();
  if (!c) return null;
  if (!r2) {
    r2 = new S3Client({
      region: (process.env.R2_REGION || "").trim() || "auto",
      endpoint: `https://${c.id}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: c.key, secretAccessKey: c.secret },
      maxAttempts: 3,
    });
  }
  return r2;
}

function r2PublicBase() {
  return (process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");
}

function isR2Url(u) {
  const base = r2PublicBase();
  return !!base && String(u || "").startsWith(`${base}/`);
}

async function r2Put(key, buffer, contentType) {
  const c = r2Config();
  const client = r2Client();
  const base = r2PublicBase();
  if (!c || !client || !base) return null;
  await client.send(new PutObjectCommand({
    Bucket: c.bucket, Key: key, Body: buffer, ContentType: contentType || "application/octet-stream",
  }));
  return `${base}/${key}`;
}

async function r2Delete(key) {
  const c = r2Config();
  const client = r2Client();
  if (!c || !client || !key) return;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
  } catch { /* best effort */ }
}

// Strip an R2 object key out of a public URL (or accept a bare key).
function keyFromUrl(url, prefix) {
  const base = r2PublicBase();
  const u = String(url || "");
  if (base && u.startsWith(`${base}/${prefix}`)) return u.slice(base.length + 1);
  if (u.startsWith(`${prefix}`)) return u;
  return null;
}

// ─── Writing uploads ─────────────────────────────────────────────
// buffer → R2 (when configured + public URL set) else local disk.
// Returns a public URL (e.g. https://…r2.dev/music/<uuid>.mp3) or a safe local
// path (e.g. /uploads/music/<uuid>.mp3).
async function saveAudio(buffer, mime) {
  const ext = extFromMime(mime) || "mp3";
  const key = `music/${uuidv4()}.${ext}`;
  const url = await r2Put(key, buffer, mime || "audio/mpeg");
  if (url) return url;
  ensureDirs();
  const name = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(MUSIC_DIR, name), buffer);
  return `/uploads/music/${name}`;
}

async function saveCover(buffer, mime) {
  const ext = extFromMime(mime) || "jpg";
  const key = `covers/${uuidv4()}.${ext}`;
  const url = await r2Put(key, buffer, mime || "image/jpeg");
  if (url) return url;
  ensureDirs();
  const name = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(COVERS_DIR, name), buffer);
  return `/uploads/covers/${name}`;
}

// buffer → disk. Returns a safe public path (e.g. /uploads/music/<uuid>.mp3).
function writeAudio(buffer, mime) {
  const ext = extFromMime(mime) || "mp3";
  ensureDirs();
  const name = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(MUSIC_DIR, name), buffer);
  return `/uploads/music/${name}`;
}

function writeCover(buffer, mime) {
  const ext = extFromMime(mime) || "jpg";
  ensureDirs();
  const name = `${uuidv4()}.${ext}`;
  fs.writeFileSync(path.join(COVERS_DIR, name), buffer);
  return `/uploads/covers/${name}`;
}

// Validate a parsed base64 upload against allowed audio/image types.
function sniffUpload(dataUri) {
  const m = String(dataUri || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const buffer = Buffer.from(m[2], "base64");
  return { mime, buffer };
}

// ─── Placeholder cover (real PNG, generated locally) ─────────────
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (const b of buf) c = table[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Vertical gradient PNG (600x600) — no external assets needed.
function makeGradientPng(width = 600, height = 600, top = [76, 209, 196], bottom = [108, 92, 231]) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    const t = y / (height - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function ensurePlaceholders() {
  ensureDirs();
  const target = path.join(COVERS_DIR, "placeholder.png");
  if (!fs.existsSync(target)) fs.writeFileSync(target, makeGradientPng());
  return PLACEHOLDER_COVER;
}

module.exports = {
  UPLOADS_DIR, MUSIC_DIR, COVERS_DIR, LEGACY_MUSIC_DIR, PLACEHOLDER_COVER,
  ensureDirs, ensurePlaceholders,
  resolveMediaPath, extFromMime, mimeForFile, isAudioMime,
  writeAudio, writeCover, sniffUpload, makeGradientPng,
  saveAudio, saveCover, r2Config, r2Client, r2Put, r2Delete, isR2Url, keyFromUrl,
};