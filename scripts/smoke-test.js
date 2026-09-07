const { spawn } = require("child_process");
const path = require("path");

const server = spawn(process.execPath, ["server.js"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PORT: "4099" },
  stdio: ["ignore", "pipe", "pipe"],
});

let stderr = "";
server.stderr.on("data", (d) => { stderr += d.toString(); });
server.stdout.on("data", (d) => process.stdout.write(d));

const base = "http://127.0.0.1:4099";
const results = [];
async function check(label, url, opts = {}) {
  try {
    const resp = await fetch(base + url, opts);
    const text = await resp.text();
    let body = text;
    try { body = JSON.parse(text); } catch { /* raw */ }
    const ok = resp.ok;
    results.push(`${ok ? "PASS" : "FAIL"} ${label} -> ${resp.status} ${typeof body === "string" ? body.slice(0, 40) : JSON.stringify(body).slice(0, 120)}`);
    return body;
  } catch (e) {
    results.push(`ERROR ${label} -> ${e.message}`);
    return null;
  }
}

async function main() {
  await new Promise((r) => setTimeout(r, 4000));

  const songs = await check("GET /api/songs", "/api/songs");
  const streamId = songs && Array.isArray(songs) && songs[0] ? songs[0].id : null;
  const featured = await check("GET /api/songs/featured", "/api/songs/featured");
  const genres = await check("GET /api/genres", "/api/genres");

  // Range request on stream
  if (streamId) {
    try {
      const resp = await fetch(`${base}/api/stream/${streamId}`, { headers: { Range: "bytes=0-99" } });
      const buf = await resp.arrayBuffer();
      results.push(`${resp.status === 206 ? "PASS" : "FAIL"} GET /api/stream/:id range -> ${resp.status} len=${buf.byteLength} cr=${resp.headers.get("Content-Range")}`);
    } catch (e) { results.push(`ERROR stream -> ${e.message}`); }
  }

  // Auth flow
  const uniq = `t-${Date.now()}@test.dev`;
  const reg = await check("POST /api/auth/register", "/api/auth/register", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: uniq, password: "secret123", name: "Tester" }),
  });
  const token = reg?.token;
  if (token) {
    await check("GET /api/auth/me", "/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (streamId) {
      await check("POST /api/songs/:id/like", `/api/songs/${streamId}/like`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await check("POST /api/songs/:id/download", `/api/songs/${streamId}/download`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      await check("GET /api/library", "/api/library", { headers: { Authorization: `Bearer ${token}` } });
    }
    const pl = await check("POST /api/playlists", "/api/playlists", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test Mix" }),
    });
    if (pl?.id && streamId) {
      await check("POST /api/playlists/:id/songs", `/api/playlists/${pl.id}/songs`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ songId: streamId }),
      });
      await check("GET /api/playlists", "/api/playlists", { headers: { Authorization: `Bearer ${token}` } });
    }
    await check("GET /api/users/me/history", "/api/users/me/history", { headers: { Authorization: `Bearer ${token}` } });
    await check("GET /api/users/me/favorites", "/api/users/me/favorites", { headers: { Authorization: `Bearer ${token}` } });
    await check("POST /api/history/play", "/api/history/play", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ song: { id: streamId, title: "x" } }),
    });
  }

  // Discovery
  await check("GET /api/music/search?q=Nepali", "/api/music/search?q=Nepali");
  await check("GET /api/music/trending", "/api/music/trending");
  await check("GET /api/music/artists", "/api/music/artists");
  await check("GET /api/music/artist?name=The%20Edge%20Band", "/api/music/artist?name=The%20Edge%20Band");
  await check("GET /api/albums", "/api/albums");
  await check("GET /api/search?q=pixel", "/api/search?q=pixel");
  await check("GET /api/stats", "/api/stats");
  await check("GET /api/recommendations", "/api/recommendations");

  // Login with migrated user
  await check("POST /api/auth/login", "/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "tester-000655@test.dev", password: "password123" }),
  });

  console.log("\n── RESULTS ──");
  for (const r of results) console.log(r);
  const fails = results.filter((r) => r.startsWith("FAIL") || r.startsWith("ERROR")).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  server.kill();
}

main().catch((e) => { console.error(e); server.kill(); process.exit(1); });