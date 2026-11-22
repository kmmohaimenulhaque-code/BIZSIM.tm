// Zero-login, local-first state. Everything the learner does is stored on this
// device only. Progress can be exported to a file and imported elsewhere.
import { useSyncExternalStore } from 'react';
import { DIMENSION_IDS } from '@shared/dimensions.js';
import { deepNoEmDash } from '@shared/text.js';
import { sanitizeState, MAX_BACKUP_BYTES } from '@shared/stateSchema.js';
import { sanitizeCase } from '@shared/caseSchema.js';
import { t } from '../i18n/index.js';

const KEY = 'bizsim.state.v1';
const listeners = new Set();

const blank = () => ({
  version: 1,
  theme: null, // null = follow system
  profile: { decisions: 0, dims: Object.fromEntries(DIMENSION_IDS.map((d) => [d, 0])) },
  runs: [], // simulation runs
  savedCompanies: [],
  researchHistory: [],
  myCases: [],
  caseImages: {}, // caseId -> chosen image (AI-generated or a Wikipedia image)
  // The user's own additions to the principles library, and their tags on seasons.
  library: { books: [], principles: [], tags: {} }, // tags: caseId -> { tags: [string], principles: [principleId] }
  // 1.6
  collections: [], // [{ id, name, builtIn?, items: [{ type, id, caseId?, label?, at }] }]
  notify: null, // notification settings, null until the user opens them (notifications stay off)
  inbox: [], // in-app notification centre
});

let memoryOnly = false;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw);
    // Seasons saved by older versions may contain em dashes; BIZSIM never shows them.
    if (Array.isArray(parsed.myCases)) parsed.myCases = deepNoEmDash(parsed.myCases);
    for (const k of ['runs', 'savedCompanies', 'researchHistory', 'myCases', 'collections', 'inbox']) if (!Array.isArray(parsed[k])) delete parsed[k];
    return { ...blank(), ...parsed, library: { ...blank().library, ...parsed.library }, profile: { ...blank().profile, ...parsed.profile, dims: { ...blank().profile.dims, ...parsed.profile?.dims } } };
  } catch {
    memoryOnly = true;
    return blank();
  }
}

let state = load();

function persist() {
  if (memoryOnly) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    memoryOnly = true;
  }
}

export function getState() {
  return state;
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : { ...state, ...updater };
  state = next;
  persist();
  listeners.forEach((l) => l());
}

export function useStore(selector = (s) => s) {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export const storageIsPersistent = () => !memoryOnly;

/** Listen to every state change (outside React). Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      listeners.forEach((l) => l());
    }
  });
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- Actions ----------
export function setTheme(theme) {
  setState((s) => ({ ...s, theme }));
}

export function saveCompany(entry) {
  setState((s) => ({
    ...s,
    savedCompanies: [{ ...entry, savedAt: new Date().toISOString() }, ...s.savedCompanies.filter((c) => c.id !== entry.id)].slice(0, 200),
  }));
}
export function removeCompany(id) {
  setState((s) => ({ ...s, savedCompanies: s.savedCompanies.filter((c) => c.id !== id) }));
}

export function addResearchHistory(entry) {
  setState((s) => ({ ...s, researchHistory: [{ ...entry, at: new Date().toISOString() }, ...s.researchHistory].slice(0, 200) }));
}

export function removeResearchHistoryItem(at, query) {
  setState((s) => ({
    ...s,
    researchHistory: (s.researchHistory || []).filter(
      (item) => !(item.at === at && item.query === query)
    ),
  }));
}

export function removeRunHistoryEntry(runId, checkpointId) {
  setState((s) => {
    const runs = (s.runs || [])
      .map((run) => {
        if (run.id !== runId) return run;
        if (!checkpointId) return null;
        const choices = (run.choices || []).filter((c) => c.checkpointId !== checkpointId);
        return choices.length ? { ...run, choices } : null;
      })
      .filter(Boolean);
    return { ...s, runs };
  });
}

export function clearAnalysisHistory() {
  setState((s) => ({
    ...s,
    researchHistory: [],
    runs: [],
  }));
}

export function saveGeneratedCase(raw) {
  // Server output is validated there; clean it again here like any outside data.
  const r = sanitizeCase(raw);
  let c = deepNoEmDash(r.ok ? r.value : raw);
  setState((s) => ({ ...s, myCases: [c, ...s.myCases.filter((x) => x.id !== c.id)].slice(0, 200) }));
}
export function removeGeneratedCase(id) {
  setState((s) => ({ ...s, myCases: s.myCases.filter((c) => c.id !== id), runs: s.runs.filter((r) => r.caseId !== id) }));
}

export function setCaseImage(caseId, image) {
  setState((s) => ({ ...s, caseImages: { ...s.caseImages, [caseId]: image } }));
}

export function exportState() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: 'BIZSIM' }, null, 2);
}

/**
 * Read and validate a backup (or transfer) file without changing anything.
 * Returns { kind, value, report, exportedAt } for the preview, or throws.
 */
export function previewImport(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error(t('backup.empty'));
  if (text.length > MAX_BACKUP_BYTES) throw new Error(t('backup.tooLarge'));
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(t('backup.notJson'));
  }
  const kind = parsed?.kind === 'transfer' ? 'transfer' : 'backup';
  const r = sanitizeState(parsed, { kind });
  if (!r.ok) throw new Error(r.code === 'version' ? t('backup.version', { version: r.version }) : t('backup.notBizsim'));
  return { kind, value: r.value, report: r.report, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt.slice(0, 40) : null };
}

