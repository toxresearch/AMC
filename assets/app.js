/* Question Library — static, dependency-free, and compatible with file://. */
(() => {
  'use strict';
  const portal = document.body.dataset.library;
  if (!['mathleague', 'amc8', 'combined'].includes(portal)) return;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { if ($(id)) $(id).textContent = value; };
  const catalog = window.QUESTION_CATALOG;
  if (!catalog || !Array.isArray(catalog.questions) || !Array.isArray(catalog.topics)) {
    text('app-status', 'The question catalog could not load. Keep the assets folder next to these HTML files, then reload this page.');
    document.body.dataset.ready = 'error';
    return;
  }
  const topics = new Map(catalog.topics.map(t => [String(t.id), t]));
  const ranks = new Map(catalog.topics.map((t, i) => [String(t.id), i]));
  const allQuestions = catalog.questions;
  const byId = new Map(allQuestions.map(q => [q.id, q]));
  const scoped = allQuestions.filter(q => portal === 'combined' || q.source === portal);
  const scopedIds = new Set(scoped.map(q => q.id));
  const sourceLabels = { mathleague: 'Math League · Grade 4', amc8: 'AMC 8' };
  const normalize = s => String(s || '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  const searchCache = new Map(scoped.map(q => [q.id, normalize([q.id, q.originalId, sourceLabels[q.source], q.year, `Question ${q.number}`, `q${q.number}`, q.text, ...(topics.get(String(q.topicId))?.path || [])].join(' '))]));
  const defaults = () => ({ topic: '0', children: true, source: 'all', year: 'all', search: '', sort: 'topic', size: 24, page: 1, q: '' });
  let state = defaults();
  let filtered = [];
  let renderEpoch = 0;
  let lastLocation = location.href;
  let printJob = null;
  let storageNotice = false;
  const expanded = new Set(catalog.topics.filter(t => t.parent === '0').map(t => String(t.id)));
  const chunkPromises = new Map();
  const selectionKey = 'math-question-library:selection:v1';
  let selected = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(selectionKey) || '[]');
    if (Array.isArray(saved)) selected = new Set(saved.filter(id => typeof id === 'string' && byId.has(id)));
  } catch (_) { /* Selection remains available for this tab. */ }

  function saveSelection() {
    try { localStorage.setItem(selectionKey, JSON.stringify([...selected].sort())); }
    catch (_) {
      if (!storageNotice) {
        text('app-status', 'Selections will last for this tab; browser storage is unavailable.');
        storageNotice = true;
      }
    }
  }
  function scopedSelected() { return scoped.filter(q => selected.has(q.id)).sort(compareQuestions); }
  function compareQuestions(a, b) {
    const year = parseInt(a.year, 10) - parseInt(b.year, 10);
    const source = (a.source === 'mathleague' ? 0 : 1) - (b.source === 'mathleague' ? 0 : 1);
    const topic = (ranks.get(String(a.topicId)) ?? 9999) - (ranks.get(String(b.topicId)) ?? 9999);
    if (state.sort === 'year-asc') return year || source || a.number - b.number || topic;
    if (state.sort === 'year-desc') return -year || source || a.number - b.number || topic;
    return topic || year || source || a.number - b.number || a.id.localeCompare(b.id);
  }
  function selectedTopicMatches(q) {
    if (state.topic === '0') return true;
    if (String(q.topicId) === state.topic) return true;
    return state.children && (topics.get(String(q.topicId))?.pathIds || []).includes(state.topic);
  }
  function baseMatches(q) {
    if (state.q && q.id !== state.q) return false;
    if (portal === 'combined' && state.source !== 'all' && q.source !== state.source) return false;
    if (state.year !== 'all' && q.year !== state.year) return false;
    if (state.search) {
      const haystack = searchCache.get(q.id);
      if (!normalize(state.search).split(' ').every(token => haystack.includes(token))) return false;
    }
    return true;
  }
  function readHash() {
    const next = defaults();
    const params = new URLSearchParams(location.hash.slice(1, 10001));
    const topic = params.get('topic');
    if (topics.has(topic)) next.topic = topic;
    next.children = params.get('children') !== '0';
    if (portal === 'combined' && ['mathleague', 'amc8'].includes(params.get('source'))) next.source = params.get('source');
    const year = params.get('year');
    if (scoped.some(q => q.year === year)) next.year = year;
    next.search = (params.get('search') || '').slice(0, 200);
    if (['topic', 'year-asc', 'year-desc'].includes(params.get('sort'))) next.sort = params.get('sort');
    if ([12, 24, 48].includes(Number(params.get('size')))) next.size = Number(params.get('size'));
    const page = Number(params.get('page'));
    if (Number.isSafeInteger(page) && page > 0 && page <= scoped.length) next.page = page;
    if (scopedIds.has(params.get('q'))) next.q = params.get('q');
    if (next.q) {
      // A copied question link opens that question directly, independent of stale filters.
      next.topic = '0'; next.year = 'all'; next.search = ''; next.source = 'all'; next.page = 1;
    }
    state = next;
    openSelectedAncestors();
  }
  function hashFor(s) {
    const p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.topic !== '0') p.set('topic', s.topic);
    if (!s.children) p.set('children', '0');
    if (portal === 'combined' && s.source !== 'all') p.set('source', s.source);
    if (s.year !== 'all') p.set('year', s.year);
    if (s.search) p.set('search', s.search);
    if (s.sort !== 'topic') p.set('sort', s.sort);
    if (s.size !== 24) p.set('size', String(s.size));
    if (s.page !== 1) p.set('page', String(s.page));
    return p.toString();
  }
  function writeHash(replace = false) {
    const value = hashFor(state);
    if (location.hash.slice(1) === value) return;
    const url = new URL(location.href); url.hash = value;
    try { history[replace ? 'replaceState' : 'pushState']({}, '', url); lastLocation = location.href; }
    catch (_) { location.hash = value; lastLocation = location.href; }
  }
  function openSelectedAncestors() {
    for (const id of topics.get(state.topic)?.pathIds || []) expanded.add(id);
  }
  function applyChanges(changes, replace = false) {
    state = { ...state, q: '', page: 1, ...changes };
    if (changes.topic) openSelectedAncestors();
    writeHash(replace);
    render();
  }
  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  }
  function sourceName(q) { return sourceLabels[q.source] || q.source; }
  function questionName(q) { return `${sourceName(q)} · ${q.year} · Question ${q.number}`; }

  function updateControls() {
    if ($('question-search') && $('question-search').value !== state.search) $('question-search').value = state.search;
    if ($('include-children')) $('include-children').checked = state.children;
    if ($('source-filter-wrap')) $('source-filter-wrap').hidden = portal !== 'combined';
    if ($('source-filter')) $('source-filter').value = state.source;
    if ($('sort-order')) $('sort-order').value = state.sort;
    if ($('page-size')) $('page-size').value = String(state.size);
    const years = [...new Set(scoped.filter(q => state.source === 'all' || q.source === state.source).map(q => q.year))].sort((a, b) => parseInt(b, 10) - parseInt(a, 10) || b.localeCompare(a));
    const yearSelect = $('year-filter');
    if (yearSelect) {
      yearSelect.replaceChildren(new Option('All years', 'all'), ...years.map(y => new Option(y, y)));
      // Retain an explicitly selected year even if a changed source has no results in it.
      if (state.year !== 'all' && !years.includes(state.year)) yearSelect.add(new Option(`${state.year} (no matches)`, state.year));
      yearSelect.value = state.year;
    }
  }
  function updateSelectionUI() {
    const count = scopedSelected().length;
    text('selection-count', `${count.toLocaleString()} selected in this library`);
    text('print-selected', `Print selected (${count.toLocaleString()})`);
    if ($('print-selected')) $('print-selected').disabled = count === 0 || Boolean(printJob);
    if ($('clear-selection')) $('clear-selection').disabled = count === 0;
    for (const input of document.querySelectorAll('input[data-question-id]')) {
      input.checked = selected.has(input.dataset.questionId);
      input.closest('.question-card')?.classList.toggle('selected', input.checked);
    }
  }
  function buildTree(base) {
    const host = $('topic-tree'); if (!host) return;
    const direct = new Map(), subtree = new Map();
    for (const q of base) {
      const id = String(q.topicId); direct.set(id, (direct.get(id) || 0) + 1);
      for (const ancestor of topics.get(id)?.pathIds || ['0', id]) subtree.set(ancestor, (subtree.get(ancestor) || 0) + 1);
    }
    const term = normalize($('topic-search')?.value);
    const searchIds = new Set();
    if (term) for (const t of catalog.topics) {
      if ((subtree.get(String(t.id)) || 0) > 0 && normalize(t.path.join(' ')).includes(term)) for (const id of t.pathIds) searchIds.add(String(id));
    }
    const children = new Map();
    for (const t of catalog.topics) {
      if (String(t.id) === '0' || !(subtree.get(String(t.id)) > 0) || (term && !searchIds.has(String(t.id)))) continue;
      const parent = String(t.parent);
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(t);
    }
    function topicButton(t) {
      const id = String(t.id);
      const button = node('button', 'topic-button'); button.type = 'button'; button.dataset.topicId = id;
      if (id === state.topic) button.setAttribute('aria-current', 'page');
      const name = node('span', 'topic-label', t.label + (id.startsWith('amc8-') ? ' [+]' : ''));
      const count = state.children ? (subtree.get(id) || 0) : (direct.get(id) || 0);
      button.append(name, node('span', 'topic-count', count.toLocaleString()));
      button.title = `${t.path.slice(1).join(' › ')} — ${direct.get(id) || 0} directly assigned; ${subtree.get(id) || 0} including subtopics`;
      button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); applyChanges({ topic: id }); });
      return button;
    }
    function branch(parent) {
      const ul = node('ul', 'topic-list');
      for (const t of children.get(parent) || []) {
        const id = String(t.id); const li = node('li', 'topic-item');
        if (children.has(id)) {
          const detail = node('details', 'topic-node'); detail.dataset.topicId = id;
          detail.open = Boolean(term) || expanded.has(id);
          const summary = node('summary', 'topic-summary'); summary.append(topicButton(t));
          detail.append(summary, branch(id));
          detail.addEventListener('toggle', () => { if (!term) detail.open ? expanded.add(id) : expanded.delete(id); });
          li.append(detail);
        } else { li.classList.add('topic-leaf'); li.append(topicButton(t)); }
        ul.append(li);
      }
      return ul;
    }
    host.replaceChildren(branch('0'));
    if (!host.querySelector('button')) host.append(node('p', 'empty-tree', 'No topics match these filters.'));
    if ($('all-topics')) {
      $('all-topics').textContent = `All topics (${base.length.toLocaleString()})`;
      if (state.topic === '0') $('all-topics').setAttribute('aria-current', 'page'); else $('all-topics').removeAttribute('aria-current');
    }
    text('tree-count-note', state.children ? 'Counts include subtopics.' : 'Counts show questions assigned directly to each topic.');
  }

  function loadChunk(path) {
    if (chunkPromises.has(path)) return chunkPromises.get(path);
    if (!/^assets\/data\/[A-Za-z0-9._-]+\.js$/.test(path)) return Promise.reject(new Error('Invalid question-data file.'));
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = path; script.async = true;
      const timer = setTimeout(() => { cleanup(); reject(new Error('The question-data file took too long to load.')); }, 60000);
      function cleanup() { clearTimeout(timer); script.onload = null; script.onerror = null; script.remove(); }
      script.onload = () => { cleanup(); resolve(); };
      script.onerror = () => { cleanup(); reject(new Error('A question-data file could not load. Check that the assets/data folder was copied completely.')); };
      document.head.append(script);
    }).catch(error => { chunkPromises.delete(path); throw error; });
    chunkPromises.set(path, promise); return promise;
  }
  async function loadQuestion(id) {
    const q = byId.get(id); if (!q) throw new Error('Question not found.');
    if (!window.QUESTION_IMAGES?.[id]) await loadChunk(q.chunk);
    const data = window.QUESTION_IMAGES?.[id];
    if (typeof data !== 'string' || !data.startsWith('data:image/')) throw new Error('This question image is missing from its data file.');
    return data;
  }
  async function inBatches(items, concurrency, action, job) {
    let cursor = 0;
    async function worker() {
      while (cursor < items.length) {
        if (job?.cancelled) throw new DOMException('Cancelled', 'AbortError');
        const item = items[cursor++]; await action(item);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  }
  function makeImage(q, data) {
    const image = node('img', 'question-image');
    image.alt = `${questionName(q)}. Original question, diagrams and answer choices.`;
    image.width = Math.round(q.width * 3); image.height = Math.round(q.height * 3);
    image.style.aspectRatio = `${q.width} / ${q.height}`;
    image.decoding = 'async'; image.src = data;
    return image;
  }
  function imageError(q, wrap, error) {
    const message = node('p', 'image-error', error.message || 'The question could not load.');
    const retry = node('button', 'retry-image', 'Retry question'); retry.type = 'button';
    retry.addEventListener('click', async () => {
      retry.disabled = true; message.textContent = 'Loading question…';
      try { const image = makeImage(q, await loadQuestion(q.id)); await image.decode(); wrap.replaceChildren(image); }
      catch (e) { retry.disabled = false; message.textContent = e.message; }
    });
    wrap.replaceChildren(message, retry);
  }
  async function copyQuestionLink(q, button) {
    const url = new URL(location.href); url.hash = new URLSearchParams({ q: q.id }).toString();
    let success = false;
    try { await navigator.clipboard.writeText(url.href); success = true; }
    catch (_) {
      const field = node('textarea'); field.value = url.href; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      try { success = document.execCommand('copy'); } catch (_) { /* Link shown below when copying is unavailable. */ }
      field.remove();
      if (success) button.focus();
    }
    if (success) { button.textContent = 'Link copied'; setTimeout(() => { if (button.isConnected) button.textContent = 'Copy link'; }, 1800); }
    else {
      const field = node('input', 'copy-link-field'); field.value = url.href; field.readOnly = true; field.setAttribute('aria-label', 'Question link to copy');
      button.after(field); field.focus(); field.select();
    }
  }
  let imageDialog, dialogImage, dialogOpener, zoom = 1, dialogRequest = 0;
  function ensureDialog() {
    if (imageDialog) return;
    imageDialog = node('dialog', 'image-dialog'); imageDialog.id = 'question-dialog'; imageDialog.setAttribute('aria-labelledby', 'dialog-title');
    const header = node('div', 'image-dialog-header'); const title = node('h2'); title.id = 'dialog-title';
    const close = node('button', '', 'Close'); close.type = 'button'; close.id = 'close-dialog'; close.addEventListener('click', () => imageDialog.close());
    header.append(title, close);
    const tools = node('div', 'image-dialog-tools'); const out = node('button', '', '−'); out.id = 'zoom-out'; out.type = 'button'; out.setAttribute('aria-label', 'Zoom out');
    const value = node('output', '', '100%'); value.id = 'zoom-value';
    const inside = node('button', '', '+'); inside.id = 'zoom-in'; inside.type = 'button'; inside.setAttribute('aria-label', 'Zoom in');
    const levels = [.75, 1, 1.25, 1.5, 2];
    function changeZoom(delta) { zoom = levels[Math.max(0, Math.min(levels.length - 1, levels.indexOf(zoom) + delta))]; updateZoom(); }
    function updateZoom() { dialogImage.style.width = `${900 * zoom}px`; value.value = `${Math.round(zoom * 100)}%`; out.disabled = zoom === levels[0]; inside.disabled = zoom === levels[levels.length - 1]; }
    out.addEventListener('click', () => changeZoom(-1)); inside.addEventListener('click', () => changeZoom(1)); tools.append(out, value, inside);
    const body = node('div', 'image-dialog-body'); dialogImage = node('img'); dialogImage.id = 'dialog-image'; body.append(dialogImage);
    imageDialog.append(header, tools, body); document.body.append(imageDialog);
    imageDialog.addEventListener('close', () => { dialogRequest++; dialogOpener?.focus(); });
    imageDialog.addEventListener('click', event => { if (event.target === imageDialog) { const r = imageDialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) imageDialog.close(); } });
    imageDialog.updateZoom = updateZoom;
  }
  async function enlarge(q, opener) {
    ensureDialog(); const request = ++dialogRequest; dialogOpener = opener; zoom = 1; imageDialog.updateZoom();
    text('dialog-title', questionName(q)); dialogImage.alt = `${questionName(q)}. Original question and choices.`;
    dialogImage.removeAttribute('src'); imageDialog.showModal();
    $('close-dialog').focus();
    try { const data = await loadQuestion(q.id); if (request === dialogRequest && imageDialog.open) dialogImage.src = data; }
    catch (error) { if (request === dialogRequest && imageDialog.open) text('dialog-title', error.message); }
  }

  async function render() {
    const epoch = ++renderEpoch; document.body.dataset.loading = 'true';
    if (!printJob) text('app-status', '');
    updateControls();
    const base = scoped.filter(baseMatches);
    filtered = base.filter(selectedTopicMatches).sort(compareQuestions);
    const pages = Math.max(1, Math.ceil(filtered.length / state.size));
    state.page = Math.min(state.page, pages); writeHash(true);
    buildTree(base);
    const start = (state.page - 1) * state.size; const visible = filtered.slice(start, start + state.size);
    const label = state.q ? 'One question · direct link' : state.topic === '0' ? 'All topics' : topics.get(state.topic)?.path.slice(1).join(' › ');
    text('active-topic', label);
    text('result-count', `${filtered.length.toLocaleString()} of ${scoped.length.toLocaleString()} questions`);
    text('page-status', filtered.length ? `${start + 1}–${Math.min(start + state.size, filtered.length)} · Page ${state.page} of ${pages}` : 'No matching questions');
    if ($('prev-page')) $('prev-page').disabled = state.page <= 1;
    if ($('next-page')) $('next-page').disabled = state.page >= pages;
    if ($('print-filtered')) { $('print-filtered').textContent = `Print filtered (${filtered.length.toLocaleString()})`; $('print-filtered').disabled = !filtered.length || Boolean(printJob); }
    if ($('select-filtered')) $('select-filtered').disabled = !filtered.length;
    updateSelectionUI();
    const host = $('question-list'); if (!host) return;
    host.replaceChildren();
    if (!visible.length) {
      const empty = node('div', 'empty-state'); empty.append(node('h2', '', 'No questions match'), node('p', '', 'Try another topic, clear the search, or reset the filters.'));
      host.append(empty); document.body.dataset.loading = 'false'; document.body.dataset.ready = 'true'; return;
    }
    const targets = [];
    for (const q of visible) {
      const card = node('article', 'question-card'); card.id = `question-${q.id}`; card.dataset.questionId = q.id; card.setAttribute('aria-label', questionName(q)); card.classList.toggle('selected', selected.has(q.id));
      const header = node('div', 'question-heading');
      const meta = node('div', 'question-meta'); meta.append(node('span', `source-badge source-${q.source}`, sourceName(q)), node('span', '', q.year), node('span', '', `Question ${q.number}`));
      const actions = node('div', 'question-actions');
      const label = node('label', 'question-select'); const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.questionId = q.id; input.checked = selected.has(q.id); input.setAttribute('aria-label', `Select ${questionName(q)}`);
      input.addEventListener('change', () => { input.checked ? selected.add(q.id) : selected.delete(q.id); saveSelection(); updateSelectionUI(); });
      label.append(input, node('span', '', 'Select'));
      const zoomButton = node('button', 'enlarge-question', 'Enlarge'); zoomButton.type = 'button'; zoomButton.addEventListener('click', () => enlarge(q, zoomButton));
      const copy = node('button', 'copy-link', 'Copy link'); copy.type = 'button'; copy.addEventListener('click', () => copyQuestionLink(q, copy)); actions.append(label, zoomButton, copy);
      header.append(meta);
      const t = topics.get(String(q.topicId)); const path = node('div', 'question-topic topic-path', t?.path.slice(1).join(' › ') || 'Unclassified');
      if (String(q.topicId).startsWith('amc8-')) path.append(node('span', 'added-topic', ' [+] Added category'));
      const wrap = node('div', 'question-image-wrap'); wrap.style.minHeight = `${Math.min(180, q.height * 4 / 3)}px`;
      const placeholder = node('p', 'image-loading', 'Loading question…'); wrap.append(placeholder);
      card.append(header, path, wrap, actions); host.append(card); targets.push({ q, wrap });
    }
    document.body.dataset.ready = 'true';
    let failures = 0;
    await inBatches(targets, 4, async ({ q, wrap }) => {
      try {
        const data = await loadQuestion(q.id); if (epoch !== renderEpoch) return;
        const image = makeImage(q, data); await image.decode(); if (epoch !== renderEpoch) return;
        wrap.replaceChildren(image); wrap.style.minHeight = '';
      } catch (error) { if (epoch === renderEpoch) { failures++; imageError(q, wrap, error); } }
    });
    if (epoch === renderEpoch) {
      document.body.dataset.loading = 'false';
      if (!printJob) text('app-status', failures ? `${failures} question image${failures === 1 ? '' : 's'} could not load. Use Retry question below.` : '');
    }
  }

  function setPrintBusy(busy) {
    if ($('print-filtered')) $('print-filtered').disabled = busy || filtered.length === 0;
    if ($('print-selected')) $('print-selected').disabled = busy || scopedSelected().length === 0;
    if ($('cancel-print')) $('cancel-print').hidden = !busy;
  }
  function finishPrint() {
    if (printJob) printJob.cancelled = true;
    printJob = null; document.body.classList.remove('print-prepared');
    $('print-area')?.replaceChildren(); setPrintBusy(false); text('print-status', '');
  }
  function cancelPrint() { finishPrint(); text('print-status', 'Print preparation cancelled.'); }
  async function preparePrint(mode = 'filtered') {
    if (printJob) throw new Error('Print preparation is already running.');
    const snapshot = { ...state };
    const questions = (mode === 'selected' ? scopedSelected() : filtered.slice());
    const description = mode === 'selected' ? 'Selected questions' : (snapshot.q ? 'Direct question link' : snapshot.topic === '0' ? 'All topics' : topics.get(snapshot.topic)?.path.slice(1).join(' › '));
    if (!questions.length) throw new Error('There are no questions to print.');
    const host = $('print-area'); if (!host) throw new Error('The printable area is missing.');
    const job = { cancelled: false, mode }; printJob = job; setPrintBusy(true);
    host.replaceChildren();
    let ready = 0;
    try {
      const paths = [...new Set(questions.map(q => q.chunk))];
      text('print-status', `Preparing ${questions.length.toLocaleString()} questions. Loading question files…`);
      await inBatches(paths, 2, path => loadChunk(path), job);
      if (job.cancelled) throw new DOMException('Cancelled', 'AbortError');
      const heading = node('header', 'print-heading');
      heading.append(node('h1', '', portal === 'mathleague' ? 'Math League · Grade 4' : portal === 'amc8' ? 'AMC 8' : 'Math League + AMC 8'));
      heading.append(node('p', '', `${questions.length.toLocaleString()} questions · ${description}`));
      host.append(heading);
      const entries = questions.map(q => {
        const article = node('article', 'print-question'); article.dataset.questionId = q.id;
        article.append(node('h2', 'print-question-title', questionName(q)), node('p', 'print-question-topic', topics.get(String(q.topicId))?.path.slice(1).join(' › ') || ''));
        host.append(article); return { q, article };
      });
      await inBatches(entries, 4, async ({ q, article }) => {
        const image = makeImage(q, await loadQuestion(q.id)); image.loading = 'eager'; await image.decode();
        if (job.cancelled) throw new DOMException('Cancelled', 'AbortError');
        article.append(image); ready++;
        text('print-status', `Preparing questions: ${ready.toLocaleString()} of ${questions.length.toLocaleString()}…`);
        if (ready % 16 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }, job);
      if (job.cancelled) throw new DOMException('Cancelled', 'AbortError');
      document.body.classList.add('print-prepared');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (job.cancelled || printJob !== job) throw new DOMException('Cancelled', 'AbortError');
      text('print-status', `${questions.length.toLocaleString()} questions ready to print.`);
      return { count: questions.length, ids: questions.map(q => q.id) };
    } catch (error) {
      if (printJob === job) { finishPrint(); text('print-status', error.name === 'AbortError' ? 'Print preparation cancelled.' : `Could not prepare printing: ${error.message}`); }
      throw error;
    }
  }
  async function printQuestions(mode) {
    if (printJob) return;
    const preparation = preparePrint(mode);
    const ownJob = printJob;
    try { await preparation; if (printJob === ownJob && ownJob && !ownJob.cancelled) window.print(); }
    catch (error) {
      if (printJob === ownJob && ownJob) { finishPrint(); text('print-status', `Could not open printing: ${error.message}`); }
      // Preparation errors and cancellations already set an explanatory status.
    }
  }
  window.addEventListener('afterprint', () => { if (printJob) finishPrint(); });

  let searchTimer;
  $('question-search')?.addEventListener('input', event => { clearTimeout(searchTimer); const value = event.target.value.slice(0, 200); searchTimer = setTimeout(() => applyChanges({ search: value }, true), 180); });
  $('topic-search')?.addEventListener('input', () => buildTree(scoped.filter(baseMatches)));
  $('year-filter')?.addEventListener('change', event => applyChanges({ year: event.target.value }));
  $('source-filter')?.addEventListener('change', event => applyChanges({ source: event.target.value || 'all', year: 'all' }));
  $('sort-order')?.addEventListener('change', event => applyChanges({ sort: event.target.value }));
  $('page-size')?.addEventListener('change', event => applyChanges({ size: Number(event.target.value) }));
  $('include-children')?.addEventListener('change', event => applyChanges({ children: event.target.checked }));
  $('all-topics')?.addEventListener('click', () => applyChanges({ topic: '0' }));
  $('expand-topics')?.addEventListener('click', () => { for (const t of catalog.topics) expanded.add(String(t.id)); buildTree(scoped.filter(baseMatches)); });
  $('collapse-topics')?.addEventListener('click', () => { expanded.clear(); buildTree(scoped.filter(baseMatches)); });
  $('reset-filters')?.addEventListener('click', () => { clearTimeout(searchTimer); state = defaults(); if ($('topic-search')) $('topic-search').value = ''; writeHash(); render(); });
  $('prev-page')?.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); writeHash(); render(); $('question-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('next-page')?.addEventListener('click', () => { state.page++; writeHash(); render(); $('question-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('select-filtered')?.addEventListener('click', () => { for (const q of filtered) selected.add(q.id); saveSelection(); updateSelectionUI(); text('app-status', `Selected ${filtered.length.toLocaleString()} filtered questions.`); });
  $('clear-selection')?.addEventListener('click', () => { for (const q of scoped) selected.delete(q.id); saveSelection(); updateSelectionUI(); });
  $('print-filtered')?.addEventListener('click', () => printQuestions('filtered'));
  $('print-selected')?.addEventListener('click', () => printQuestions('selected'));
  $('cancel-print')?.addEventListener('click', cancelPrint);
  function navigateFromHistory() { if (location.href === lastLocation) return; lastLocation = location.href; clearTimeout(searchTimer); readHash(); render(); }
  window.addEventListener('popstate', navigateFromHistory); window.addEventListener('hashchange', navigateFromHistory);
  window.addEventListener('storage', event => {
    if (event.key !== selectionKey) return;
    try { const value = JSON.parse(event.newValue || '[]'); if (Array.isArray(value)) { selected = new Set(value.filter(id => byId.has(id))); updateSelectionUI(); } } catch (_) { /* Ignore malformed external values. */ }
  });
  window.QuestionLibrary = Object.freeze({
    getState: () => ({ ...state }), getFilteredIds: () => filtered.map(q => q.id),
    getSelectedIds: () => scopedSelected().map(q => q.id), preparePrint, finishPrint, cancelPrint, loadQuestion,
    getCounts: () => ({ total: scoped.length, filtered: filtered.length, selected: scopedSelected().length })
  });
  if (window.matchMedia?.('(max-width: 860px)').matches && $('topic-panel')) $('topic-panel').open = false;
  readHash(); render();
})();
