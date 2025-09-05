// home.js - render stories + search

(function () {
  const { el, debounce } = window.qqkUtils;
  const { loadStoriesFromCSV } = window.qqkCSV;

  let stories = [];
  let storiesById = {};
  let activeFilter = 'all'; // 'all' | 'prophet' | 'non-prophet'

  function typeBadge(type) {
    const isProphet = type === 'prophet';
    const label = isProphet ? 'قصص أنبياء' : 'قصص أخرى';
    const cls = isProphet ? 'badge' : 'badge non-prophet';
    return el('span', { class: cls }, label);
  }

  // Use titles exactly as provided in CSV (no prefix/sanitization)

  function cardForStory(s) {
    const url = `story.html#storyId=${encodeURIComponent(s.id)}`;
    const a = el('a', { class: 'card', href: url, 'aria-label': `افتح ${s.nameAr || '—'}` }, [
      el('div', { class: 'card-title' }, s.nameAr || '—'),
      typeBadge(s.type),
    ]);
    return a;
  }

  function renderList(list) {
    const cont = document.getElementById('stories-list');
    const empty = document.getElementById('empty-state');
    cont.innerHTML = '';
    if (!list.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    cont.append(...list.map(cardForStory));
  }

  function matchesQuery(s, q) {
    if (!q) return true;
    const t = q.trim();
    return (s.nameAr || '').includes(t);
  }

  function matchesFilter(s) {
    if (activeFilter === 'all') return true;
    return s.type === activeFilter;
  }

  async function init() {
    try {
      const data = await loadStoriesFromCSV();
      stories = data.stories;
      storiesById = data.storiesById;
      renderList(stories);
    } catch (e) {
      console.error(e);
      window.qqkUtils.showToast('تعذر تحميل القصص. تأكد من تشغيل خادم محلي.');
    }

    const input = document.getElementById('search-input');
    const onSearch = debounce(() => {
      const q = input.value;
      const filtered = stories.filter(s => matchesFilter(s) && matchesQuery(s, q));
      renderList(filtered);
    }, 200);
    input.addEventListener('input', onSearch);

    // Filter buttons
    const btnAll = document.getElementById('filter-all');
    const btnProphet = document.getElementById('filter-prophet');
    const btnOther = document.getElementById('filter-other');
    function updateFilter(filter) {
      activeFilter = filter;
      btnAll.setAttribute('aria-pressed', String(activeFilter === 'all'));
      btnProphet.setAttribute('aria-pressed', String(activeFilter === 'prophet'));
      btnOther.setAttribute('aria-pressed', String(activeFilter === 'non-prophet'));
      const q = input.value;
      const filtered = stories.filter(s => matchesFilter(s) && matchesQuery(s, q));
      renderList(filtered);
    }
    btnAll.addEventListener('click', () => updateFilter('all'));
    btnProphet.addEventListener('click', () => updateFilter('prophet'));
    btnOther.addEventListener('click', () => updateFilter('non-prophet'));
    // Initialize filter to 'all'
    updateFilter('all');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
