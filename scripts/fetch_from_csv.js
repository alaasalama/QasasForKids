/**
 * Fetch only the ayahs referenced in assets/data/database.csv
 * and save them under assets/data/text/<surah>.json for local loading.
 *
 * - Edition: quran-uthmani-quran-academy
 * - Reads CSV with carry-forward logic (like the app)
 * - Only downloads [aya_from..aya_to] for each surah in the CSV
 * - Merges with existing local files (downloads only missing ayahs)
 *
 * Usage:
 *   node scripts/fetch_from_csv.js
 *
 * Requires Node 18+ (global fetch)
 */

const fs = require('fs');
const path = require('path');

const EDITION = 'quran-uthmani-quran-academy';
const API_BASE = 'https://api.alquran.cloud/v1';
const CSV_PATH = path.join(__dirname, '..', 'assets', 'data', 'database.csv');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'data', 'text');
const CONCURRENCY = Number(process.env.CONCURRENCY || 3);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 6);
const BASE_DELAY_MS = Number(process.env.BASE_DELAY_MS || 800);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i++];
    if (inQ) {
      if (c === '"') {
        if (text[i] === '"') { field += '"'; i++; }
        else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') pushField();
      else if (c === '\n') { pushField(); pushRow(); }
      else if (c === '\r') { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  return rows.slice(1)
    .filter(r => r.some(v => (v || '').trim() !== ''))
    .map(r => {
      const o = {}; headers.forEach((h, idx) => o[h] = (r[idx] ?? '').trim()); return o;
    });
}

function collectFromCSV(rows) {
  const carryKeys = ["item_id", "item_name_en", "item_name_ar", "type", "positions"]; // for completeness
  let last = {};
  const rangesBySurah = new Map(); // surah -> Set(ayahNumbers)
  for (const r0 of rows) {
    const r = { ...r0 };
    for (const k of carryKeys) { if (!r[k] || r[k] === '') r[k] = last[k] ?? ''; }
    last = r;
    const s = Number(r.surah_number);
    const from = Number(r.aya_from);
    const to = Number(r.aya_to);
    if (!s || !from || !to) continue;
    const set = rangesBySurah.get(s) || new Set();
    for (let n = from; n <= to; n++) set.add(n);
    rangesBySurah.set(s, set);
  }
  return rangesBySurah;
}

async function fetchAyah(surah, n) {
  const url = `${API_BASE}/ayah/${surah}:${n}/${EDITION}`;
  let attempt = 0;
  while (true) {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      return json?.data?.text || '';
    }
    const status = res.status;
    // Retry on 429/5xx with backoff; otherwise throw
    if ((status === 429 || status >= 500) && attempt < MAX_RETRIES) {
      const ra = res.headers.get('retry-after');
      const wait = ra ? Number(ra) * 1000 : (BASE_DELAY_MS * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
      await sleep(wait);
      attempt++;
      continue;
    }
    throw new Error(`HTTP ${status}`);
  }
}

async function fetchNeededForSurah(surah, needSet, existing) {
  const ayahs = existing?.ayahs ? { ...existing.ayahs } : {};
  const missing = [...needSet].filter(n => ayahs[String(n)] == null);
  if (!missing.length) return { edition: EDITION, surah, ayahs };

  // simple pool
  let i = 0;
  async function worker() {
    while (i < missing.length) {
      const idx = i++;
      const n = missing[idx];
      try {
        const t = await fetchAyah(surah, n);
        ayahs[String(n)] = t;
        process.stdout.write(`surah ${surah} ayah ${n} done\n`);
      } catch (e) {
        console.warn(`surah ${surah} ayah ${n} failed: ${e.message}`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, missing.length) }, () => worker());
  await Promise.all(workers);
  return { edition: EDITION, surah, ayahs };
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCSV(csv);
  const bySurah = collectFromCSV(rows);
  console.log('Surahs found in CSV:', [...bySurah.keys()].join(', '));

  for (const [surah, set] of bySurah.entries()) {
    const outPath = path.join(OUT_DIR, `${surah}.json`);
    let existing = null;
    if (fs.existsSync(outPath)) {
      try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch {}
    }
    process.stdout.write(`Fetching needed ayahs for surah ${surah} (count=${set.size})...\n`);
    const data = await fetchNeededForSurah(surah, set, existing);
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Saved ${outPath}`);
    const have = new Set(Object.keys(data.ayahs || {}));
    const missingCount = [...set].filter(n => !have.has(String(n))).length;
    if (missingCount > 0) console.log(`Remaining missing for surah ${surah}: ${missingCount}`);
  }
  console.log('Done. Local files are under', OUT_DIR);
}

main().catch(err => { console.error(err); process.exit(1); });
