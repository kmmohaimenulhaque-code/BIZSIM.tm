// Strict, whitelist-based sanitiser for cases that come from outside the app's
// own code: imported .bizsim packages, QR transfers, backups and older saved
// data. Only known fields of the right type and size survive; text is stripped
// of control characters; URLs must be http(s); numbers are clamped; ids are
// pattern-checked and must be unique. Nothing imported can carry code: the UI
// renders these strings as text only.
import { DIMENSION_IDS } from './dimensions.js';
import { CONTENT_CLASSES } from './contentClass.js';
import { cleanLocale } from './locales.js';
import { sanitizeImageUrl } from './imagePolicy.js';

export const LIMITS = {
  text: 4000,
  short: 300,
  id: 120,
  checkpoints: 16,
  options: 6,
  sources: 80,
  evidence: 40,
  episodes: 8,
  list: 20,
  caseBytes: 600_000,
};

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/;
const PRINCIPLE_RE = /^[A-Za-z0-9][\w-]{0,79}$/;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

export function cleanStr(v, max = LIMITS.text) {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(CONTROL, '').trim();
  return s ? s.slice(0, max) : undefined;
}
const num = (v, lo, hi, dflt) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);
const int = (v, lo, hi, dflt) => {
  const n = num(v, lo, hi, dflt);
  return n == null ? n : Math.round(n);
};
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const strList = (v, max = LIMITS.list, len = LIMITS.short * 2) => arr(v, max).map((x) => cleanStr(x, len)).filter(Boolean);
const principleList = (v) => [...new Set(arr(v, 30).filter((x) => typeof x === 'string' && PRINCIPLE_RE.test(x)))];
const oneOf = (v, list, dflt) => (list.includes(v) ? v : dflt);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export function safeHttpUrl(u) {
  const s = cleanStr(u, 2048);
  if (!s) return undefined;
  try {
    const p = new URL(s);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : undefined;
  } catch {
    return undefined;
  }
}

const ERAS = ['ANCIENT', 'MEDIEVAL', 'EARLY_MODERN', 'INDUSTRIAL', 'MODERN', 'CONTEMPORARY', 'LATEST'];
const DOMAINS = ['STRATEGY', 'CAPITAL', 'REVENUE', 'BRAND', 'OPERATIONS', 'POWER', 'MACRO', 'FINANCE', 'TURNAROUND', 'LEADERSHIP'];
const PILLARS = ['STRATEGY', 'FINANCE', 'BRAND', 'OPERATIONS', 'TURNAROUND', 'LEADERSHIP'];
const SOURCE_KINDS = ['curated', 'generated', 'chat', 'imported'];

function option(o, errors, where) {
  if (!o || typeof o !== 'object') return null;
  const id = cleanStr(o.id, 20);
  const label = cleanStr(o.label, LIMITS.short * 2);
  if (!id || !/^[\w-]{1,20}$/.test(id) || !label) {
    errors.push(`${where}: option without a valid id or label`);
    return null;
  }
  const dims = {};
  for (const d of DIMENSION_IDS) if (typeof o.dims?.[d] === 'number') dims[d] = num(o.dims[d], -100, 100, 0);
  return compact({
    id,
    label,
    summary: cleanStr(o.summary),
    consequence: cleanStr(o.consequence),
    tradeoffs: cleanStr(o.tradeoffs),
    risks: cleanStr(o.risks),
    historical: o.historical === true ? true : undefined,
    quality: int(o.quality, 1, 3, 2),
    impact: { position: num(o.impact?.position, -20, 20, 0), finance: num(o.impact?.finance, -20, 20, 0), resilience: num(o.impact?.resilience, -20, 20, 0) },
    dims,
    principles: principleList(o.principles),
  });
}

