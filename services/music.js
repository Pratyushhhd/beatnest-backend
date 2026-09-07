// Music constants + presentation helpers for the self-hosted catalog.
// All catalog/search/discovery data now comes from MySQL (mysql/store.js).
// No external music providers, no third-party artwork URLs.

const COLORS = [
  { color: "#FF6B6B", accent: "#FFE66D" },
  { color: "#4ECDC4", accent: "#A8E6CF" },
  { color: "#C77DFF", accent: "#E0AAFF" },
  { color: "#FF9F43", accent: "#FFEAA7" },
  { color: "#FD79A8", accent: "#FDCFE8" },
  { color: "#6C5CE7", accent: "#A29BFE" },
  { color: "#00B894", accent: "#55EFC4" },
  { color: "#D63031", accent: "#FF7675" },
  { color: "#0984E3", accent: "#74B9FF" },
  { color: "#E84393", accent: "#FD79A8" },
  { color: "#2D3436", accent: "#636E72" },
  { color: "#B33771", accent: "#E8A0BF" },
];

function hash(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickColors(seed) {
  const c = COLORS[hash(seed) % COLORS.length];
  return { color: c.color, accent: c.accent };
}

// ─── Languages ────────────────────────────────────────────────────
const LANGUAGES = [
  { key: "nepali",   label: "Nepali",     color: "#D63031", accent: "#FF7675" },
  { key: "hindi",    label: "Hindi",      color: "#FF6B6B", accent: "#FFE66D" },
  { key: "english",  label: "English",    color: "#4ECDC4", accent: "#A8E6CF" },
  { key: "newari",   label: "Newari",     color: "#E17055", accent: "#FFEAA7" },
  { key: "maithili", label: "Maithili",   color: "#6C5CE7", accent: "#A29BFE" },
  { key: "bhojpuri", label: "Bhojpuri",   color: "#E84393", accent: "#FD79A8" },
  { key: "punjabi",  label: "Punjabi",    color: "#FF9F43", accent: "#FFEAA7" },
  { key: "bengali",  label: "Bengali",    color: "#0984E3", accent: "#74B9FF" },
  { key: "tamil",    label: "Tamil",      color: "#FD79A8", accent: "#FDCFE8" },
  { key: "telugu",   label: "Telugu",     color: "#D63031", accent: "#FF7675" },
  { key: "malayalam",label: "Malayalam",  color: "#00B894", accent: "#55EFC4" },
  { key: "marathi",  label: "Marathi",    color: "#B33771", accent: "#E8A0BF" },
  { key: "korean",   label: "Korean",     color: "#6C5CE7", accent: "#A29BFE" },
  { key: "japanese", label: "Japanese",   color: "#E84393", accent: "#FD79A8" },
  { key: "hindi_pop",label: "Hindi Pop",  color: "#FF6B6B", accent: "#FFE66D" },
  { key: "instrumental", label: "Instrumental", color: "#2D3436", accent: "#636E72" },
];

const GENRES = [
  { name: "Pop",        color: "#FF6B6B", accent: "#FFE66D" },
  { name: "Rock",       color: "#D63031", accent: "#FF7675" },
  { name: "Hip-Hop",    color: "#6C5CE7", accent: "#A29BFE" },
  { name: "Rap",        color: "#6C5CE7", accent: "#A29BFE" },
  { name: "R&B",        color: "#E84393", accent: "#FD79A8" },
  { name: "Electronic", color: "#00B894", accent: "#55EFC4" },
  { name: "Classical",  color: "#0984E3", accent: "#74B9FF" },
  { name: "Folk",       color: "#E17055", accent: "#FFEAA7" },
  { name: "Indie",      color: "#4ECDC4", accent: "#A8E6CF" },
  { name: "Jazz",       color: "#B33771", accent: "#E8A0BF" },
  { name: "Lo-Fi",      color: "#2D3436", accent: "#636E72" },
  { name: "Acoustic",   color: "#FF9F43", accent: "#FFEAA7" },
  { name: "Devotional", color: "#D63031", accent: "#FF7675" },
  { name: "Romantic",   color: "#FD79A8", accent: "#FDCFE8" },
  { name: "Chill",      color: "#00B894", accent: "#55EFC4" },
  { name: "Workout",    color: "#6C5CE7", accent: "#A29BFE" },
  { name: "Soul",       color: "#E84393", accent: "#FD79A8" },
  { name: "House",      color: "#0984E3", accent: "#74B9FF" },
  { name: "Ambient",    color: "#4ECDC4", accent: "#A8E6CF" },
  { name: "Funk",       color: "#FF9F43", accent: "#FFEAA7" },
];

// ─── Text helpers ─────────────────────────────────────────────────
function normalize(str = "") {
  return String(str).toLowerCase().replace(/\s+/g, " ").trim();
}

function cleanText(str) {
  if (str === null || str === undefined) return "Unknown";
  return String(str).replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&quot;/g, '"').trim();
}

function capitalizeWords(str) {
  return String(str).split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// Placeholder artwork lives on our own server (see services/storage.js).
function fallbackCover() {
  return "/uploads/covers/placeholder.png";
}

function languageLabel(langKey) {
  const l = LANGUAGES.find((x) => x.key === langKey || normalize(x.label) === normalize(langKey));
  return l || { key: langKey, label: capitalizeWords(String(langKey)), color: "#6C5CE7", accent: "#A29BFE" };
}

// ─── Suggestions ──────────────────────────────────────────────────
function searchSuggestions(q, userRecentSearches = []) {
  const query = normalize(q);
  const popular = ["Nepali", "Hindi", "English", "Chill", "Lo-Fi", "Romantic", "Pop", "The Edge Band"];
  const fromHistory = Array.isArray(userRecentSearches) ? userRecentSearches : [];
  const all = [...fromHistory, ...popular];
  if (!query) return [...new Set(all)].slice(0, 6);
  return [...new Set(all)].filter((s) => normalize(s).includes(query)).concat(
    popular.filter((p) => !normalize(p).includes(query) && normalize(p) !== query)
  ).slice(0, 8);
}

module.exports = {
  COLORS, LANGUAGES, GENRES,
  pickColors, fallbackCover, languageLabel, searchSuggestions,
  normalize, cleanText, capitalizeWords,
};