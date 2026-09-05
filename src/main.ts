import './styles.css';
import IndexWorker from './indexer.worker?worker';
import { deleteArchive, deleteDemoStorage, getArchives, getMessages, saveArchive, saveMessages, setDemoStorage, type ArchiveRecord } from './db';
import { bloomHas, formatBytes, parseMessage, safeFilename, SEARCH_SCOPE_BYTES, searchPrefixContainsTerms, type MessageRecord, type ParsedMessage } from './parser';
import { createZip, type ZipEntry } from './zip';

const app = document.querySelector<HTMLDivElement>('#app')!;
const PRODUCT = 'mbox-takeout-viewer';
const API_BASE = 'https://api.sociobot.in/api/v1';
const PAGE_SIZE = 80;

type AppView = 'welcome' | 'indexing' | 'workspace' | 'reader' | 'not-found';
interface AppState {
  view: AppView;
  archives: ArchiveRecord[];
  archive?: ArchiveRecord;
  file?: File;
  records: MessageRecord[];
  query: string;
  sender: string;
  fromDate: string;
  toDate: string;
  hasAttachments: boolean;
  sort: 'newest' | 'oldest' | 'archive';
  selected: Set<number>;
  page: number;
  current?: MessageRecord;
  parsed?: ParsedMessage;
  pro: boolean;
  expected?: ArchiveRecord;
  online: boolean;
  verifiedSearchIds: Set<number>;
  searchChecking: boolean;
  searchNeedsReconnect: boolean;
  demo: boolean;
}

const state: AppState = {
  view: 'welcome', archives: [], records: [], query: '', sender: '', fromDate: '', toDate: '', online: navigator.onLine,
  hasAttachments: false, sort: 'newest', selected: new Set(), page: 0, pro: readCachedLicense(),
  verifiedSearchIds: new Set(), searchChecking: false, searchNeedsReconnect: false,
  demo: false,
};
let worker: Worker | undefined;
let saveQueue = Promise.resolve();
let persistenceFailed = false;
let focusReturnId: number | undefined;
let activeObjectUrls: string[] = [];
let searchVerificationId = 0;

void init();

async function init(): Promise<void> {
  captureReturnedLicense();
  state.pro = readCachedLicense();
  const initialUrl = new URL(location.href);
  state.demo = initialUrl.pathname === '/demo' || initialUrl.pathname.startsWith('/demo/') || initialUrl.searchParams.get('demo') === '1';
  if (initialUrl.searchParams.get('demo') === '1' && initialUrl.pathname !== '/demo') {
    history.replaceState({}, '', '/demo');
  }
  setDemoStorage(state.demo);
  try { state.archives = await getArchives(); } catch { /* private browsing can disable IDB */ }
  bindGlobalEvents();
  window.addEventListener('popstate', () => { void restoreRoute(); });
  if (state.demo && !state.archives.length) await openSample();
  else await restoreRoute(false);
  void verifyLicense();
  registerServiceWorker();
}

function chrome(content: string): string {
  return `<div class="shell">
    ${state.online ? '' : '<div class="offline-banner" role="status">Offline — local archives and saved indexes still work.</div>'}
    ${state.demo ? '<div class="demo-banner" role="status">Demo — sample data, nothing is saved <span><button class="ghost" data-action="reset-demo">Reset demo</button><button class="ghost" data-action="start-real">Start for real</button></span></div>' : ''}
    <header class="site-header">
      <a class="brand" href="/" data-action="home" aria-label="Paper Trail home"><span class="brand-mark" aria-hidden="true"></span>Paper Trail</a>
      <div class="top-actions">
        <nav class="site-nav" aria-label="Primary"><a href="/demo" data-action="demo-link">Demo</a><a href="/privacy/">Privacy</a></nav>
        <button class="icon-button" data-action="license" aria-label="License and unlock" title="License and unlock">${state.pro ? '★' : '◇'}</button>
      </div>
    </header>
    <main id="main">${content}</main>
    <footer class="site-footer"><span>Search Gmail Takeout archives in your browser.</span><nav class="footer-links" aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="https://github.com/B-Divyesh/sf-mbox-takeout-viewer" rel="noreferrer">Source (GitHub)</a></nav><small>Paper Trail · version 1.0.0</small></footer>
    <div class="toast-dock" id="toastDock" aria-live="polite" aria-atomic="true"></div>
    <div class="sr-only" id="route-announcement" aria-live="polite" aria-atomic="true"></div>
    <input class="sr-only" id="fileInput" type="file" aria-label="Choose an MBOX archive" accept=".mbox,.gz,.mbox.gz,application/mbox,application/gzip" tabindex="-1" />
  </div>`;
}

function render(): void {
  revokeObjectUrls();
  if (state.view === 'welcome') renderWelcome();
  else if (state.view === 'indexing') renderIndexing();
  else if (state.view === 'workspace') renderWorkspace();
  else if (state.view === 'reader') renderReader();
  else renderNotFound();
  bindViewEvents();
}

