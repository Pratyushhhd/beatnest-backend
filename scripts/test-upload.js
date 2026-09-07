// Manual upload-flow smoke test (admin base64 + artist multipart + rate limit).
const path = require("path");
const { spawn } = require("child_process");

const server = spawn(process.execPath, ["server.js"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PORT: "4098" },
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", (d) => process.stderr.write(d));

const base = "http://127.0.0.1:4098";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { makeGradientPng } = require("../services/storage");
const store = require("../mysql/store");
const bcrypt = require("bcryptjs");

function makeWav(seconds = 1, freq = 440, sr = 44100) {
  const n = Math.round(sr * seconds);
  const d = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) d.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / sr) * 8000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + d.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36);
  h.writeUInt32LE(d.length, 40);
  return Buffer.concat([h, d]);
}

(async () => {
  await sleep(3500);
  const admin = await store.createUser({
    email: "upptest@test.dev", name: "Uploader",
    passwordHash: await bcrypt.hash("secret123", 10), role: "admin",
  });
  const reg = await (await fetch(base + "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "upptest@test.dev", password: "secret123" }),
  })).json();
  const token = reg.token;
  console.log("login ok:", !!token, "user id:", reg.user?.id, "admin db id:", admin.id);

  const wav = makeWav();
  const png = makeGradientPng();

  // 1) base64 JSON upload (what the React Admin panel sends)
  let r = await fetch(base + "/api/admin/songs", {
    method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Multiverse Test", artist: "Test Artist", album: "Tests", genre: "Electronic",
      language: "English", duration: 60, year: 2026, featured: true,
      license: "Artist-uploaded", licenseConfirmed: true,
      audioBase64: "data:audio/wav;base64," + wav.toString("base64"),
      coverBase64: "data:image/png;base64," + png.toString("base64"),
    }),
  });
  const jsonRes = await r.json();
  console.log("base64 upload ->", r.status, "|", jsonRes.title, "|", jsonRes.audioUrl, "|", jsonRes.cover);

  // 2) multipart upload (artist path)
  const fd = new FormData();
  fd.append("title", "Multipart Wave"); fd.append("artist", "Test Artist"); fd.append("album", "Tests");
  fd.append("genre", "Electronic"); fd.append("language", "English"); fd.append("duration", 45);
  fd.append("year", 2026); fd.append("license", "Artist-uploaded"); fd.append("licenseConfirmed", "true");
  fd.append("audio", new Blob([wav], { type: "audio/wav" }), "a.wav");
  fd.append("cover", new Blob([png], { type: "image/png" }), "c.png");
  r = await fetch(base + "/api/songs", { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd });
  const mpRes = await r.json();
  console.log("multipart upload ->", r.status, "|", mpRes.title, "|", mpRes.audioUrl, "|", mpRes.cover);

  // 3) invalid mime rejected (exe pretending to be audio)
  const bad = new FormData();
  bad.append("title", "Hax"); bad.append("artist", "X"); bad.append("album", "X");
  bad.append("genre", "X"); bad.append("language", "X"); bad.append("license", "Owned");
  bad.append("audio", new Blob([Buffer.from("MZ")], { type: "application/x-msdownload" }), "evil.exe");
  r = await fetch(base + "/api/songs", { method: "POST", headers: { Authorization: "Bearer " + token }, body: bad });
  console.log("bad-mime upload ->", r.status, r.status === 400 || r.status === 413 ? "(rejected ✓)" : "(NOT rejected ✗)");

  // 4) auth rate limiting
  let limited = 0;
  for (let i = 0; i < 25; i++) {
    const rr = await fetch(base + "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@x.dev", password: "wrong" }),
    });
    if (rr.status === 429) limited++;
  }
  console.log("auth limiter 429 hits:", limited);

  // 5) streaming the just-uploaded files
  const list = await (await fetch(base + "/api/songs?search=Multiverse")).json();
  for (const s of list) {
    const sr = await fetch(base + "/api/stream/" + s.id, { headers: { Range: "bytes=0-999" } });
    console.log("stream", s.title, "->", sr.status, sr.headers.get("Content-Range"));
  }

  server.kill();
  process.exit(0);
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });