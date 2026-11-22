// Validation for whole-app data that arrives from outside: backup files and QR
// progress transfers. Everything is treated as untrusted and rebuilt field by
// field; anything unknown or malformed is dropped and counted, never executed.
import { DIMENSION_IDS } from './dimensions.js';
import { sanitizeCase, sanitizeRun, cleanStr, safeHttpUrl } from './caseSchema.js';

export const MAX_BACKUP_BYTES = 12_000_000;

const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const okId = (v) => typeof v === 'string' && ID_RE.test(v);

function imageRef(v) {
  if (!v || typeof v !== 'object') return undefined;
  const url = typeof v.url === 'string' && (/^\/(generated|covers)\/[\w./-]+$/.test(v.url) && !v.url.includes('..') ? v.url : safeHttpUrl(v.url));
  if (!url) return undefined;
  return compact({ url, remote: safeHttpUrl(v.remote), title: cleanStr(v.title, 200), creator: cleanStr(v.creator, 200), license: cleanStr(v.license, 80), licenseUrl: safeHttpUrl(v.licenseUrl), landingUrl: safeHttpUrl(v.landingUrl), generated: v.generated === true || undefined });
}

function library(v, report) {
  const l = v && typeof v === 'object' ? v : {};
  const books = arr(l.books, 300)
    .map((b) => (b && okId(b.id) && cleanStr(b.title, 200) ? compact({ id: b.id, title: cleanStr(b.title, 200), author: cleanStr(b.author, 120), year: num(b.year, -3000, 3000, 0), theme: cleanStr(b.theme, 80), note: cleanStr(b.note, 2000), custom: true, updatedAt: cleanStr(b.updatedAt, 40) }) : null))
    .filter(Boolean);
  const principles = arr(l.principles, 600)
    .map((p) =>
      p && okId(p.id) && cleanStr(p.name, 200)
        ? compact({ id: p.id, name: cleanStr(p.name, 200), idea: cleanStr(p.idea, 3000), apply: cleanStr(p.apply, 3000), book: okId(p.book) ? p.book : '', tags: arr(p.tags, 20).map((t) => cleanStr(t, 32)).filter(Boolean), custom: true, updatedAt: cleanStr(p.updatedAt, 40) })
        : null,
    )
    .filter(Boolean);
  const tags = {};
  for (const [cid, t] of Object.entries(l.tags && typeof l.tags === 'object' ? l.tags : {}).slice(0, 2000)) {
    if (!okId(cid) || !t || typeof t !== 'object') continue;
    tags[cid] = { tags: arr(t.tags, 20).map((x) => cleanStr(x, 32)).filter(Boolean), principles: arr(t.principles, 30).filter(okId), updatedAt: cleanStr(t.updatedAt, 40) };
  }
  report.dropped += (Array.isArray(l.books) ? l.books.length - books.length : 0) + (Array.isArray(l.principles) ? l.principles.length - principles.length : 0);
  return { books, principles, tags };
}

const REF_TYPES = ['season', 'episode', 'decision', 'principle', 'company'];
export function sanitizeRef(r) {
  if (!r || typeof r !== 'object' || !REF_TYPES.includes(r.type)) return null;
  if (!okId(r.id)) return null;
  return compact({ type: r.type, id: r.id, caseId: okId(r.caseId) ? r.caseId : undefined, label: cleanStr(r.label, 200), at: cleanStr(r.at, 40) });
}

export function sanitizeCollections(v) {
  return arr(v, 100)
    .map((c) => {
      if (!c || !okId(c.id)) return null;
      const name = cleanStr(c.name, 60);
      if (!name) return null;
      const seen = new Set();
      const items = arr(c.items, 1000)
        .map(sanitizeRef)
        .filter((x) => x && !seen.has(`${x.type}|${x.id}`) && seen.add(`${x.type}|${x.id}`));
      return compact({ id: c.id, name, builtIn: c.builtIn === true || undefined, createdAt: cleanStr(c.createdAt, 40), items });
    })
    .filter(Boolean);
}

export function sanitizeNotifySettings(v) {
  const n = v && typeof v === 'object' ? v : {};
  const cats = n.categories && typeof n.categories === 'object' ? n.categories : {};
  const hhmm = (x, d) => (typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x) ? x : d);
  return {
    enabled: n.enabled === true,
    categories: Object.fromEntries(['caseOfDay', 'resume', 'weeklyGoal', 'seasonDone', 'researchDone', 'custom'].map((k) => [k, cats[k] !== false])),
    time: hhmm(n.time, '09:00'),
    frequency: ['daily', 'weekdays', 'weekly'].includes(n.frequency) ? n.frequency : 'daily',
    quietStart: hhmm(n.quietStart, '22:00'),
    quietEnd: hhmm(n.quietEnd, '07:00'),
    weeklyGoal: num(n.weeklyGoal, 0, 50, 3),
    custom: arr(n.custom, 20)
      .map((r) => (r && okId(r.id) && cleanStr(r.text, 140) ? { id: r.id, text: cleanStr(r.text, 140), time: hhmm(r.time, '18:00'), days: arr(r.days, 7).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) } : null))
      .filter(Boolean),
  };
}