function renderWelcome(): void {
  const recent = state.archives.length ? `<section class="how" aria-labelledby="recent-title"><h2 id="recent-title">Recently indexed</h2><ul class="message-list">${state.archives.slice(0, 4).map((archive) => `<li class="message-row"><span aria-hidden="true">▤</span><span class="sender">${esc(archive.name)}</span><button data-open-archive="${esc(archive.id)}" class="subject-button"><span class="subject">Reconnect this archive</span><span class="snippet">${archive.count.toLocaleString()} messages · indexed ${formatDate(archive.indexedAt)}</span></button><span class="date-size">${formatBytes(archive.size)}</span></li>`).join('')}</ul></section>` : '';
  app.innerHTML = chrome(`<section class="welcome" id="dropZone">
    <div><p class="eyebrow">Gmail Takeout archive viewer</p><h1>Search your Gmail Takeout archive</h1>
      <p class="lede">For people finding one needed email. Read messages and export selected emails in this browser.</p>
      <ul class="promise-list"><li>Choose an archive from your device.</li><li>Search messages, sender, dates, and attachments.</li><li>Try the sample inbox before opening your own.</li></ul>
      <div class="hero-actions"><button class="primary" data-action="open">Open your Takeout archive</button><a class="button" href="/demo" data-action="demo-link">Try it with sample data</a><button class="ghost" data-action="import-index">Restore a saved archive backup</button></div>
      <p class="file-note">The sample opens an inbox you can search and export.</p>
      <p class="backup-note">Use a backup created by Paper Trail to restore its saved message list.</p>
    </div>
    <div class="hero-art-wrap"><span class="stamp">Your archive desk</span><img class="hero-art" src="/assets/hero-archive.webp" width="1152" height="768" fetchpriority="high" alt="A folded email archive passing through a hand-cranked indexer into sorted message cards" /></div>
  </section>
  <section class="how" aria-labelledby="how-title"><h2 id="how-title">How you search a Takeout archive</h2><ol class="steps"><li><strong>Choose the archive</strong><p>Open the email archive from your device.</p></li><li><strong>Find a message</strong><p>Search words, sender, date, or attachments.</p></li><li><strong>Export what you need</strong><p>Download an attachment or selected emails.</p></li></ol></section>${recent}`);
}

function renderNotFound(): void {
  app.innerHTML = chrome(`<section class="indexing-card not-found"><p class="eyebrow">Missing page</p><h1>Page not found</h1><p>That page is not part of Paper Trail.</p><a class="button primary" href="/" data-action="home">Return to your archive desk</a></section>`);
}

function renderIndexing(): void {
  const file = state.file!;
  app.innerHTML = chrome(`<section class="indexing-card"><p class="eyebrow">Building your local index</p><h1>${esc(file.name)}</h1>
    <div class="progress-track" role="progressbar" aria-label="Indexing progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
    <div class="progress-meta"><span id="progressBytes">Preparing the stream…</span><span id="progressCount">0 messages found</span></div>
    <p class="index-notes">Keep this tab open while Paper Trail prepares your archive. You can cancel at any time.</p>
    ${file.name.toLowerCase().endsWith('.gz') ? '<p class="pro-note"><strong>About gzip:</strong> indexing is streamed, but opening a result later must decompress up to that message. Extracting the .mbox first gives instant seeking.</p>' : ''}
    <button data-action="cancel-index">Cancel indexing</button></section>`);
}

function filteredRecords(): MessageRecord[] {
  const terms = state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  let list = state.records.filter((record) => {
    if (terms.length) {
      const indexedMatch = terms.every((term) => record.search.includes(term));
      // Bloom membership can only rule a record out. A likely hit outside the
      // compact exact preview appears only after its original bytes verify it.
      if (!indexedMatch && (!terms.every((term) => record.search.includes(term) || bloomHas(record.bloom, term)) || !state.verifiedSearchIds.has(record.id))) return false;
    }
    if (state.sender && !record.from.toLocaleLowerCase().includes(state.sender.toLocaleLowerCase())) return false;
    if (state.fromDate && (!record.date || record.date.slice(0, 10) < state.fromDate)) return false;
    if (state.toDate && (!record.date || record.date.slice(0, 10) > state.toDate)) return false;
    if (state.hasAttachments && !/content-disposition:\s*attachment|filename=/i.test(record.search)) return false;
    return true;
  });
  if (state.sort === 'newest') list = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (state.sort === 'oldest') list = list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return list;
}

function renderWorkspace(): void {
  const archive = state.archive!;
  const filtered = filteredRecords();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const shown = filtered.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  const rows = shown.map((record) => `<li class="message-row ${state.selected.has(record.id) ? 'selected' : ''}" id="message-${record.id}">
    <input type="checkbox" data-select="${record.id}" aria-label="Select ${esc(record.subject)}" ${state.selected.has(record.id) ? 'checked' : ''} />
    <span class="sender" title="${esc(record.from)}">${esc(displayAddress(record.from))}</span>
    <button class="subject-button" data-open-message="${record.id}"><span class="subject">${esc(record.subject)}</span><span class="snippet">${esc(record.snippet || 'No preview available')}</span></button>
    <span class="date-size">${record.date ? formatShortDate(record.date) : 'No date'}<br>${formatBytes(record.size)}</span></li>`).join('');
  app.innerHTML = chrome(`<section class="workspace"><div class="workspace-head"><div><p class="eyebrow">Local archive</p><h1>${esc(archive.name)}</h1><p class="archive-meta">${archive.count.toLocaleString()} messages · ${formatBytes(archive.size)} · indexed ${formatDate(archive.indexedAt)}</p></div>
    <div class="workspace-actions"><button data-action="reconnect">${state.file ? 'File connected' : 'Reconnect file'}</button><button data-action="new-archive">Open another</button></div></div>
    <div class="workspace-grid"><aside class="filter-panel" aria-labelledby="filter-title"><h2 id="filter-title">Search the trail</h2>
      <div class="field"><label for="search">Words in message</label><div class="search-box"><input id="search" type="search" value="${esc(state.query)}" placeholder="invoice sender project" autocomplete="off" /></div></div>
      <div class="field"><label for="sender">From contains</label><input id="sender" type="text" value="${esc(state.sender)}" placeholder="name@example.com" /></div>
      <div class="field"><label for="fromDate">From date</label><input id="fromDate" type="date" value="${state.fromDate}" /></div>
      <div class="field"><label for="toDate">To date</label><input id="toDate" type="date" value="${state.toDate}" /></div>
      <label class="check-all"><input id="hasAttachments" type="checkbox" ${state.hasAttachments ? 'checked' : ''} /> Has attachments</label>
      <div class="field"><label for="sort">Order</label><select id="sort"><option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest first</option><option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Oldest first</option><option value="archive" ${state.sort === 'archive' ? 'selected' : ''}>Archive order</option></select></div>
      <button class="ghost" data-action="clear-filters">Clear filters</button>
      <p class="result-status" aria-live="polite" data-query="${esc(state.query)}"><strong>${filtered.length.toLocaleString()}</strong> of ${state.records.length.toLocaleString()} messages<br><strong>${state.selected.size}</strong> selected${state.searchChecking ? '<br><span>Checking likely full-message matches on this device…</span>' : ''}${state.searchNeedsReconnect ? '<br><span>Reconnect the original archive to check likely full-message matches.</span>' : ''}</p>
      <div class="selection-actions"><button class="primary" data-action="export-eml" ${!state.selected.size ? 'disabled' : ''}>Export selected .eml ZIP</button><button data-action="export-index">Export index CSV</button><button data-action="export-index-json">Back up reusable index</button></div>
      <p class="pro-note"><button class="ghost" data-action="license">${state.pro ? 'License active ★' : 'Manage bulk export license'}</button></p>
    </aside>
    <section class="message-desk" aria-label="Messages"><div class="list-toolbar"><label class="check-all"><input id="selectPage" type="checkbox" ${shown.length && shown.every((record) => state.selected.has(record.id)) ? 'checked' : ''} /> Select this page</label><span>Page ${state.page + 1} of ${pages}</span></div>
      ${rows ? `<ul class="message-list">${rows}</ul>` : `<div class="empty-state"><div><div class="big-mark" aria-hidden="true">∅</div><h2>No matching mail</h2><p>Try fewer words, clear a date, or check the spelling. Search matches headers and the first 192 KB of each message.</p><button data-action="clear-filters">Clear filters</button></div></div>`}
      ${pages > 1 ? `<nav class="pager" aria-label="Result pages"><button data-page="${state.page - 1}" ${state.page === 0 ? 'disabled' : ''}>Previous</button><span>${(state.page * PAGE_SIZE + 1).toLocaleString()}–${Math.min((state.page + 1) * PAGE_SIZE, filtered.length).toLocaleString()}</span><button data-page="${state.page + 1}" ${state.page >= pages - 1 ? 'disabled' : ''}>Next</button></nav>` : ''}
    </section></div></section>`);
}