/**
 * Apply a previewed import. mode 'merge' keeps everything on this device and
 * adds what is new; 'replace' swaps this device's data for the backup.
 * Notification permission belongs to each device, so restored notification
 * settings start switched off.
 */
export function applyImport(preview, mode = 'merge') {
  const v = preview.value;
  if (mode === 'replace') {
    setState((s) => ({ ...blank(), ...v, theme: v.theme ?? s.theme, notify: v.notify ? { ...v.notify, enabled: false } : null, inbox: v.inbox || [] }));
    return;
  }
  mergeState({ ...v, app: 'BIZSIM' }, { trusted: true });
}

/** Back-compat helper: validate then merge (never silently replaces). */
export function importState(json) {
  applyImport(previewImport(json), 'merge');
}

// ---------- Principles library: the user's books, principles and season tags ----------
const now = () => new Date().toISOString();
const lib = (s) => ({ books: [], principles: [], tags: {}, ...(s.library || {}) });
const slug = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function saveBook(book) {
  const id = book.id || `u-${slug(book.title) || 'book'}-${uid().slice(0, 5)}`;
  const entry = { theme: 'My library', ...book, id, custom: true, updatedAt: now() };
  setState((s) => {
    const l = lib(s);
    return { ...s, library: { ...l, books: [entry, ...l.books.filter((b) => b.id !== id)] } };
  });
  return id;
}
export function removeBook(id) {
  setState((s) => {
    const l = lib(s);
    return { ...s, library: { ...l, books: l.books.filter((b) => b.id !== id), principles: l.principles.map((p) => (p.book === id ? { ...p, book: '' } : p)) } };
  });
}
export function savePrinciple(p) {
  const id = p.id || `u-${slug(p.name) || 'principle'}-${uid().slice(0, 5)}`;
  const entry = { tags: [], ...p, id, custom: true, updatedAt: now() };
  setState((s) => {
    const l = lib(s);
    return { ...s, library: { ...l, principles: [entry, ...l.principles.filter((x) => x.id !== id)] } };
  });
  return id;
}
export function removePrinciple(id) {
  setState((s) => {
    const l = lib(s);
    const tags = Object.fromEntries(Object.entries(l.tags).map(([c, t]) => [c, { ...t, principles: (t.principles || []).filter((x) => x !== id) }]));
    return { ...s, library: { ...l, principles: l.principles.filter((x) => x.id !== id), tags } };
  });
}
/** Set the user's own tags and linked principles for one season or case. */
export function setCaseTags(caseId, { tags, principles }) {
  setState((s) => {
    const l = lib(s);
    const cur = l.tags[caseId] || { tags: [], principles: [] };
    const next = {
      tags: tags ? [...new Set(tags.map((t) => String(t).trim().slice(0, 32)).filter(Boolean))].slice(0, 20) : cur.tags,
      principles: principles ? [...new Set(principles)].slice(0, 30) : cur.principles,
      updatedAt: now(),
    };
    const all = { ...l.tags, [caseId]: next };
    if (!next.tags.length && !next.principles.length) delete all[caseId];
    return { ...s, library: { ...l, tags: all } };
  });
}

