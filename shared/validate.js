// Deterministic quality gates for cases, used for curated content (at build/check
// time) and for AI-generated cases (at runtime, before anything reaches the user).
import { PRINCIPLE_BY_ID } from './books.js';
import { DIMENSION_IDS } from './dimensions.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(+n) ? +n : 0));

/**
 * Validate and normalise a case. Returns { ok, errors, warnings, value }.
 * Unknown principle ids and out-of-range numbers are removed or clamped rather
 * than trusted. Structural problems are reported as errors.
 */
export function validateCase(input, { requireHistorical = true, episodes } = {}) {
  const errors = [];
  const warnings = [];
  const c = structuredClone(input || {});
  const sourceIds = new Set((c.sources || []).map((s) => s.id));

  const cleanPrinciples = (list, where) =>
    (Array.isArray(list) ? list : []).filter((id) => {
      if (PRINCIPLE_BY_ID[id]) return true;
      warnings.push(`${where}: removed unknown principle "${id}"`);
      return false;
    });

  for (const f of ['id', 'title', 'company']) if (!c[f]) errors.push(`missing ${f}`);
  if (!c.situation?.headline) errors.push('missing situation.headline');
  if (!Array.isArray(c.situation?.context) || !c.situation.context.length) errors.push('missing situation.context');
  if (!Array.isArray(c.checkpoints) || !c.checkpoints.length) errors.push('no checkpoints');
  if (!Array.isArray(c.sources) || !c.sources.length) errors.push('no sources');

  for (const s of c.sources || []) {
    if (!s.url || !/^https?:\/\//.test(s.url)) errors.push(`source ${s.id} has no valid URL`);
  }

  if (c.concept) c.concept.principles = cleanPrinciples(c.concept.principles, 'concept');

  c.evidence = (c.evidence || []).filter((e) => {
    if (e.sourceId && !sourceIds.has(e.sourceId)) {
      warnings.push(`evidence "${e.label}" removed: unknown source ${e.sourceId}`);
      return false;
    }
    return true;
  });

  // Anti-spoiler gate: words revealing an outcome must not appear in pre-decision text.
  const spoilerWords = /\b(went bankrupt|collapsed|succeeded|proved (right|wrong)|would later|eventually (won|lost|failed))\b/i;
  const preDecision = [
    ...(c.situation?.context || []),
    c.situation?.headline,
    c.concept?.explanation,
    ...(c.checkpoints || []).map((k) => k.context),
  ].filter(Boolean);
  preDecision.forEach((t) => {
    if (spoilerWords.test(t)) warnings.push(`possible outcome leak in pre-decision text: "${t.slice(0, 80)}…"`);
  });

  (c.checkpoints || []).forEach((k, i) => {
    const where = `checkpoint ${i + 1}`;
    if (!k.prompt) errors.push(`${where}: missing prompt`);
    if (!Array.isArray(k.options) || k.options.length < 2) errors.push(`${where}: needs at least two options`);
    k.complexity = clamp(k.complexity ?? 1, 0.5, 1.5);
    const hist = (k.options || []).filter((o) => o.historical);
    // A "live" episode is today's open decision: no historical answer exists yet.
    if (k.live) {
      if (hist.length) errors.push(`${where}: a live episode cannot have a historical option`);
    } else if (requireHistorical && hist.length !== 1) errors.push(`${where}: exactly one option must be marked historical`);
    (k.options || []).forEach((o, j) => {
      if (!o.id) o.id = String.fromCharCode(97 + j);
      if (!o.label) errors.push(`${where}: option ${j + 1} missing label`);
      o.quality = clamp(o.quality ?? 2, 1, 3);
      o.impact = {
        position: clamp(o.impact?.position, -20, 20),
        finance: clamp(o.impact?.finance, -20, 20),
        resilience: clamp(o.impact?.resilience, -20, 20),
      };
      const dims = {};
      for (const [key, v] of Object.entries(o.dims || {})) {
        if (DIMENSION_IDS.includes(key)) dims[key] = clamp(v, -100, 100);
        else warnings.push(`${where}: removed unknown dimension ${key}`);
      }
      o.dims = dims;
      o.principles = cleanPrinciples(o.principles, `${where} option ${o.id}`);
    });
    if (k.outcome) {
      k.outcome.sourceIds = (k.outcome.sourceIds || []).filter((id) => {
        if (sourceIds.has(id)) return true;
        warnings.push(`${where}: outcome cites unknown source ${id}`);
        return false;
      });
      if (requireHistorical && !k.live && !k.outcome.sourceIds.length) errors.push(`${where}: outcome has no source`);
    } else if (requireHistorical && !k.live) errors.push(`${where}: missing outcome`);
  });

  // Episodes: each holds 2 to 4 decisions and ends with an outcome and an insight.
  if (Array.isArray(c.episodes) && c.episodes.length) {
    c.episodes.forEach((e, i) => {
      const n = e.n || i + 1;
      e.n = n;
      const ks = (c.checkpoints || []).filter((k) => k.episode === n);
      if (ks.length < 2 || ks.length > 4) errors.push(`episode ${n}: needs 2 to 4 decisions, has ${ks.length}`);
      if (!e.title) errors.push(`episode ${n}: missing title`);
      if (!e.insight?.text) errors.push(`episode ${n}: missing insight`);
      else e.insight.principles = cleanPrinciples(e.insight.principles, `episode ${n} insight`);
    });
    const known = new Set(c.episodes.map((e) => e.n));
    (c.checkpoints || []).forEach((k, i) => {
      if (!known.has(k.episode)) errors.push(`checkpoint ${i + 1}: not in any episode`);
    });
    const order = (c.checkpoints || []).map((k) => k.episode);
    if (order.some((n, i) => i && n < order[i - 1])) errors.push('decisions are not grouped in episode order');
    const idSet = new Set();
    (c.checkpoints || []).forEach((k) => {
      if (idSet.has(k.id)) errors.push(`duplicate decision id ${k.id}`);
      idSet.add(k.id);
    });
    if (episodes && c.episodes.length !== episodes) errors.push(`expected ${episodes} episodes, got ${c.episodes.length}`);
  } else if (episodes) errors.push(`expected ${episodes} episodes of 2 to 4 decisions, got ${(c.checkpoints || []).length} single decisions`);

  if (c.outcome?.lessons) {
    c.outcome.lessons = c.outcome.lessons.map((l) => ({ ...l, principles: cleanPrinciples(l.principles, 'lesson') }));
  }

  return { ok: errors.length === 0, errors, warnings, value: c };
}