function renderReader(): void {
  const record = state.current!;
  const parsed = state.parsed;
  let body = '<div class="loading-sheet" role="status"><div><strong>Opening this message…</strong><p>Reading only the required bytes from your archive.</p></div></div>';
  if (parsed) {
    const attachments = parsed.attachments.map((item, index) => {
      const url = URL.createObjectURL(item.blob); activeObjectUrls.push(url);
      return `<li><a class="button" href="${url}" download="${esc(item.name)}">↓ ${esc(item.name)} <small>${formatBytes(item.size)}</small></a></li>`;
    }).join('');
    const html = parsed.html ? safeEmailHtml(parsed.html, parsed.attachments) : '';
    body = `<article class="message-sheet"><header class="message-header"><p class="eyebrow">Message ${record.id + 1}</p><h1>${esc(parsed.subject)}</h1><dl class="header-grid"><dt>From</dt><dd>${esc(parsed.from)}</dd><dt>To</dt><dd>${esc(parsed.to || '—')}</dd>${parsed.cc ? `<dt>Cc</dt><dd>${esc(parsed.cc)}</dd>` : ''}<dt>Date</dt><dd>${parsed.date ? formatDateTime(parsed.date) : 'Unknown'}</dd><dt>Size</dt><dd>${formatBytes(record.size)}</dd></dl></header>
      ${html ? `<iframe class="html-frame" title="HTML email content" sandbox="" srcdoc="${esc(html)}"></iframe>` : `<div class="message-body">${esc(parsed.text)}</div>`}
      ${attachments ? `<section class="attachments" aria-labelledby="attachments-title"><h2 id="attachments-title">Attachments (${parsed.attachments.length})</h2><ul class="attachment-list">${attachments}</ul></section>` : ''}</article>`;
  }
  app.innerHTML = chrome(`<section class="reader"><div class="reader-top"><button data-action="back">← Back to results</button><div class="workspace-actions"><button data-action="download-eml">Download original .eml</button>${parsed ? '<button data-action="print">Print / save PDF</button>' : ''}</div></div>${body}</section>`);
}

function bindGlobalEvents(): void {
  window.addEventListener('online', () => { state.online = true; render(); });
  window.addEventListener('offline', () => { state.online = false; render(); });
  document.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'home' || action === 'new-archive') { event.preventDefault(); state.view = 'welcome'; resetArchive(); navigate('/'); }
    else if (action === 'demo-link') { event.preventDefault(); void enterDemo(); }
    else if (action === 'open') void chooseFile();
    else if (action === 'import-index') void importIndex();
    else if (action === 'cancel-index') { worker?.postMessage({ type: 'cancel' }); }
    else if (action === 'clear-filters') { clearFilters(); render(); }
    else if (action === 'back') { history.back(); }
    else if (action === 'reconnect') void reconnectArchive();
    else if (action === 'export-eml') void exportSelected();
    else if (action === 'export-index') exportIndex();
    else if (action === 'export-index-json') exportIndexJson();
    else if (action === 'download-eml') void downloadCurrentEml();
    else if (action === 'print') window.print();
    else if (action === 'license') showLicenseDialog();
    else if (action === 'reset-demo') void resetDemo();
    else if (action === 'start-real') void leaveDemo();
  });
}

function routeForArchive(archive: ArchiveRecord): string { return `${state.demo ? '/demo' : ''}/archive/${encodeURIComponent(archive.id)}`; }
function routeForMessage(archive: ArchiveRecord, id: number): string { return `${routeForArchive(archive)}/message/${id}`; }

function navigate(path: string, replace = false): void {
  if (location.pathname !== path) history[replace ? 'replaceState' : 'pushState']({}, '', path);
  setRouteMeta(path);
  render();
  queueMicrotask(() => announceRoute());
}

