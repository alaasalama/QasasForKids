// csv.js - CSV parsing and normalization into stories

// Parses CSV text into array of objects using the first row as headers.
function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  function endField() { row.push(field); field = ''; }
  function endRow() { rows.push(row); row = []; }
  while (i < text.length) {
    const c = text[i++];
    if (inQuotes) {
      if (c === '"') {
        if (text[i] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { endField(); }
      else if (c === '\n') { endField(); endRow(); }
      else if (c === '\r') { /* ignore */ }
      else { field += c; }
    }
  }
  // last field/row
  if (field.length || row.length) { endField(); endRow(); }

  if (!rows.length) return [];
  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '').trim());
  const data = rows.slice(1).filter(r => r.some(v => v.trim() !== ""));
  return data.map(r => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

// Normalize CSV rows into stories with carry-forward logic.
function normalizeStories(csvRows) {
  const carryKeys = ["item_id", "item_name_en", "item_name_ar", "type", "positions"];
  const normalized = [];
  let last = {};
  for (const row of csvRows) {
    const obj = { ...row };
    for (const k of carryKeys) {
      if (!obj[k] || obj[k] === '') obj[k] = last[k] ?? '';
    }
    last = obj;
    normalized.push(obj);
  }

  // Build story map
  const storiesById = {};
  for (const r of normalized) {
    const idFromCsv = (r.item_id || '').toString().trim();
    const nameEn = r.item_name_en || '';
    const id = idFromCsv || window.qqkUtils.slugify(nameEn);
    if (!id) continue;

    if (!storiesById[id]) {
      storiesById[id] = {
        id,
        nameAr: r.item_name_ar || '',
        nameEn: nameEn || '',
        type: (() => {
          const t = (r.type || '').trim().toLowerCase();
          if (t === 'نبي') return 'prophet';
          if (t.includes('prophet') && !t.includes('non')) return 'prophet';
          return 'non-prophet';
        })(),
        positions: [],
      };
    }
    const posIdx = Number(r.positions || r.position || r.pos || 0) || (storiesById[id].positions.length + 1);
    const surahNum = Number(r.surah_number);
    const ayaFrom = Number(r.aya_from);
    const ayaTo = Number(r.aya_to);
    storiesById[id].positions.push({
      positionIndex: posIdx,
      surahNumber: surahNum,
      surahNameEn: r.surah_name || '',
      surahNameAr: r.surah_name_ar || '',
      ayaFrom,
      ayaTo,
    });
  }

  const stories = Object.values(storiesById).map(story => {
    const bySurah = {};
    for (const p of story.positions) {
      if (!bySurah[p.surahNumber]) bySurah[p.surahNumber] = [];
      bySurah[p.surahNumber].push(p);
    }
    // sort positions by index
    for (const k of Object.keys(bySurah)) bySurah[k].sort((a, b) => a.positionIndex - b.positionIndex);
    story.positions.sort((a,b)=> a.positionIndex - b.positionIndex);
    story.positionsBySurah = bySurah;
    return story;
  });

  return { stories, storiesById };
}

async function loadStoriesFromCSV(path = "assets/data/database.csv") {
  const url = path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now(); // cache-bust in dev
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error("تعذر تحميل قاعدة البيانات");
  const text = await res.text();
  const rows = parseCSV(text);
  return normalizeStories(rows);
}

window.qqkCSV = { parseCSV, normalizeStories, loadStoriesFromCSV };