function mergeLibrary(mine, incoming) {
  const a = { books: [], principles: [], tags: {}, ...(mine || {}) };
  const b = { books: [], principles: [], tags: {}, ...(incoming || {}) };
  const newer = (x, y) => ((y?.updatedAt || '') > (x?.updatedAt || '') ? y : x);
  const byId = (xs, ys) => {
    const m = new Map(xs.map((x) => [x.id, x]));
    for (const y of ys || []) if (y && y.id) m.set(y.id, m.has(y.id) ? newer(m.get(y.id), y) : y);
    return [...m.values()];
  };
  const tags = { ...a.tags };
  for (const [id, t] of Object.entries(b.tags || {})) {
    const cur = tags[id];
    tags[id] = cur
      ? { tags: [...new Set([...(cur.tags || []), ...(t.tags || [])])], principles: [...new Set([...(cur.principles || []), ...(t.principles || [])])], updatedAt: newer(cur, t).updatedAt }
      : t;
  }
  return { books: byId(a.books, b.books), principles: byId(a.principles, b.principles), tags };
}

function mergeCollections(mine, theirs) {
  const m = new Map(mine.map((c) => [c.id, c]));
  for (const c of theirs) {
    const cur = m.get(c.id) || [...m.values()].find((x) => x.name.toLowerCase() === c.name.toLowerCase());
    if (!cur) m.set(c.id, c);
    else {
      const seen = new Set(cur.items.map((i) => `${i.type}|${i.id}`));
      m.set(cur.id, { ...cur, items: [...cur.items, ...c.items.filter((i) => !seen.has(`${i.type}|${i.id}`))] });
    }
  }
  return [...m.values()];
}

/** Data sent to another device (no device-specific settings). */
export function transferPayload({ includeCases = true } = {}) {
  const { profile, runs, savedCompanies, researchHistory, myCases } = state;
  return { app: 'BIZSIM', kind: 'transfer', version: 1, at: new Date().toISOString(), profile, runs, savedCompanies, researchHistory: researchHistory.slice(0, 50), myCases: includeCases ? myCases : [], library: lib(state), collections: state.collections || [] };
}

/** Merge progress from another device into this one (nothing is deleted). */
export function mergeState(incomingRaw, { trusted = false } = {}) {
  if (incomingRaw?.app !== 'BIZSIM') throw new Error(t('backup.notProgress'));
  let incoming = incomingRaw;
  if (!trusted) {
    const r = sanitizeState(incomingRaw, { kind: 'transfer' });
    if (!r.ok) throw new Error(r.code === 'version' ? t('backup.version', { version: r.version }) : t('backup.notBizsim'));
    incoming = r.value;
  }
  const byKey = (list, key) => {
    const m = new Map();
    for (const x of list || []) m.set(key(x), x);
    return m;
  };
  setState((s) => {
    const runs = byKey(s.runs, (r) => r.id);
    for (const r of incoming.runs || []) {
      const mine = runs.get(r.id);
      if (!mine || (r.choices?.length || 0) > (mine.choices?.length || 0) || (r.finishedAt && !mine.finishedAt)) runs.set(r.id, r);
    }
    const companies = byKey(s.savedCompanies, (c) => c.id);
    for (const c of incoming.savedCompanies || []) if (!companies.has(c.id)) companies.set(c.id, c);
    const history = byKey(s.researchHistory, (h) => `${h.at}|${h.query}`);
    for (const h of incoming.researchHistory || []) history.set(`${h.at}|${h.query}`, h);
    const cases = byKey(s.myCases, (c) => c.id);
    for (const c of incoming.myCases || []) if (!cases.has(c.id)) cases.set(c.id, c);
    const profile = (incoming.profile?.decisions || 0) > (s.profile.decisions || 0) ? incoming.profile : s.profile;
    return {
      ...s,
      profile,
      runs: [...runs.values()].sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')).slice(0, 300),
      savedCompanies: [...companies.values()],
      researchHistory: [...history.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200),
      myCases: [...cases.values()].slice(0, 200),
      library: incoming.library ? mergeLibrary(lib(s), incoming.library) : lib(s),
      collections: mergeCollections(s.collections || [], incoming.collections || []),
    };
  });
}