function setRouteMeta(path = location.pathname): void {
  const title = path === '/demo' ? 'Demo — Paper Trail' : path === '/privacy/' ? 'Privacy — Paper Trail' : path === '/terms/' ? 'Terms — Paper Trail' : /^(?:\/demo)?\/archive\/.+\/message\//.test(path) ? 'Message — Paper Trail' : /^(?:\/demo)?\/archive\//.test(path) ? 'Archive — Paper Trail' : path === '/' ? 'Paper Trail — search Gmail Takeout archives' : 'Page not found — Paper Trail';
  const description = path === '/demo' ? 'Search and export Paper Trail’s sample inbox.' : /^(?:\/demo)?\/archive\//.test(path) ? 'Search a Gmail Takeout archive in Paper Trail.' : path === '/' ? 'Search a Gmail Takeout archive in your browser. Read messages and export selected emails.' : 'Return to Paper Trail to search a Gmail Takeout archive.';
  document.title = title;
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  canonical?.setAttribute('href', new URL(path, location.origin).href);
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute('content', description);
}

function announceRoute(): void {
  const heading = document.querySelector<HTMLElement>('main h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  const announcement = document.querySelector<HTMLElement>('#route-announcement');
  if (announcement) announcement.textContent = heading.textContent || document.title;
}

async function restoreRoute(focus = true): Promise<void> {
  const path = location.pathname;
  if (path === '/demo' || path.startsWith('/demo/')) {
    if (!state.demo) { state.demo = true; setDemoStorage(true); state.archives = await getArchives().catch(() => []); }
  }
  setRouteMeta(path);
  if (path === '/' || path === '/demo') {
    if (path === '/demo') state.demo = true;
    state.view = 'welcome';
    if (state.demo && state.archives[0]) await openSavedArchive(state.archives[0].id, false);
    else render();
  } else {
    const match = path.match(/^(?:\/demo)?\/archive\/([^/]+)(?:\/message\/(\d+))?$/);
    if (!match) { state.view = 'not-found'; render(); }
    else {
      const archiveId = decodeURIComponent(match[1]);
      const archive = state.archives.find((item) => item.id === archiveId);
      if (!archive) { state.view = 'not-found'; render(); }
      else {
        await openSavedArchive(archiveId, false);
        if (match[2]) await openMessage(Number(match[2]), false);
      }
    }
  }
  if (focus) queueMicrotask(() => announceRoute());
}

async function enterDemo(): Promise<void> {
  if (state.demo) { navigate('/demo'); return; }
  state.demo = true;
  setDemoStorage(true);
  state.archives = await getArchives().catch(() => []);
  resetArchive();
  navigate('/demo');
  if (state.archives.length) await openSavedArchive(state.archives[0].id, false);
  else await openSample();
}

async function resetDemo(): Promise<void> {
  worker?.terminate(); worker = undefined;
  await deleteDemoStorage();
  setDemoStorage(true);
  state.archives = [];
  resetArchive();
  state.view = 'welcome';
  render();
  await openSample();
}

async function leaveDemo(): Promise<void> {
  worker?.terminate(); worker = undefined;
  await deleteDemoStorage().catch(() => undefined);
  state.demo = false;
  setDemoStorage(false);
  state.archives = await getArchives().catch(() => []);
  resetArchive();
  state.view = 'welcome';
  navigate('/');
}

function bindViewEvents(): void {
  const input = document.querySelector<HTMLInputElement>('#fileInput');
  input?.addEventListener('change', () => { const file = input.files?.[0]; if (file) void acceptFile(file); });
  document.querySelectorAll<HTMLElement>('[data-open-archive]').forEach((button) => button.addEventListener('click', () => void openSavedArchive(button.dataset.openArchive!)));
  document.querySelectorAll<HTMLElement>('[data-open-message]').forEach((button) => button.addEventListener('click', () => void openMessage(Number(button.dataset.openMessage))));
  document.querySelectorAll<HTMLInputElement>('[data-select]').forEach((box) => box.addEventListener('change', () => { const id = Number(box.dataset.select); box.checked ? state.selected.add(id) : state.selected.delete(id); render(); }));
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((button) => button.addEventListener('click', () => { state.page = Number(button.dataset.page); render(); document.querySelector('.message-desk')?.scrollIntoView(); }));
  document.querySelector<HTMLInputElement>('#selectPage')?.addEventListener('change', (event) => {
    const records = filteredRecords().slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
    const checked = (event.target as HTMLInputElement).checked;
    for (const record of records) checked ? state.selected.add(record.id) : state.selected.delete(record.id);
    render();
  });
  const updateFilter = (id: string, key: 'query' | 'sender' | 'fromDate' | 'toDate') => document.querySelector<HTMLInputElement>(`#${id}`)?.addEventListener('input', (event) => {
    state[key] = (event.target as HTMLInputElement).value; state.page = 0;
    if (key === 'query') invalidateSearchVerification();
    debounceRender(key === 'query');
  });
  updateFilter('search', 'query'); updateFilter('sender', 'sender'); updateFilter('fromDate', 'fromDate'); updateFilter('toDate', 'toDate');
  document.querySelector<HTMLInputElement>('#hasAttachments')?.addEventListener('change', (event) => { state.hasAttachments = (event.target as HTMLInputElement).checked; state.page = 0; render(); });
  document.querySelector<HTMLSelectElement>('#sort')?.addEventListener('change', (event) => { state.sort = (event.target as HTMLSelectElement).value as AppState['sort']; state.page = 0; render(); });
  const dropZone = document.querySelector<HTMLElement>('#dropZone');
  dropZone?.addEventListener('dragover', (event) => { event.preventDefault(); });
  dropZone?.addEventListener('drop', (event) => { event.preventDefault(); const file = event.dataTransfer?.files[0]; if (file) void acceptFile(file); });
}

let renderTimer = 0;
function debounceRender(verifySearch = false): void {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    render();
    if (verifySearch) void verifyLikelySearchMatches();
  }, 180);
}

function searchTerms(): string[] { return state.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean); }

function indexedQueryMatch(record: MessageRecord, terms: string[]): boolean {
  return terms.every((term) => record.search.includes(term));
}

