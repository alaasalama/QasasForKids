// story.js - story view, accordion, ayat fetch, single audio controller

(function () {
  const { el, showToast, fetchJSON, parseHashParams, scrollIntoViewCentered, setHashParams } = window.qqkUtils;
  const { loadStoriesFromCSV } = window.qqkCSV;
  const { getSettings, setSettings } = window.qqkState;

  const API_BASE = 'https://api.alquran.cloud/v1';
  // Allowed reciters with Arabic display names
  const RECITERS = [
    { id: 'ar.abdulbasitmurattal', name: 'عبد الباسط (مرتل)' },
    { id: 'ar.alafasy', name: 'مشاري العفاسي' },
    { id: 'ar.husary', name: 'محمود الحصري' },
    { id: 'ar.hudhaify', name: 'علي الحذيفي' },
    { id: 'ar.minshawi', name: 'محمد صديق المنشاوي' },
    { id: 'ar.muhammadayyoub', name: 'محمد أيوب' },
    { id: 'ar.aymanswoaid', name: 'أيمن سويد' },
    { id: 'ar.mahermuaiqly', name: 'ماهر المعيقلي' },
  ];

  let storiesById = {};
  let story = null;
  let selectedPosition = null; // { surahNumber, ayaFrom, ayaTo }

  // Match CSS breakpoint: mobile is < 900px
  function isMobileLayout() {
    return window.matchMedia('(max-width: 899px)').matches;
  }

  // Cache: key -> { ayat: [{n, text, audio}], surahNumber, from, to }
  const memoryCache = new Map();

  function cacheKey(surah, from, to, textE, audioE) {
    return `${surah}|${from}-${to}|${textE}|${audioE}`;
  }

  // Local text cache per surah for offline-first loading
  const localTextCache = new Map(); // surah -> { edition, surah, ayahs: { [n]: text } }

  async function getLocalSurahData(surah) {
    let data = localTextCache.get(surah);
    if (!data) {
      const url = `assets/data/text/${surah}.json?v=${Date.now()}`;
      data = await fetchJSON(url);
      localTextCache.set(surah, data);
    }
    return data;
  }

  async function fetchAyahTextLocalFirst(surah, ayah, edition) {
    // Try local JSON if edition is the default (quran-uthmani-quran-academy)
    if (edition === 'quran-uthmani-quran-academy') {
      try {
        const data = await getLocalSurahData(surah);
        const t = data?.ayahs?.[String(ayah)] ?? data?.ayahs?.[ayah];
        if (t) return t;
      } catch { /* fall back to remote */ }
    }
    // Fallback to remote API
    return fetchAyahTextRemote(surah, ayah, edition);
  }

  async function fetchAyahTextRemote(surah, ayah, edition) {
    const url = `${API_BASE}/ayah/${surah}:${ayah}/${edition}`;
    const json = await fetchJSON(url);
    return json?.data?.text || '';
  }

  async function fetchAyahAudio(surah, ayah, edition) {
    const url = `${API_BASE}/ayah/${surah}:${ayah}/${edition}`;
    const json = await fetchJSON(url);
    return json?.data?.audio || json?.data?.audioSecondary?.[0] || null;
  }

  async function loadAyatForRange(surah, from, to) {
    const settings = getSettings();
    const key = cacheKey(surah, from, to, settings.textEdition, settings.audioEdition);
    if (memoryCache.has(key)) return memoryCache.get(key);

    // Fast path: load local surah JSON once and build text list; defer audio
    const ayat = [];
    try {
      const data = await getLocalSurahData(surah);
      for (let n = from; n <= to; n++) {
        const text = data?.ayahs?.[String(n)] ?? data?.ayahs?.[n] ?? '';
        ayat.push({ n, text, audio: null });
      }
      // Fill any missing ayahs by falling back to local-first per-ayah fetch (may hit API)
      const missing = ayat.filter(a => !a.text);
      if (missing.length) {
        for (const a of missing) {
          try {
            a.text = await fetchAyahTextLocalFirst(surah, a.n, settings.textEdition);
          } catch {
            a.text = '(تعذر تحميل الآية)';
          }
        }
      }
    } catch (e) {
      console.warn('Local text load failed, falling back per-ayah', e);
      for (let n = from; n <= to; n++) {
        try {
          const text = await fetchAyahTextLocalFirst(surah, n, settings.textEdition);
          ayat.push({ n, text, audio: null });
        } catch (err) {
          ayat.push({ n, text: '(تعذر تحميل الآية)', audio: null });
        }
      }
    }
    const result = { surahNumber: surah, from, to, ayat };
    memoryCache.set(key, result);
    return result;
  }

  // Single audio controller
  const AudioController = (() => {
    let audioEl = null;
    let queue = [];
    let index = -1;
    let repeatTotal = 1;
    let repeatRemaining = 1;
    let completedCycles = 0;
    let onUpdate = () => {};
    let onEnd = () => {};

    function ensureEl() {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.addEventListener('ended', handleEnded);
        audioEl.addEventListener('timeupdate', () => onUpdate(index, audioEl));
      }
      return audioEl;
    }

    function stop({ reset = true } = {}) {
      if (audioEl) {
        audioEl.pause();
        audioEl.currentTime = 0;
      }
      // Keep the queue so Play can start again from the beginning
      index = -1;
      if (reset) {
        repeatRemaining = repeatTotal;
        completedCycles = 0;
      }
      onUpdate(index, audioEl);
    }

    function handleEnded() {
      next();
    }

    function setQueue(items, repeatCount = 1, updateCb = () => {}, endCb = () => {}) {
      stop();
      queue = items.slice();
      index = -1;
      repeatTotal = Math.max(1, repeatCount|0);
      repeatRemaining = repeatTotal;
      completedCycles = 0;
      onUpdate = updateCb; onEnd = endCb;
    }

    async function playAt(i) {
      const a = ensureEl();
      if (i < 0 || i >= queue.length) return finishOrRepeat();
      index = i;
      const item = queue[index];
      // Ensure audio URL (fetch lazily if needed)
      let url = item.audio;
      if (!url) {
        try {
          const s = getSettings();
          url = await fetchAyahAudio(item.surahNumber, item.ayahNumber, s.audioEdition);
          item.audio = url;
        } catch (e) {
          console.warn('audio fetch failed', e);
          url = null;
        }
      }
      if (!url) { return next(); }
      a.src = url;
      a.play().catch(err => {
        console.warn('play failed', err);
        next();
      });
      onUpdate(index, a);
    }

    function finishOrRepeat() {
      if (!queue.length) return;
      completedCycles = Math.min(repeatTotal, completedCycles + 1);
      if (repeatRemaining > 1) {
        repeatRemaining -= 1;
        index = -1;
        playAt(0);
      } else {
        repeatRemaining = 0;
        stop({ reset: false });
        onEnd();
      }
    }

    function next() { playAt(index + 1); }
    function prev() { playAt(index - 1); }
    function play() {
      if (index < 0 && repeatRemaining <= 0) {
        repeatRemaining = repeatTotal;
        completedCycles = 0;
      }
      playAt(index < 0 ? 0 : index);
    }
    function pause() { ensureEl().pause(); onUpdate(index, audioEl); }
    function resume() { ensureEl().play().catch(()=>{}); onUpdate(index, audioEl); }

    function hasActiveTrack() {
      return audioEl !== null && index >= 0;
    }

    function isPaused() {
      return hasActiveTrack() && audioEl.paused;
    }

    function setRepeatCount(newRepeat = 1) {
      repeatTotal = Math.max(1, newRepeat|0);
      if (index < 0) {
        repeatRemaining = repeatTotal;
        completedCycles = 0;
      } else {
        completedCycles = Math.min(completedCycles, repeatTotal);
        const remaining = Math.max(1, repeatTotal - completedCycles);
        repeatRemaining = remaining;
      }
    }

    return { setQueue, play, pause, resume, stop, next, prev, hasActiveTrack, isPaused, setRepeatCount };
  })();

  function renderAccordion(story) {
    const acc = document.getElementById('accordion');
    acc.innerHTML = '';
    const entries = Object.entries(story.positionsBySurah).sort((a,b)=> Number(a[0]) - Number(b[0]));
    entries.forEach(([surah, positions], idx) => {
      const headerId = `hdr-${surah}`;
      const panelId = `pnl-${surah}`;
      const item = el('div', { class: 'accordion-item', 'aria-expanded': 'false', dataset: { surah: String(surah) } });
      const btn = el('button', { class: 'accordion-header', id: headerId, 'aria-controls': panelId, 'aria-expanded': 'false' }, [
        `سورة ${positions[0].surahNameAr || positions[0].surahNameEn || ''} (${surah})`,
        el('span', { class: 'ayah-meta' }, `${positions.length} موضع`)
      ]);
      const panel = el('div', { class: 'accordion-panel', id: panelId, role: 'region', 'aria-labelledby': headerId });
      const list = el('div', { class: 'position-list' });
      positions.forEach(p => {
        const b = el('button', { class: 'position-btn', dataset: { surah: String(p.surahNumber), from: String(p.ayaFrom), to: String(p.ayaTo) } });
        b.textContent = `الموضع ${p.positionIndex}: ${p.ayaFrom} – ${p.ayaTo}`;
        b.addEventListener('click', () => onSelectPosition(p, { autoScroll: true }));
        list.appendChild(b);
      });
      panel.appendChild(list);
      btn.addEventListener('click', () => toggleItem(item));
      item.append(btn, panel);
      acc.appendChild(item);
    });
  }

  function toggleItem(item) {
    const expanded = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    const btn = item.querySelector('.accordion-header');
    btn?.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  }

  function clearAyat() {
    document.getElementById('ayat').innerHTML = '';
    setPlaybackStatus('');
    setPlayPauseButtonState(false);
    clearHighlight();
  }

  function setPlaybackStatus(text) {
    const s = document.getElementById('playback-status');
    s.textContent = text || '';
  }

  function setPlayPauseButtonState(isPlaying) {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;
    const icon = btn.querySelector('[data-icon]');
    if (icon) icon.textContent = isPlaying ? '⏸' : '▶';
    btn.dataset.state = isPlaying ? 'pause' : 'play';
    btn.setAttribute('aria-label', isPlaying ? 'إيقاف مؤقت' : 'تشغيل');
  }

  function renderAyat(list) {
    const cont = document.getElementById('ayat');
    cont.innerHTML = '';
    list.forEach(({ n, text }) => {
      const row = el('div', { class: 'ayah', id: `ayah-${n}` }, [
        el('span', { class: 'ayah-meta' }, `(${n})`),
        el('span', { class: 'font-kitab ayah-text' }, text || '')
      ]);
      cont.appendChild(row);
    });
  }

  function clearHighlight() {
    document.querySelectorAll('.ayah-text.current').forEach(e => e.classList.remove('current'));
  }

  function highlightCurrent(n) {
    clearHighlight();
    const row = document.getElementById(`ayah-${n}`);
    const node = row?.querySelector('.ayah-text');
    if (node) { node.classList.add('current'); scrollIntoViewCentered(row); }
  }

  async function onSelectPosition(p, opts = {}) {
    const autoScroll = Boolean(opts.autoScroll);
    // stop existing
    AudioController.stop?.();
    setPlayPauseButtonState(false);
    selectedPosition = { surahNumber: p.surahNumber, ayaFrom: p.ayaFrom, ayaTo: p.ayaTo, positionIndex: p.positionIndex, surahNameAr: p.surahNameAr, surahNameEn: p.surahNameEn };
    setHashParams({ storyId: story.id, surah: p.surahNumber, from: p.ayaFrom, to: p.ayaTo });

    // Mark active surah and collapse others
    const items = document.querySelectorAll('.accordion-item');
    items.forEach(it => {
      const isActive = it.dataset.surah === String(p.surahNumber);
      it.classList.toggle('active-surah', isActive);
      it.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      it.querySelector('.accordion-header')?.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    });

    // Highlight selected position button
    document.querySelectorAll('.position-btn.active').forEach(n => n.classList.remove('active'));
    const btn = document.querySelector(`.position-btn[data-surah="${p.surahNumber}"][data-from="${p.ayaFrom}"][data-to="${p.ayaTo}"]`);
    btn?.classList.add('active');

    // Update position info box
    setPositionInfo(p);

    // On small screens, only auto-scroll for user-triggered selections
    if (autoScroll && isMobileLayout()) {
      document.querySelector('.controls')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    clearAyat();
    setPlaybackStatus('جارٍ التحضير…');
    try {
      const data = await loadAyatForRange(p.surahNumber, p.ayaFrom, p.ayaTo);
      renderAyat(data.ayat);
      setupQueueAndControls(data.ayat);
      setPlaybackStatus(`المقطع جاهز: ${data.ayat.length} آية`);
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ أثناء التحميل.');
    }
  }

  function setPositionInfo(p) {
    const box = document.getElementById('position-info');
    if (!box) return;
    const name = p.surahNameAr || p.surahNameEn || '';
    box.textContent = `الموضع ${p.positionIndex} — سورة ${name} (${p.surahNumber}) — الآيات ${p.ayaFrom}–${p.ayaTo}`;
  }

  function setupQueueAndControls(ayat) {
    const s = getSettings();
    const queue = ayat.map(a => ({ audio: a.audio, ayahNumber: a.n, surahNumber: selectedPosition?.surahNumber || 0 }));

    // Reciter dropdown in player
    const recSel = document.getElementById('reciter-select');
    if (recSel && !recSel.dataset.inited) {
      recSel.innerHTML = RECITERS.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      recSel.value = s.audioEdition;
      recSel.addEventListener('change', () => {
        setSettings({ audioEdition: recSel.value });
        if (selectedPosition) {
          // reload current position to refresh audio URLs
          onSelectPosition(selectedPosition, { autoScroll: false });
        }
      });
      recSel.dataset.inited = '1';
    } else if (recSel) {
      recSel.value = s.audioEdition;
    }

    const repeatSelInline = document.getElementById('repeat-count-inline');
    repeatSelInline.value = String(s.repeat);
    repeatSelInline.onchange = () => {
      const newRepeat = Number(repeatSelInline.value) || 1;
      setSettings({ repeat: newRepeat });
      AudioController.setRepeatCount(newRepeat);
    };
    let lastIdx = -1;
    AudioController.setQueue(queue, s.repeat, (idx, audioEl) => {
      const total = queue.length;
      const isPlaying = Boolean(audioEl) && !audioEl.paused && idx >= 0 && idx < total;
      setPlayPauseButtonState(isPlaying);
      if (idx >= 0 && idx < total) {
        if (idx !== lastIdx) {
          const currentAyah = queue[idx].ayahNumber;
          highlightCurrent(currentAyah);
          lastIdx = idx;
        }
        const progress = audioEl && audioEl.duration ? Math.round((audioEl.currentTime / audioEl.duration) * 100) : 0;
        setPlaybackStatus(`تشغيل: آية ${idx + 1}/${total} — تقدم ${progress}%`);
      } else {
        setPlaybackStatus('');
        clearHighlight();
        lastIdx = -1;
      }
    }, () => {
      setPlaybackStatus('انتهى التشغيل');
      setPlayPauseButtonState(false);
      clearHighlight();
      lastIdx = -1;
    });

    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseBtn && !playPauseBtn.dataset.bound) {
      playPauseBtn.addEventListener('click', () => {
        const state = playPauseBtn.dataset.state;
        if (state === 'pause') {
          AudioController.pause();
          setPlayPauseButtonState(false);
        } else {
          if (AudioController.hasActiveTrack() && AudioController.isPaused()) {
            setPlayPauseButtonState(true);
            AudioController.resume();
          } else {
            setPlayPauseButtonState(true);
            AudioController.play();
          }
        }
      });
      playPauseBtn.dataset.bound = '1';
    }

    const stopBtn = document.getElementById('btn-stop');
    if (stopBtn && !stopBtn.dataset.bound) {
      stopBtn.addEventListener('click', () => {
        AudioController.stop();
        clearHighlight();
        setPlaybackStatus('');
        setPlayPauseButtonState(false);
      });
      stopBtn.dataset.bound = '1';
    }
  }

  function applyDeepLink() {
    const { surah, from, to } = parseHashParams();
    if (surah && from && to) {
      const sNum = Number(surah), a = Number(from), b = Number(to);
      const p = story.positions.find(x => x.surahNumber === sNum && x.ayaFrom === a && x.ayaTo === b) || { surahNumber: sNum, ayaFrom: a, ayaTo: b, positionIndex: 0 };
      // load ayat but do not autoplay; onSelectPosition will expand + mark active
      onSelectPosition(p, { autoScroll: false }).then(() => {
        // paused by default: user can hit play
      });
    } else {
      // No deep link: auto-open first position
      const first = story.positions[0];
      if (first) {
        onSelectPosition(first, { autoScroll: false });
      }
    }
  }

  async function init() {
    window.qqkUtils.initScrollTopButton();
    const params = parseHashParams();
    if (!params.storyId) {
      showToast('لم يتم تحديد القصة.');
      return;
    }
    try {
      const data = await loadStoriesFromCSV();
      storiesById = data.storiesById;
      story = storiesById[params.storyId];
      if (!story) throw new Error('story not found');
      const titleText = story.nameAr || story.nameEn || '—';
      document.getElementById('story-title').textContent = titleText;
      document.title = `${titleText} | قصص القرآن للأطفال`;
      // Update meta description and canonical for SEO
      const descText = `عرض الآيات المرتبطة بقصة ${titleText} مع التلاوة الصوتية.`;
      let md = document.querySelector('meta[name="description"]');
      if (!md) { md = document.createElement('meta'); md.setAttribute('name','description'); document.head.appendChild(md); }
      md.setAttribute('content', descText);
      const params2 = parseHashParams();
      const usp = new URLSearchParams();
      usp.set('storyId', params2.storyId);
      if (params2.surah && params2.from && params2.to) { usp.set('surah', params2.surah); usp.set('from', params2.from); usp.set('to', params2.to); }
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.setAttribute('rel','canonical'); document.head.appendChild(link); }
      link.setAttribute('href', `/story.html?${usp.toString()}`);
      const sectionTitle = document.querySelector('.section-title');
      if (sectionTitle) {
        const count = story.positions?.length || 0;
        sectionTitle.innerHTML = `المواضع <span class="badge">${count}</span>`;
      }
      renderAccordion(story);
      applyDeepLink();
    } catch (e) {
      console.error(e);
      showToast('تعذر تحميل القصة.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