export function sanitizeInbox(v) {
  return arr(v, 200)
    .map((m) => (m && typeof m.id === 'string' && /^[\w|:.-]{1,160}$/.test(m.id) && cleanStr(m.title, 140) ? compact({ id: m.id, category: cleanStr(m.category, 20), title: cleanStr(m.title, 140), body: cleanStr(m.body, 400), link: typeof m.link === 'string' && /^\/[\w/#?=&.-]{0,200}$/.test(m.link) ? m.link : undefined, at: cleanStr(m.at, 40), read: m.read === true || undefined }) : null))
    .filter(Boolean);
}

/**
 * Validate a backup or transfer object. Returns { ok, error, value, report }.
 * report: counts of accepted and dropped items, for the import preview.
 */
export function sanitizeState(parsed, { kind } = {}) {
  const report = { runs: 0, cases: 0, companies: 0, collections: 0, dropped: 0, droppedCases: [] };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, code: 'notBizsim', error: 'This file is not BIZSIM data.', report };
  if (parsed.app !== 'BIZSIM') return { ok: false, code: 'notBizsim', error: 'This file is not BIZSIM data.', report };
  if (parsed.version !== 1) return { ok: false, code: 'version', version: String(parsed.version).slice(0, 10), error: `This file uses data format ${String(parsed.version).slice(0, 10)}, which this version of BIZSIM cannot read. Update the app.`, report };

  const profileIn = parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {};
  const dims = Object.fromEntries(DIMENSION_IDS.map((d) => [d, num(profileIn.dims?.[d], -100, 100, 0)]));
  const profile = { decisions: Math.round(num(profileIn.decisions, 0, 1e6, 0)), dims };

  const runs = [];
  const runIds = new Set();
  for (const r of arr(parsed.runs, 500)) {
    const v = sanitizeRun(r);
    if (v && !runIds.has(v.id)) {
      runIds.add(v.id);
      runs.push(v);
    } else report.dropped++;
  }
  report.runs = runs.length;

  const myCases = [];
  const caseIds = new Set();
  for (const c of arr(parsed.myCases, 250)) {
    const r = sanitizeCase(c);
    if (r.ok && !caseIds.has(r.value.id)) {
      caseIds.add(r.value.id);
      myCases.push(r.value);
    } else {
      report.dropped++;
      report.droppedCases.push(cleanStr(c?.title, 80) || 'Untitled');
    }
  }
  report.cases = myCases.length;

  const savedCompanies = arr(parsed.savedCompanies, 300)
    .map((c) => (c && typeof c.id === 'string' && cleanStr(c.name, 200) ? compact({ id: cleanStr(c.id, 80), name: cleanStr(c.name, 200), description: cleanStr(c.description, 1000), website: safeHttpUrl(c.website), savedAt: cleanStr(c.savedAt, 40) }) : null))
    .filter(Boolean);
  report.companies = savedCompanies.length;

  const researchHistory = arr(parsed.researchHistory, 300)
    .map((h) => (h && cleanStr(h.query, 200) && cleanStr(h.at, 40) ? compact({ query: cleanStr(h.query, 200), name: cleanStr(h.name, 200) || null, id: cleanStr(h.id, 80) || null, sourcesCount: Math.round(num(h.sourcesCount, 0, 1000, 0)), generated: h.generated === true, at: cleanStr(h.at, 40) }) : null))
    .filter(Boolean);

  const caseImages = {};
  for (const [cid, img] of Object.entries(parsed.caseImages && typeof parsed.caseImages === 'object' ? parsed.caseImages : {}).slice(0, 1000)) {
    const v = imageRef(img);
    if (okId(cid) && v) caseImages[cid] = v;
  }

  const collections = sanitizeCollections(parsed.collections);
  report.collections = collections.length;

  const value = compact({
    version: 1,
    theme: ['light', 'dark'].includes(parsed.theme) ? parsed.theme : null,
    profile,
    runs,
    savedCompanies,
    researchHistory,
    myCases,
    caseImages,
    library: library(parsed.library, report),
    collections,
    collectionsInit: parsed.collectionsInit === true || undefined,
    notify: kind === 'transfer' ? undefined : sanitizeNotifySettings(parsed.notify),
    inbox: kind === 'transfer' ? undefined : sanitizeInbox(parsed.inbox),
  });
  return { ok: true, value, report };
}