function likelyQueryMatch(record: MessageRecord, terms: string[]): boolean {
  return terms.every((term) => record.search.includes(term) || bloomHas(record.bloom, term));
}

function invalidateSearchVerification(): void {
  searchVerificationId++;
  state.verifiedSearchIds.clear();
  state.searchChecking = Boolean(searchTerms().length);
  state.searchNeedsReconnect = false;
}

async function verifyLikelySearchMatches(): Promise<void> {
  const terms = searchTerms();
  const verificationId = searchVerificationId;
  if (!terms.length) { state.searchChecking = false; state.searchNeedsReconnect = false; return; }
  const candidates = state.records.filter((record) => !indexedQueryMatch(record, terms) && likelyQueryMatch(record, terms));
  if (!candidates.length) {
    if (verificationId === searchVerificationId) { state.searchChecking = false; state.searchNeedsReconnect = false; render(); }
    return;
  }
  if (!state.file) {
    if (verificationId === searchVerificationId) { state.searchChecking = false; state.searchNeedsReconnect = true; render(); }
    return;
  }
  const confirmed = new Set<number>();
  for (const record of candidates) {
    try {
      if (searchPrefixContainsTerms(await readSearchPrefix(record), terms)) confirmed.add(record.id);
    } catch {
      // A candidate whose local bytes cannot be read is never presented as a
      // match. The reader/export path supplies the actionable recovery error.
    }
    if (verificationId !== searchVerificationId) return;
  }
  if (verificationId === searchVerificationId) {
    state.verifiedSearchIds = confirmed;
    state.searchChecking = false;
    state.searchNeedsReconnect = false;
    render();
  }
}

async function chooseFile(): Promise<void> {
  const picker = (window as unknown as { showOpenFilePicker?: (options: object) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({ multiple: false, types: [{ description: 'MBOX archive', accept: { 'application/mbox': ['.mbox'], 'application/gzip': ['.gz', '.mbox.gz'] } }] });
      const file = await handle.getFile();
      await acceptFile(file, handle);
      return;
    } catch (error) { if ((error as DOMException).name !== 'AbortError') toast('The file picker could not open that file.', 'error'); return; }
  }
  document.querySelector<HTMLInputElement>('#fileInput')?.click();
}

async function acceptFile(file: File, handle?: FileSystemFileHandle): Promise<void> {
  if (!/\.(mbox|mbx|gz)$/i.test(file.name)) { toast('Choose a .mbox, .mbx, or .mbox.gz archive.', 'error'); return; }
  if (state.expected && (file.size !== state.expected.size || file.name !== state.expected.name)) {
    toast(`That does not match ${state.expected.name}. Choose the original archive.`, 'error'); return;
  }
  if (state.expected) {
    state.archive = state.expected; state.file = file; state.expected = undefined; state.records = await getMessages(state.archive.id); state.view = 'workspace'; navigate(routeForArchive(state.archive)); toast('Archive reconnected.', 'success'); return;
  }
  const gzip = /\.gz$/i.test(file.name);
  const id = `${file.name}:${file.size}:${file.lastModified}`;
  await deleteArchive(id).catch(() => undefined);
  state.file = file;
  state.archive = { id, name: file.name, size: file.size, lastModified: file.lastModified, gzip, count: 0, indexedAt: new Date().toISOString(), handle };
  state.records = [];
  state.view = 'indexing';
  render();
  startIndexing(file, id, gzip);
}

function startIndexing(file: File, archiveId: string, gzip: boolean): void {
  worker?.terminate();
  const currentWorker = new IndexWorker();
  worker = currentWorker;
  const started = performance.now();
  saveQueue = Promise.resolve();
  persistenceFailed = false;
  currentWorker.onmessage = (event: MessageEvent<{ type: string; records?: MessageRecord[]; bytes?: number; expandedBytes?: number; count?: number; total?: number; message?: string }>) => {
    const data = event.data;
    if (data.type === 'batch' && data.records) {
      state.records.push(...data.records);
      saveQueue = saveQueue.then(() => saveMessages(data.records!)).catch(() => {
        if (!persistenceFailed) toast('Browser storage is full. Search still works in this tab, but the index cannot be resumed later.', 'error', 8000);
        persistenceFailed = true;
      });
    } else if (data.type === 'progress') {
      const ratio = gzip ? Math.min(.98, (data.expandedBytes || 0) / Math.max(file.size * 1.8, 1)) : (data.bytes || 0) / file.size;
      updateProgress(ratio, data.bytes || 0, data.count || state.records.length, started, gzip);
    } else if (data.type === 'done') {
      void finishIndex(data.count || state.records.length);
  } else if (data.type === 'cancelled') {
      state.view = 'welcome'; resetArchive(); navigate(state.demo ? '/demo' : '/'); toast('Indexing cancelled. The original file was not changed.');
    } else if (data.type === 'error') {
      state.view = 'welcome'; resetArchive(); navigate(state.demo ? '/demo' : '/'); toast(data.message || 'Could not index this archive.', 'error', 9000);
    }
  };
  currentWorker.onerror = () => { state.view = 'welcome'; render(); toast('The indexing worker stopped unexpectedly. Try extracting the archive and opening the .mbox file.', 'error'); };
  currentWorker.postMessage({ type: 'start', file, archiveId, gzip });
}

async function finishIndex(count: number): Promise<void> {
  await saveQueue;
  if (!state.archive) return;
  state.archive.count = count;
  state.archive.indexedAt = new Date().toISOString();
  if (!persistenceFailed) await saveArchive(state.archive).catch(() => toast('The index works now, but this browser could not save it for later.', 'error'));
  state.archives = [state.archive, ...state.archives.filter((item) => item.id !== state.archive!.id)];
  state.view = 'workspace';
  worker?.terminate(); worker = undefined;
  navigate(routeForArchive(state.archive));
  toast(`Indexed ${count.toLocaleString()} messages.`, 'success');
}

