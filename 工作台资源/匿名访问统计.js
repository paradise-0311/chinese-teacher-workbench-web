/* Umami integration v1. No business data, form values or record contents leave this bridge. */
(function () {
  'use strict';
  if (window.RC4Analytics) return;
  const config = Object.freeze({
    website: '70f86913-9198-43d3-8712-e24673347189',
    hosts: ['paradise-0311.github.io'],
    script: 'https://cloud.umami.is/script.js'
  });
  const module = /\/精品题库\//.test(decodeURI(location.pathname)) ? 'bank' : /\/考情查询\//.test(decodeURI(location.pathname)) ? 'exam' : 'home';
  const prefix = '/chinese-teacher-workbench-web/';
  const routes = new Set(['home', 'exam/stages', 'exam/papers', 'exam/types', 'exam/texts', 'exam/topics', 'bank/home', 'bank/search', 'bank/records', 'bank/other']);
  const events = new Set(['exam_query', 'bank_search', 'group_preview', 'word_export_success']);
  const recent = new Map(), seenMessages = new Set();
  let queue = [], sdkState = 'idle', sent = 0, failures = 0, lastPage = '', stopped = false;
  const enabled = config.hosts.includes(location.hostname) && location.protocol !== 'file:' && navigator.doNotTrack !== '1';
  const isTop = window === window.top;
  const documentToken = Math.random().toString(36).slice(2);
  let serial = 0;
  const safe = fn => { try { return fn(); } catch (_) { /* Analytics must never interrupt the application. */ } };
  function route() {
    if (module === 'home') return 'home';
    if (module === 'exam') {
      const page = window.KQ_V02_UI?.state().page || location.hash.slice(1).split(/[/?]/)[0] || 'stages';
      return routes.has('exam/' + page) ? 'exam/' + page : 'exam/stages';
    }
    const view = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
    return 'bank/' + (!view || view === 'home' ? 'home' : ['search', 'bank'].includes(view) ? 'search' : view === 'records' ? 'records' : 'other');
  }
  function clean(packet) {
    if (!packet || !routes.has(packet.route)) return null;
    const mod = packet.route.split('/')[0];
    if (packet.kind !== 'page' && (packet.kind !== 'event' || !events.has(packet.name))) return null;
    if (packet.kind === 'event' && (packet.name === 'exam_query' ? mod !== 'exam' : mod !== 'bank')) return null;
    return { kind: packet.kind, route: packet.route, ...(packet.kind === 'event' ? { name: packet.name } : {}) };
  }
  // All SDK calls, including accidentally added default calls, pass this strict allowlist.
  function payload(type, value) {
    if (type !== 'event' || !value || value.website !== config.website) return false;
    const path = String(value.url || '');
    if (!path.startsWith(prefix) || !routes.has(path.slice(prefix.length))) return false;
    const r = path.slice(prefix.length), mod = r.split('/')[0];
    if (value.name && (!events.has(value.name) || (value.name === 'exam_query' ? mod !== 'exam' : mod !== 'bank'))) return false;
    return { website: config.website, hostname: location.hostname, url: prefix + r,
      title: mod === 'home' ? '教研工作台' : mod === 'exam' ? '考情查询' : '精品题库',
      referrer: '', screen: screen.width + 'x' + screen.height, language: navigator.language,
      ...(value.name ? { name: value.name, data: { module: mod, environment: location.hostname === 'paradise-0311.github.io' ? 'production' : 'local-validation' } } : {}) };
  }
  window.RC4UmamiBeforeSend = payload;
  function flush() {
    if (!enabled || stopped || !isTop || !window.umami?.track) return;
    const pending = queue; queue = [];
    for (const item of pending) {
      if (Date.now() - item.at > 60000) continue;
      safe(() => {
        const data = payload('event', { website: config.website, url: prefix + item.route, name: item.name });
        if (!data) return;
        const result = window.umami.track(data); sent++;
        Promise.resolve(result).catch(() => { failures++; });
      });
    }
  }
  function receive(packet) {
    const item = clean(packet);
    if (!item || !enabled || stopped) return;
    if (item.kind === 'page') { if (lastPage === item.route) return; lastPage = item.route; }
    if (!isTop) {
      safe(() => window.parent.postMessage({ type: 'rc4-anonymous-analytics-v1', token: documentToken + ':' + (++serial), packet: item }, location.origin));
      return;
    }
    queue.push({ ...item, at: Date.now() });
    if (queue.length > 32) queue.shift();
    flush();
  }
  function track(name, key, cooldown = 30000) {
    if (!enabled) return;
    const token = name + ':' + key, now = Date.now();
    if (now - (recent.get(token) || 0) < cooldown) return;
    recent.set(token, now);
    if (recent.size > 128) recent.delete(recent.keys().next().value);
    receive({ kind: 'event', route: route(), name });
  }
  function page() { receive({ kind: 'page', route: route() }); }
  window.addEventListener('message', e => safe(() => {
    if (!enabled || e.origin !== location.origin || !Array.from(document.querySelectorAll('iframe')).some(f => f.contentWindow === e.source)) return;
    const m = e.data;
    if (m?.type !== 'rc4-anonymous-analytics-v1' || typeof m.token !== 'string' || m.token.length > 80 || seenMessages.has(m.token)) return;
    seenMessages.add(m.token); if (seenMessages.size > 256) seenMessages.delete(seenMessages.values().next().value);
    receive(m.packet);
  }));
  function loadSDK() {
    if (!enabled || !isTop || sdkState !== 'idle') return;
    sdkState = 'loading';
    const tag = document.createElement('script');
    tag.async = true; tag.src = config.script; tag.referrerPolicy = 'no-referrer';
    for (const [key, value] of Object.entries({ websiteId: config.website, autoTrack: 'false', excludeSearch: 'true', excludeHash: 'true', beforeSend: 'RC4UmamiBeforeSend', doNotTrack: 'true', fetchCredentials: 'omit' })) tag.dataset[key] = value;
    const timeout = setTimeout(() => { sdkState = 'unavailable'; stopped = true; queue = []; }, 15000);
    tag.onload = () => { clearTimeout(timeout); if (stopped) return; sdkState = window.umami?.track ? 'ready' : 'unavailable'; flush(); };
    tag.onerror = () => { clearTimeout(timeout); sdkState = 'unavailable'; stopped = true; queue = []; failures++; };
    document.head.append(tag);
  }
  // Read-only, redacted diagnostics: no filters, keywords, group IDs or record contents.
  window.RC4Analytics = Object.freeze({ version: 1, status: () => ({ enabled, module, sdk: sdkState, queued: queue.length, dispatched: sent, failures }) });
  if (!enabled) return;
  const begin = () => { page(); loadSDK(); installObservers(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => safe(begin), { once: true }); else safe(begin);
  window.addEventListener('hashchange', () => safe(page));
  window.addEventListener('popstate', () => safe(page));
  // URL updates are observed without wrapping history or modifying any business function.
  let lastHref = location.href;
  setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; safe(page); } }, 1000);
  window.addEventListener('pageshow', e => { if (e.persisted) { lastPage = ''; safe(page); } });

  function installObservers() {
    if (module === 'home') return;
    let bankHooked = false, previewKey = '', exportOp = null, operationSerial = 0, examTicket = 0;
    let searchIntent = 0, searchExplicit = false, lastQueryKey = '';
    function examQuery(force = false) {
      const ui = window.KQ_V02_UI;
      if (!ui) return;
      const before = JSON.stringify([ui.state().page, ui.state().topic, ui.state().paperView, ui.filters()]);
      const ticket = ++examTicket;
      // Run after the application's original handler has created its loading task.
      setTimeout(() => safe(() => {
        const task = ui.whenIdle();
        Promise.resolve(task).then(ok => safe(() => {
          if (ticket !== examTicket || ok === false || task !== ui.whenIdle()) return;
          const status = ui.state();
          if (!['stages', 'papers', 'types', 'texts', 'topics'].includes(status.page)) return;
          if (status.queryMode && status.queryMode !== 'results' && !status.queryExecuted && status.page !== 'stages') return;
          // Signature is confined to memory for duplicate suppression, never sent or persisted.
          const key = JSON.stringify([status.page, status.topic, status.paperView, ui.filters()]);
          if (!force && key === before) return;
          track('exam_query', key);
        }), () => {});
      }), 0);
    }
    // Window capture also sees submissions handled by the existing mobile drawer.
    window.addEventListener('submit', e => safe(() => {
      if (module === 'exam' && e.target.id === 'searchForm') examQuery(true);
      if (module === 'bank' && !e.target.closest('.record-modal')) { searchIntent = Date.now(); searchExplicit = true; }
    }), true);
    window.addEventListener('change', e => safe(() => {
      if (module === 'exam' && e.target.matches('[data-filter]')) examQuery();
      if (module === 'bank' && !e.target.closest('.record-modal, .basket-dialog, .preview-dialog')) { searchIntent = Date.now(); searchExplicit = false; }
    }), true);
    window.addEventListener('click', e => safe(() => {
      const button = e.target.closest('button');
      if (!button || button.disabled) return;
      if (module === 'exam' && button.closest('#searchForm')) examQuery();
      if (module === 'bank') {
        if (button.textContent.trim() === '导出 Word') exportOp = { id: ++operationSerial, button, busy: false, at: Date.now() };
        if (!button.closest('.record-modal, .basket-dialog, .preview-dialog')) { searchIntent = Date.now(); searchExplicit = false; }
      }
    }), true);
    function scan() {
      if (module !== 'bank') return;
      if (!bankHooked && window.RC4BankData?.query) {
        bankHooked = true;
        const data = window.RC4BankData, original = data.query;
        data.query = function (...args) {
          const promise = original.apply(this, args);
          const intent = searchIntent, explicit = searchExplicit;
          Promise.resolve(promise).then(() => safe(() => {
            const state = data.state();
            if (state.query?.phase !== 'ready') return;
            const key = JSON.stringify(args[1]);
            if (JSON.stringify(state.query.filters) !== key) return;
            const changed = key !== lastQueryKey; lastQueryKey = key;
            if (!intent || intent !== searchIntent || Date.now() - intent > 120000 || (!changed && !explicit) || route() !== 'bank/search') return;
            searchIntent = 0; searchExplicit = false;
            track('bank_search', key);
          }), () => {});
          return promise;
        };
      }
      const preview = document.querySelector('.preview-dialog');
      if (preview && preview.querySelector('.reading-material, .question-unit')) {
        const key = preview.querySelector('#preview-title')?.textContent || 'open';
        if (key !== previewKey) { previewKey = key; track('group_preview', key, 2000); }
      } else if (!preview) previewKey = '';
      if (exportOp) {
        if (Date.now() - exportOp.at > 180000) { exportOp = null; return; }
        if (exportOp.button.disabled) exportOp.busy = true;
        else if (exportOp.busy) {
          if (document.querySelector('.toast > span')?.textContent === 'Word已生成。') track('word_export_success', String(exportOp.id), 0);
          exportOp = null;
        }
      }
    }
    let scheduled = false;
    const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; setTimeout(() => { scheduled = false; safe(scan); }, 0); } });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'], characterData: true });
    const started = Date.now(), hookPoll = setInterval(() => { safe(scan); if (bankHooked || module !== 'bank' || Date.now() - started > 120000) clearInterval(hookPoll); }, 100);
    safe(scan);
  }
})();