export function resetState() {
  setState(() => ({ ...blank(), theme: state.theme }));
}

// ---------- 1.6: imported seasons (.bizsim packages) ----------
/**
 * Store an imported season. mode: 'new' (no conflict), 'copy' (keep both:
 * the import gets a new id) or 'replace' (the user confirmed overwriting their
 * own copy; runs of the old version stay in history). Returns the stored id.
 */
export function importCase(c, { mode = 'new' } = {}) {
  let v = deepNoEmDash({ ...c, importedAt: now() });
  if (mode === 'copy') v = { ...v, id: `${c.id}.copy-${uid().slice(0, 4)}`.slice(0, 120), title: `${c.title} (copy)` };
  setState((s) => ({ ...s, myCases: [v, ...s.myCases.filter((x) => x.id !== v.id)].slice(0, 200) }));
  return v.id;
}

// ---------- 1.6: collections and bookmarks ----------
// Collections hold references only (type + id), never copies of content, so
// they stay small, survive content updates and are included in backups.
export const DEFAULT_COLLECTIONS = [
  { id: 'bookmarks', name: 'Bookmarks' },
  { id: 'startup-strategy', name: 'Startup Strategy' },
  { id: 'crisis-management', name: 'Crisis Management' },
  { id: 'leadership', name: 'Leadership' },
  { id: 'finance', name: 'Finance' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'historical-business-cases', name: 'Historical Business Cases' },
];

/** Collections with the defaults present (created on first use, never re-added once removed). */
/** Display name: built-in collections follow the interface language until the user renames them. */
export function collectionName(c) {
  const d = DEFAULT_COLLECTIONS.find((x) => x.id === c.id);
  return c.builtIn && d && c.name === d.name ? t(`collections.defaults.${c.id}`) : c.name;
}

const colCache = new WeakMap();
export function collectionsOf(s) {
  // Cached per state object so React's store subscription sees a stable value.
  if (colCache.has(s)) return colCache.get(s);
  const list = s.collections || [];
  let v = list;
  if (!s.collectionsInit) {
    const have = new Set(list.map((c) => c.id));
    v = [...DEFAULT_COLLECTIONS.filter((d) => !have.has(d.id)).map((d) => ({ ...d, builtIn: true, items: [] })), ...list];
  }
  colCache.set(s, v);
  return v;
}
function withCollections(fn) {
  setState((s) => ({ ...s, collectionsInit: true, collections: fn(collectionsOf(s)) }));
}
const refKey = (r) => `${r.type}|${r.id}`;

export function toggleInCollection(collectionId, item) {
  const ref = { type: item.type, id: String(item.id), caseId: item.caseId, label: item.label ? String(item.label).slice(0, 200) : undefined, at: now() };
  withCollections((cols) =>
    cols.map((c) => {
      if (c.id !== collectionId) return c;
      const has = c.items.some((i) => refKey(i) === refKey(ref));
      return { ...c, items: has ? c.items.filter((i) => refKey(i) !== refKey(ref)) : [ref, ...c.items].slice(0, 1000) };
    }),
  );
}
export function createCollection(name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) throw new Error(t('collections.needName'));
  let id = '';
  withCollections((cols) => {
    if (cols.some((c) => collectionName(c).toLowerCase() === clean.toLowerCase())) throw new Error(t('collections.nameTaken'));
    id = `u-${slug(clean) || 'list'}-${uid().slice(0, 4)}`;
    return [...cols, { id, name: clean, createdAt: now(), items: [] }];
  });
  return id;
}
export function renameCollection(id, name) {
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) throw new Error(t('collections.needName'));
  withCollections((cols) => {
    if (cols.some((c) => c.id !== id && collectionName(c).toLowerCase() === clean.toLowerCase())) throw new Error(t('collections.nameTaken'));
    return cols.map((c) => (c.id === id ? { ...c, name: clean } : c));
  });
}
export function removeCollection(id) {
  withCollections((cols) => cols.filter((c) => c.id !== id));
}
export function removeFromCollection(id, ref) {
  withCollections((cols) => cols.map((c) => (c.id === id ? { ...c, items: c.items.filter((i) => refKey(i) !== refKey(ref)) } : c)));
}
export const isSaved = (s, item) => collectionsOf(s).some((c) => c.items.some((i) => i.type === item.type && i.id === String(item.id)));