function updateProgress(ratio: number, bytes: number, count: number, started: number, gzip: boolean): void {
  const percent = Math.max(0, Math.min(100, ratio * 100));
  const fill = document.querySelector<HTMLElement>('#progressFill');
  const track = fill?.parentElement;
  if (fill) fill.style.width = `${percent}%`;
  track?.setAttribute('aria-valuenow', String(Math.round(percent)));
  const elapsed = (performance.now() - started) / 1000;
  const rate = elapsed ? bytes / elapsed : 0;
  const bytesText = document.querySelector('#progressBytes');
  const countText = document.querySelector('#progressCount');
  if (bytesText) bytesText.textContent = gzip ? `${formatBytes(bytes)} expanded · ${formatBytes(rate)}/s` : `${percent.toFixed(1)}% · ${formatBytes(bytes)} · ${formatBytes(rate)}/s`;
  if (countText) countText.textContent = `${count.toLocaleString()} messages found`;
}

async function openSavedArchive(id: string, updateRoute = true): Promise<void> {
  const archive = state.archives.find((item) => item.id === id);
  if (!archive) return;
  if (archive.handle) {
    try {
      const permission = await (archive.handle as FileSystemFileHandle & { requestPermission(options: { mode: 'read' }): Promise<PermissionState> }).requestPermission({ mode: 'read' });
      if (permission === 'granted') {
        state.archive = archive; state.file = await archive.handle.getFile(); state.records = await getMessages(id); state.view = 'workspace'; if (updateRoute) navigate(routeForArchive(archive)); else render(); return;
      }
    } catch { /* fall through to manual reconnect */ }
  }
  state.expected = archive;
  state.archive = archive;
  state.records = await getMessages(id);
  if (state.demo) { state.file = await sampleFile(); state.expected = undefined; state.view = 'workspace'; if (updateRoute) navigate(routeForArchive(archive)); else render(); return; }
  if (!updateRoute) { state.view = 'workspace'; render(); return; }
  toast(`Choose ${archive.name} to reconnect its saved index.`);
  document.querySelector<HTMLInputElement>('#fileInput')?.click();
}

async function reconnectArchive(): Promise<void> {
  if (state.file) { toast('This archive is already connected.', 'success'); return; }
  if (!state.archive) return;
  state.expected = state.archive;
  await chooseFile();
}

async function openMessage(id: number, updateRoute = true): Promise<void> {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  // Rendering replaces the row, so retain its stable record ID rather than a
  // detached DOM node. This restores keyboard users to the exact result.
  focusReturnId = id;
  state.current = record; state.parsed = undefined; state.view = 'reader';
  if (updateRoute && state.archive) navigate(routeForMessage(state.archive, id)); else render();
  try {
    const raw = await readRaw(record);
    state.parsed = parseMessage(raw);
    render();
    // The first reader render is a loading state. Move focus and announce only
    // after its message heading exists, so keyboard and screen-reader users
    // arrive at the subject they chose rather than the document body.
    announceRoute();
  } catch (error) {
    state.view = 'workspace'; if (state.archive) navigate(routeForArchive(state.archive), true); else render(); restoreMessageFocus(); toast(error instanceof Error ? error.message : 'Could not open this message.', 'error');
  }
}

function returnToResults(): void {
  state.view = 'workspace';
  state.parsed = undefined;
  if (state.archive) navigate(routeForArchive(state.archive)); else render();
  restoreMessageFocus();
}

function restoreMessageFocus(): void {
  const id = focusReturnId;
  if (id === undefined) return;
  queueMicrotask(() => document.querySelector<HTMLButtonElement>(`[data-open-message="${id}"]`)?.focus());
}

async function readRaw(record: MessageRecord): Promise<Uint8Array> {
  return readRecordRange(record, record.end);
}

async function readSearchPrefix(record: MessageRecord): Promise<Uint8Array> {
  return readRecordRange(record, Math.min(record.end, record.start + SEARCH_SCOPE_BYTES));
}

async function readRecordRange(record: MessageRecord, end: number): Promise<Uint8Array> {
  if (!state.file) throw new Error('Reconnect the original archive before opening or exporting a message.');
  if (!state.archive?.gzip) return new Uint8Array(await state.file.slice(record.start, end).arrayBuffer());
  if (!('DecompressionStream' in window)) throw new Error('This browser cannot read gzip streams. Extract the .mbox file first.');
  const reader = state.file.stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let offset = 0;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunkEnd = offset + value.length;
    if (chunkEnd > record.start && offset < end) {
      const part = value.slice(Math.max(0, record.start - offset), Math.min(value.length, end - offset));
      chunks.push(part); total += part.length;
    }
    offset = chunkEnd;
    if (offset >= end) { await reader.cancel(); break; }
  }
  const output = new Uint8Array(total); let position = 0;
  for (const chunk of chunks) { output.set(chunk, position); position += chunk.length; }
  return output;
}

async function downloadCurrentEml(): Promise<void> {
  if (!state.current) return;
  try { const raw = await readRaw(state.current); downloadBlob(new Blob([raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer], { type: 'message/rfc822' }), `${safeFilename(state.current.subject)}.eml`); }
  catch (error) { toast((error as Error).message, 'error'); }
}

async function exportSelected(): Promise<void> {
  const records = state.records.filter((item) => state.selected.has(item.id));
  if (!records.length) return;
  if (records.length > 1000 && !state.pro) { showLicenseDialog(`Exporting ${records.length.toLocaleString()} messages needs the one-time bulk unlock.`); return; }
  if (!state.file) { toast('Reconnect the original archive before exporting messages.', 'error'); return; }
  const approved = records.length < 100 || confirm(`Build a ZIP containing ${records.length.toLocaleString()} original messages? Large exports may need substantial memory.`);
  if (!approved) return;
  const entries: ZipEntry[] = [];
  try {
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      toast(`Collecting message ${i + 1} of ${records.length}…`, 'progress', 900);
      entries.push({ name: `${String(i + 1).padStart(5, '0')}-${safeFilename(record.subject)}.eml`, data: await readRaw(record) });
    }
    downloadBlob(createZip(entries), `${safeFilename(state.archive?.name || 'messages')}-selection.zip`);
    toast('Your EML ZIP is ready.', 'success');
  } catch (error) { toast((error as Error).message || 'The export could not be built.', 'error'); }
}

