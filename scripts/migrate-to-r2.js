// One-time migration: copy locally-stored audio/covers to Cloudflare R2 and
// point the DB at the R2 public URLs. Local files are left untouched (only
// copied), so reverting = restoring audio_path/cover_path and deleting nothing.
//
// Usage:
//   node scripts/migrate-to-r2.js [--dry-run]
//
// Requires R2_* env vars (see .env.example). The bucket must be publicly
// readable and have a CORS rule, otherwise the public URLs won't play.
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { getPool } = require("../mysql/pool");
const storage = require("../services/storage");

const DRY = process.argv.includes("--dry-run");

async function main() {
  const c = storage.r2Config();
  if (!c) {
    console.error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL in .env");
    process.exit(1);
  }
  if (!storage.r2PublicBase()) {
    console.error("R2_PUBLIC_URL is required so the DB can reference uploaded files.");
    process.exit(1);
  }
  const [rows] = await getPool().query(
    "SELECT id, title, audio_path, cover_path FROM songs"
  );
  console.log(`R2 ready: bucket=${c.bucket} public=${storage.r2PublicBase()} (${DRY ? "DRY-RUN, no writes" : "live"})`);
  console.log(`Found ${rows.length} songs.`);

  let movedAudio = 0, movedCovers = 0, skipped = 0;

  for (const r of rows) {
    // ── audio ──
    if (r.audio_path && !/^https?:\/\//i.test(r.audio_path) && !/^data:/i.test(r.audio_path)) {
      const disk = storage.resolveMediaPath(r.audio_path);
      if (!disk || !fs.existsSync(disk)) {
        console.log(`  • ${r.id} "${r.title}" audio MISSING on disk: ${r.audio_path}`);
        skipped++;
        continue;
      }
      const key = r.audio_path.startsWith("/music/")
        ? `music/legacy/${path.basename(r.audio_path)}`
        : `music/${path.basename(r.audio_path)}`;
      if (!DRY) {
        await storage.r2Put(key, fs.readFileSync(disk), storage.mimeForFile(disk));
        await getPool().query("UPDATE songs SET audio_path = ? WHERE id = ?", [`${storage.r2PublicBase()}/${key}`, r.id]);
      }
      console.log(`  ✓ ${r.id} "${r.title}" audio → ${key}`);
      movedAudio++;
    }

    // ── cover (skip placeholder / missing) ──
    const cp = r.cover_path || "";
    const isLocalCover = cp && !/^https?:\/\//i.test(cp) && !/^data:/i.test(cp) && !cp.includes("placeholder.png");
    if (isLocalCover) {
      const disk = storage.resolveMediaPath(cp);
      if (disk && fs.existsSync(disk)) {
        const key = cp.startsWith("/music/") || cp.startsWith("/covers/")
          ? `covers/legacy/${path.basename(cp)}`
          : `covers/${path.basename(cp)}`;
        if (!DRY) {
          await storage.r2Put(key, fs.readFileSync(disk), storage.mimeForFile(disk));
          await getPool().query("UPDATE songs SET cover_path = ? WHERE id = ?", [`${storage.r2PublicBase()}/${key}`, r.id]);
        }
        console.log(`  ✓ ${r.id} cover → ${key}`);
        movedCovers++;
      }
    }
  }

  console.log(`\nDone. audio moved: ${movedAudio}, covers moved: ${movedCovers}, skipped/missing: ${skipped}.`);
  if (DRY) console.log("Dry run — nothing was uploaded or updated. Remove --dry-run to run for real.");
  process.exit(0);
}

main().catch((e) => { console.error("Migration failed:", e); process.exit(1); });