const EVIDENCE_STATUSES = ['verified', 'available', 'inaccessible', 'insufficient', 'unchecked'];
function evidenceChecks(v) {
  if (!v || typeof v !== 'object') return undefined;
  const out = {};
  for (const [k, e] of Object.entries(v).slice(0, 80)) {
    if (/^[\w-]{1,20}$/.test(k) && Array.isArray(e) && EVIDENCE_STATUSES.includes(e[0])) out[k] = [e[0], int(e[1], 0, 99, 0), int(e[2], 0, 99, 0)];
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Sanitise one case. Returns { ok, errors, warnings, value }.
 * `ok` is false when the case cannot be played safely.
 */
export function sanitizeCase(input, { source } = {}) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: ['not an object'], warnings, value: null };
  let size = 0;
  try {
    size = JSON.stringify(input).length;
  } catch {
    return { ok: false, errors: ['not serialisable'], warnings, value: null };
  }
  if (size > LIMITS.caseBytes) return { ok: false, errors: [`too large (${Math.round(size / 1024)} KB)`], warnings, value: null };

  const id = cleanStr(input.id, LIMITS.id);
  if (!id || !ID_RE.test(id)) errors.push('missing or invalid id');
  const title = cleanStr(input.title, LIMITS.short);
  const company = cleanStr(input.company, LIMITS.short);
  if (!title) errors.push('missing title');
  if (!company) errors.push('missing company');

  // Sources first: other parts may only reference these ids.
  const sources = [];
  const sourceIds = new Set();
  for (const s of arr(input.sources, LIMITS.sources)) {
    const sid = cleanStr(s?.id, 20);
    const url = safeHttpUrl(s?.url);
    if (!sid || !/^[\w-]{1,20}$/.test(sid) || sourceIds.has(sid)) {
      warnings.push('dropped a source with a missing or duplicate id');
      continue;
    }
    if (!url) {
      warnings.push(`dropped source ${sid}: not an http(s) link`);
      continue;
    }
    sourceIds.add(sid);
    sources.push(compact({ id: sid, title: cleanStr(s.title, LIMITS.short) || url, publisher: cleanStr(s.publisher, 120), url, type: cleanStr(s.type, 40), date: cleanStr(s.date, 40) }));
  }
  if (!sources.length) errors.push('no valid sources');
  const refs = (list) => arr(list, 20).filter((x) => typeof x === 'string' && sourceIds.has(x));

  const sit = input.situation || {};
  const situation = compact({
    headline: cleanStr(sit.headline),
    context: strList(sit.context, 20, LIMITS.text),
    role: cleanStr(sit.role),
    stakes: cleanStr(sit.stakes),
  });
  if (!situation.headline) errors.push('missing situation');

  const cpIds = new Set();
  const checkpoints = [];
  for (const [i, k] of arr(input.checkpoints, LIMITS.checkpoints).entries()) {
    const where = `decision ${i + 1}`;
    const cid = cleanStr(k?.id, 20);
    if (!cid || !/^[\w-]{1,20}$/.test(cid) || cpIds.has(cid)) {
      errors.push(`${where}: missing or duplicate id`);
      continue;
    }
    cpIds.add(cid);
    const opts = [];
    const optIds = new Set();
    for (const o of arr(k.options, LIMITS.options)) {
      const v = option(o, errors, where);
      if (v && !optIds.has(v.id)) {
        optIds.add(v.id);
        opts.push(v);
      } else if (v) errors.push(`${where}: duplicate option id ${v.id}`);
    }
    if (opts.length < 2) errors.push(`${where}: needs at least two options`);
    const live = k.live === true;
    const outcomeText = live ? undefined : cleanStr(k.outcome?.text);
    if (!live && opts.filter((o) => o.historical).length > 1) errors.push(`${where}: more than one historical option`);
    checkpoints.push(
      compact({
        id: cid,
        episode: int(k.episode, 1, LIMITS.episodes, undefined),
        title: cleanStr(k.title, LIMITS.short),
        dateLabel: cleanStr(k.dateLabel, 80),
        prompt: cleanStr(k.prompt),
        context: cleanStr(k.context),
        complexity: num(k.complexity, 0.5, 2, 1),
        live: live || undefined,
        options: opts,
        outcome: outcomeText ? { text: outcomeText, sourceIds: refs(k.outcome?.sourceIds) } : undefined,
      }),
    );
  }
  if (!checkpoints.length) errors.push('no decisions');

  const episodes = [];
  const epNs = new Set();
  for (const e of arr(input.episodes, LIMITS.episodes)) {
    const n = int(e?.n, 1, LIMITS.episodes, undefined);
    if (!n || epNs.has(n)) continue;
    epNs.add(n);
    episodes.push(
      compact({
        n,
        title: cleanStr(e.title, LIMITS.short) || `Episode ${n}`,
        dateLabel: cleanStr(e.dateLabel, 80),
        live: e.live === true || undefined,
        insight: e.insight && typeof e.insight === 'object' ? compact({ text: cleanStr(e.insight.text), principles: principleList(e.insight.principles) }) : undefined,
      }),
    );
  }
  for (const k of checkpoints) if (k.episode && episodes.length && !epNs.has(k.episode)) errors.push(`decision ${k.id} points to a missing episode`);

  const evidence = [];
  for (const e of arr(input.evidence, LIMITS.evidence)) {
    const label = cleanStr(e?.label, LIMITS.short);
    if (!label) continue;
    const sid = typeof e.sourceId === 'string' && sourceIds.has(e.sourceId) ? e.sourceId : undefined;
    if (e.sourceId && !sid) warnings.push(`evidence "${label}" lost an unknown source reference`);
    evidence.push(compact({ label, value: cleanStr(e.value, LIMITS.short * 2), note: cleanStr(e.note), sourceId: sid }));
  }

  const out = input.outcome || {};
  const outcome = {
    summary: cleanStr(out.summary) || '',
    secondOrder: strList(out.secondOrder, 10, LIMITS.text),
    baseRate: cleanStr(out.baseRate) || '',
    lessons: arr(out.lessons, 12)
      .map((l) => (l && typeof l === 'object' ? compact({ text: cleanStr(l.text), principles: principleList(l.principles) }) : null))
      .filter((l) => l?.text),
  };

  const concept = input.concept && typeof input.concept === 'object' ? compact({ framework: cleanStr(input.concept.framework, LIMITS.short), explanation: cleanStr(input.concept.explanation), principles: principleList(input.concept.principles) }) : undefined;
  const analysis =
    input.analysis && typeof input.analysis === 'object'
      ? compact({ summary: cleanStr(input.analysis.summary), strengths: strList(input.analysis.strengths), risks: strList(input.analysis.risks), uncertainties: strList(input.analysis.uncertainties) })
      : undefined;
  const scenarios = arr(input.scenarios, 6)
    .map((s) => (s && typeof s === 'object' ? compact({ name: cleanStr(s.name, LIMITS.short), description: cleanStr(s.description), signals: strList(s.signals, 10) }) : null))
    .filter((s) => s?.name);

  const value = compact({
    id,
    title,
    company,
    tagline: cleanStr(input.tagline, LIMITS.short * 2),
    yearLabel: cleanStr(input.yearLabel, 80) || '',
    yearSort: int(input.yearSort, -5000, 3000, 0),
    era: oneOf(input.era, ERAS, 'MODERN'),
    domain: oneOf(input.domain, DOMAINS, 'STRATEGY'),
    pillar: oneOf(input.pillar, PILLARS, undefined),
    scale: oneOf(input.scale, ['ENTERPRISE', 'STATE', 'STARTUP', 'SMALL'], 'ENTERPRISE'),
    difficulty: int(input.difficulty, 1, 3, 2),
    minutes: int(input.minutes, 1, 240, 18),
    classification: oneOf(input.classification, ['HISTORICAL', 'LIVE', 'HYPOTHETICAL'], 'HISTORICAL'),
    contentClass: CONTENT_CLASSES[input.contentClass] ? input.contentClass : undefined,
    evidenceNote: cleanStr(input.evidenceNote),
    source: oneOf(source || input.source, SOURCE_KINDS, 'imported'),
    aiGenerated: input.aiGenerated === true || ['generated', 'chat'].includes(input.source) || undefined,
    generatedAt: cleanStr(input.generatedAt, 40),
    importedAt: cleanStr(input.importedAt, 40),
    model: cleanStr(input.model, 120),
    // Language the season's text is written in (AI seasons written for a non-English interface).
    contentLocale: cleanLocale(input.contentLocale) || undefined,
    provider: cleanStr(input.provider, 60),
    wiki: cleanStr(input.wiki, 200),
    imageQuery: cleanStr(input.imageQuery, 200),
    cover: typeof input.cover === 'string' ? sanitizeImageUrl(input.cover, title) || undefined : undefined,
    image: typeof input.image === 'string' ? sanitizeImageUrl(input.image, title) || undefined : undefined,
    coverUrl: typeof input.coverUrl === 'string' ? sanitizeImageUrl(input.coverUrl, title) || undefined : undefined,
    reading: cleanStr(input.reading, LIMITS.short * 2),
    catalogueId: cleanStr(input.catalogueId, 40),
    evidenceChecks: evidenceChecks(input.evidenceChecks),
    evidenceCheckedAt: cleanStr(input.evidenceCheckedAt, 40),
    situation,
    concept,
    evidence,
    analysis,
    scenarios: scenarios.length ? scenarios : undefined,
    sources,
    checkpoints,
    episodes: episodes.length ? episodes : undefined,
    outcome,
  });
  return { ok: errors.length === 0, errors, warnings, value: errors.length ? null : value };
}