function exportIndex(): void {
  const quote = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const rows = [['Subject', 'From', 'To', 'Date', 'Size bytes', 'Message ID'], ...filteredRecords().map((item) => [item.subject, item.from, item.to, item.date, item.size, item.messageId])];
  downloadBlob(new Blob([rows.map((row) => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${safeFilename(state.archive?.name || 'archive')}-index.csv`);
}

function exportIndexJson(): void {
  if (!state.archive) return;
  const { handle: _handle, ...archive } = state.archive;
  const payload = JSON.stringify({ kind: 'paper-trail-index', version: 1, archive, records: state.records });
  downloadBlob(new Blob([payload], { type: 'application/json' }), `${safeFilename(state.archive.name)}-paper-trail-index.json`);
}

async function importIndex(): Promise<void> {
  const picker = document.createElement('input');
  picker.type = 'file'; picker.accept = 'application/json,.json';
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { kind?: string; version?: number; archive?: ArchiveRecord; records?: MessageRecord[] };
      if (data.kind !== 'paper-trail-index' || data.version !== 1 || !data.archive || !Array.isArray(data.records)) throw new Error('Not a Paper Trail index backup.');
      const archive = { ...data.archive, handle: undefined, count: data.records.length, indexedAt: new Date().toISOString() };
      if (!archive.id || !archive.name || !Number.isFinite(archive.size) || data.records.some((item) => item.archiveId !== archive.id || !Number.isFinite(item.start) || !Number.isFinite(item.end))) throw new Error('This index backup is incomplete or damaged.');
      await deleteArchive(archive.id).catch(() => undefined); await saveMessages(data.records); await saveArchive(archive);
      state.archive = archive; state.records = data.records; state.file = undefined; state.expected = archive; state.view = 'workspace'; state.archives = [archive, ...state.archives.filter((item) => item.id !== archive.id)]; render();
      toast(`Imported ${archive.count.toLocaleString()} records. Reconnect ${archive.name} to open messages.`, 'success', 8000);
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not import this index backup.', 'error'); }
  });
  picker.click();
}

function safeEmailHtml(input: string, attachments: ParsedMessage['attachments']): string {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  doc.querySelectorAll('script,iframe,frame,object,embed,form,input,button,textarea,select,meta,base,link').forEach((node) => node.remove());
  const cidUrls = new Map<string, string>();
  for (const item of attachments) if (item.contentId && item.type.startsWith('image/')) { const url = URL.createObjectURL(item.blob); activeObjectUrls.push(url); cidUrls.set(item.contentId, url); }
  doc.querySelectorAll<HTMLElement>('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase(); const value = attr.value.trim();
      if (name.startsWith('on') || name === 'srcset' || name === 'formaction') node.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src') && /^(?:javascript|data:text\/html):/i.test(value)) node.removeAttribute(attr.name);
      if (name === 'src' && /^cid:/i.test(value)) {
        const replacement = cidUrls.get(value.slice(4)); replacement ? node.setAttribute('src', replacement) : node.removeAttribute('src');
      } else if (name === 'src' && /^https?:/i.test(value)) {
        node.removeAttribute('src'); node.setAttribute('data-blocked-image', 'true');
      }
      if (name === 'href' && /^https?:/i.test(value)) { node.setAttribute('target', '_blank'); node.setAttribute('rel', 'noopener noreferrer'); }
    }
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline';"><style>body{margin:0;padding:28px;color:#17211d;background:#fffdf5;font:16px/1.6 system-ui,sans-serif;overflow-wrap:anywhere}img{max-width:100%;height:auto}[data-blocked-image]::after{content:'Remote image blocked'}a{color:#075d76}pre{white-space:pre-wrap}</style></head><body>${doc.body.innerHTML}</body></html>`;
}

async function sampleFile(): Promise<File> {
  const sample = `From sender@example.com Thu Aug 27 10:00:00 2026\r\nDate: Thu, 27 Aug 2026 10:00:00 +0000\r\nFrom: Alex Archive <sender@example.com>\r\nTo: You <you@example.com>\r\nSubject: Your first recovered message\r\nMessage-ID: <sample-1@papertrail.local>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nSearch for recovered, select this message, and export the original email.\r\n\r\nFrom records@example.com Fri Aug 28 12:00:00 2026\r\nDate: Fri, 28 Aug 2026 12:00:00 +0000\r\nFrom: Records Desk <records@example.com>\r\nTo: You <you@example.com>\r\nSubject: Receipt from the archive\r\nMessage-ID: <sample-2@papertrail.local>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="papertrail"\r\n\r\n--papertrail\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h2>Receipt saved for your records</h2><p>This message includes an attachment.</p>\r\n--papertrail\r\nContent-Type: text/plain; name="receipt-note.txt"\r\nContent-Disposition: attachment; filename="receipt-note.txt"\r\n\r\nOrder 4821 — retained for your records.\r\n--papertrail--\r\n\r\nFrom project@example.com Sat Aug 29 09:30:00 2026\r\nDate: Sat, 29 Aug 2026 09:30:00 +0000\r\nFrom: Priya Chen <project@example.com>\r\nTo: You <you@example.com>\r\nSubject: Garden project handoff\r\nMessage-ID: <sample-3@papertrail.local>\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nA project handoff you can find by sender, date, or words.\r\n`;
  return new File([sample], 'paper-trail-sample.mbox', { type: 'application/mbox', lastModified: 1787824800000 });
}

async function openSample(): Promise<void> {
  const file = await sampleFile();
  await acceptFile(file);
}

function showLicenseDialog(message = ''): void {
  const existing = document.querySelector('.modal-backdrop'); existing?.remove();
  const overlay = document.createElement('div'); overlay.className = 'modal-backdrop';
  overlay.innerHTML = `<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="license-title"><p class="eyebrow">One-time unlock</p><h2 id="license-title">Bulk archive export</h2>
    ${message ? `<p class="license-status">${esc(message)}</p>` : ''}<p>A license can expand bulk export options. The checkout page shows the current terms.</p>
    <a class="button primary" href="${API_BASE}/products/${PRODUCT}/checkout">View license options</a>
    <hr><div class="field"><label for="licenseToken">Have a license? Paste it</label><input id="licenseToken" type="text" autocomplete="off" spellcheck="false" placeholder="License token" /></div>
    <p id="licenseMessage" aria-live="polite">${state.pro ? 'This device has an active bulk-export license.' : 'Verification needs a brief internet connection.'}</p>
    <div class="dialog-actions"><button data-dialog="close">Close</button><button class="secondary" data-dialog="verify">Verify license</button></div><p><small><a href="/privacy/">Privacy</a> · <a href="/terms/">Terms and refunds</a></small></p></section>`;
  document.body.appendChild(overlay);
  const dialog = overlay.querySelector<HTMLElement>('.dialog')!;
  const first = dialog.querySelector<HTMLElement>('a,button,input')!; first.focus();
  const close = () => { overlay.remove(); document.querySelector<HTMLElement>('[data-action="license"]')?.focus(); };
  overlay.addEventListener('click', (event) => { const action = (event.target as HTMLElement).dataset.dialog; if (action === 'close') close(); if (action === 'verify') void pasteLicense(overlay); if (event.target === overlay) close(); });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const items = [...dialog.querySelectorAll<HTMLElement>('a[href],button,input')]; const firstItem = items[0]; const lastItem = items.at(-1)!;
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus(); }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus(); }
    }
  });
}

async function pasteLicense(overlay: Element): Promise<void> {
  const token = overlay.querySelector<HTMLInputElement>('#licenseToken')?.value.trim();
  const status = overlay.querySelector<HTMLElement>('#licenseMessage');
  if (!token) { if (status) status.textContent = 'Paste the token from your purchase email.'; return; }
  localStorage.setItem(`sb_license:${PRODUCT}`, token);
  localStorage.removeItem(`sb_license_verdict:${PRODUCT}`);
  if (status) status.textContent = 'Checking this license…';
  const valid = await verifyLicense(true);
  if (status) status.textContent = valid ? 'License active. Unlimited bulk export is unlocked.' : 'That license could not be verified.';
}

function captureReturnedLicense(): void {
  const url = new URL(location.href); const token = url.searchParams.get('license');
  if (!token) return;
  localStorage.setItem(`sb_license:${PRODUCT}`, token); url.searchParams.delete('license'); history.replaceState({}, '', url);
}

function readCachedLicense(): boolean {
  try {
    const verdict = JSON.parse(localStorage.getItem(`sb_license_verdict:${PRODUCT}`) || 'null') as { valid?: boolean; checkedAt?: number } | null;
    return Boolean(localStorage.getItem(`sb_license:${PRODUCT}`) && verdict?.valid);
  } catch { return false; }
}

async function verifyLicense(force = false): Promise<boolean> {
  const token = localStorage.getItem(`sb_license:${PRODUCT}`); if (!token) return false;
  try {
    const cached = JSON.parse(localStorage.getItem(`sb_license_verdict:${PRODUCT}`) || 'null') as { valid: boolean; checkedAt: number } | null;
    if (!force && cached && Date.now() - cached.checkedAt < 86_400_000) { state.pro = cached.valid; return cached.valid; }
    const response = await fetch(`${API_BASE}/products/${PRODUCT}/verify?license=${encodeURIComponent(token)}`);
    const data = await response.json() as { valid: boolean; reason?: string };
    localStorage.setItem(`sb_license_verdict:${PRODUCT}`, JSON.stringify({ valid: data.valid, checkedAt: Date.now() }));
    const changed = state.pro !== data.valid; state.pro = data.valid;
    if (changed && state.view === 'workspace') render();
    if (!data.valid && force) toast('License not active. Check the token or restore another purchase.', 'error');
    return data.valid;
  } catch { return state.pro; }
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => { if (installing.state === 'installed' && navigator.serviceWorker.controller) toast('A new version is ready. Reload when convenient.'); });
    });
  }).catch(() => undefined);
}

function resetArchive(): void { worker?.terminate(); worker = undefined; state.archive = undefined; state.file = undefined; state.records = []; state.selected.clear(); state.expected = undefined; clearFilters(); }
function clearFilters(): void { state.query = ''; state.sender = ''; state.fromDate = ''; state.toDate = ''; state.hasAttachments = false; state.page = 0; }
function revokeObjectUrls(): void { for (const url of activeObjectUrls) URL.revokeObjectURL(url); activeObjectUrls = []; }
function downloadBlob(blob: Blob, name: string): void { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
function displayAddress(value: string): string { return value.replace(/<[^>]+>/g, '').replace(/^"|"$/g, '').trim() || value; }
function formatShortDate(value: string): string { const date = new Date(value); return new Intl.DateTimeFormat(undefined, { year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', month: 'short', day: 'numeric' }).format(date); }
function formatDate(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
function formatDateTime(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value)); }
function esc(value: string): string { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!); }
function toast(message: string, kind: 'error' | 'success' | 'progress' | '' = '', duration = 4200): void {
  const dock = document.querySelector('#toastDock'); if (!dock) return;
  if (kind === 'progress') dock.querySelectorAll('.toast.progress').forEach((item) => item.remove());
  const item = document.createElement('div'); item.className = `toast ${kind}`; item.setAttribute('role', kind === 'error' ? 'alert' : 'status'); item.textContent = message;
  const close = document.createElement('button'); close.className = 'ghost'; close.textContent = '×'; close.setAttribute('aria-label', 'Dismiss notice'); close.addEventListener('click', () => item.remove()); item.append(close); dock.append(item);
  if (duration) setTimeout(() => item.remove(), duration);
}