// ---------- progress (runs) ----------
export function sanitizeRun(r) {
  if (!r || typeof r !== 'object') return null;
  const id = cleanStr(r.id, 80);
  const caseId = cleanStr(r.caseId, LIMITS.id);
  if (!id || !caseId || !ID_RE.test(caseId)) return null;
  const choices = arr(r.choices, 40)
    .map((c) =>
      c && typeof c === 'object' && typeof c.checkpointId === 'string' && typeof c.optionId === 'string'
        ? compact({
            checkpointId: cleanStr(c.checkpointId, 20),
            optionId: cleanStr(c.optionId, 20),
            historical: c.historical === true ? true : c.historical === false ? false : undefined,
            live: c.live === true || undefined,
            quality: int(c.quality, 1, 3, 2),
            impact: c.impact && typeof c.impact === 'object' ? { position: num(c.impact.position, -40, 40, 0), finance: num(c.impact.finance, -40, 40, 0), resilience: num(c.impact.resilience, -40, 40, 0) } : undefined,
            principles: principleList(c.principles),
            reflection: cleanStr(c.reflection, 1000),
            at: cleanStr(c.at, 40),
          })
        : null,
    )
    .filter(Boolean);
  return compact({
    id,
    caseId,
    startedAt: cleanStr(r.startedAt, 40),
    finishedAt: cleanStr(r.finishedAt, 40),
    abandonedAt: cleanStr(r.abandonedAt, 40),
    replayOf: cleanStr(r.replayOf, 80),
    reflection: cleanStr(r.reflection, 2000),
    mode: oneOf(r.mode, ['replay', 'explore'], undefined),
    choices,
  });
}
