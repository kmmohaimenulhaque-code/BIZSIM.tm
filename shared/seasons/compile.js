// Compiles the compact season format used in shared/seasons/*.js into full
// BIZSIM cases (the same shape as the hand-written cases in shared/cases/).
//
// Compact format, one object per catalogue season:
//   n        catalogue number; title, era, year, pillar and episode titles come from the catalogue
//   co       company / protagonist
//   tag      one-line tagline
//   role, head, ctx[], stakes                         the Situation step
//   fw, ex, pr                                        Concept: framework, explanation, "principle ids"
//   ev       [[label, value, note], …]                Evidence (cited to the main Wikipedia article)
//   eps      four episodes: [dateLabel, prompt, context, [opt, opt, opt], outcomeText]
//            opt = [label, summary, tradeoffs, risks, consequence, quality 1-3, "dims", "principles", impact?]
//            a label starting with "*" marks what actually happened (exactly one per episode)
//            dims: space-separated codes like "R+ K- T+" (see DIM below)
//   sum, so[], base                                   Outcome: summary, second-order effects, base rate
//   les      [[lesson, "principle ids"], …]
//   src      optional extra Wikipedia article titles (cited as S2, S3 …)
//   diff     difficulty 1-3 (default 2)
import { CATALOGUE } from '../catalogue.js';

const DIM = {
  T: 'TIME_HORIZON',
  S: 'SUCCESS_METRIC',
  R: 'RISK_APPETITE',
  C: 'CONCENTRATION',
  L: 'LEADERSHIP',
  D: 'DECISION_STYLE',
  P: 'SOCIAL_PROOF',
  K: 'COMMITMENT',
  V: 'VALUE_SIGNAL',
  X: 'ROOT_CAUSE',
};

const DOMAIN = { STRATEGY: 'STRATEGY', FINANCE: 'CAPITAL', BRAND: 'BRAND', OPERATIONS: 'OPERATIONS', TURNAROUND: 'STRATEGY', LEADERSHIP: 'POWER' };

const wikiUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%26/g, '&').replace(/%27/g, "'").replace(/%28/g, '(').replace(/%29/g, ')')}`;

const ids = (s) => (s ? String(s).split(/\s+/).filter(Boolean) : []);

function dims(code) {
  const out = {};
  for (const t of ids(code)) {
    const key = DIM[t[0]];
    if (!key) throw new Error(`unknown dimension code "${t}"`);
    out[key] = t.endsWith('++') ? 90 : t.endsWith('--') ? -90 : t.endsWith('+') ? 60 : -60;
  }
  return out;
}

// Default impact by decision quality, varied slightly so options don't all look alike.
function impact(q, seed) {
  const base = { 3: [12, 10, 8], 2: [4, 2, 3], 1: [-8, -6, -7] }[q] || [0, 0, 0];
  const v = [0, 2, -2][seed % 3];
  return { position: base[0] + v, finance: base[1] - v, resilience: base[2] + (seed % 2 ? 2 : -1) };
}

/** Apply fuller option text ("summary | trade-offs | risks | consequence"), one line per option. */
function polished(s, polish) {
  const lines = polish?.[s.n];
  if (!lines) return s;
  if (lines.length !== 12) throw new Error(`season ${s.n}: polish needs 12 lines, has ${lines.length}`);
  return {
    ...s,
    eps: s.eps.map((e, i) => {
      const opts = e[3].map((o, j) => {
        let line = lines[i * 3 + j];
        const next = o.slice();
        // Optional "New label :: " prefix replaces a terse label (the * marker is kept).
        if (line.includes(' :: ')) {
          const [label, rest] = line.split(' :: ');
          next[0] = (o[0].startsWith('*') ? '*' : '') + label;
          line = rest;
        }
        const parts = line.split(' | ');
        if (parts.length !== 4) throw new Error(`season ${s.n} episode ${i + 1} option ${j + 1}: polish needs 4 parts`);
        [next[1], next[2], next[3], next[4]] = parts;
        return next;
      });
      return [e[0], e[1], e[2], opts, ...e.slice(4)];
    }),
  };
}

/** Apply clearer labels and summaries ("Label :: Summary") keyed by "season.episode.option". */
function relabelled(s, labels) {
  if (!labels) return s;
  return {
    ...s,
    eps: s.eps.map((e, i) => [
      e[0], e[1], e[2],
      e[3].map((o, j) => {
        const fix = labels[`${s.n}.${i}.${j}`];
        if (!fix) return o;
        const [label, summary] = fix.split(' :: ');
        if (!label || !summary) throw new Error(`season ${s.n}: bad label fix ${i}.${j}`);
        const next = o.slice();
        next[0] = (o[0].startsWith('*') ? '*' : '') + label;
        next[1] = summary;
        return next;
      }),
      ...e.slice(4),
    ]),
  };
}

/** Build one compact option into a full option. */
export function buildOption([label, summary, tradeoffs, risks, consequence, q, dimCode, pr, imp], j, seed, concept) {
  return {
    id: 'abc'[j],
    label: label.replace(/^\*/, ''),
    historical: label.startsWith('*'),
    quality: q,
    summary,
    tradeoffs,
    risks,
    consequence,
    impact: imp ? { position: imp[0], finance: imp[1], resilience: imp[2] } : impact(q, seed + j),
    dims: dims(dimCode),
    principles: pr ? ids(pr) : q === 3 ? concept.slice(0, 2) : [],
  };
}

/** With twice as many decisions per season, each one moves the company meters a little less. */
export const IMPACT_SCALE = 0.6;
export function scaleImpact(o) {
  const im = o.impact || {};
  const f = (v) => Math.round((Number(v) || 0) * IMPACT_SCALE);
  return { ...o, impact: { position: f(im.position), finance: f(im.finance), resilience: f(im.resilience) } };
}

/**
 * Turn a case with one decision per episode into episodes of several decisions.
 * extras: one entry per episode,
 *   [prompt, context, [opt, opt, opt], outcomeText, "S1 S2", insightText, "principle ids", before? | { before, date }]
 * The extra decision goes after the episode's existing decision (or before it
 * when `before` is true). Existing decision ids are unchanged so saved runs stay valid.
 */
export function withEpisodes(c, extras, where = c.id) {
  if (!extras) return c;
  if (extras.length !== c.checkpoints.length) throw new Error(`${where}: extras need ${c.checkpoints.length} episodes, have ${extras.length}`);
  const concept = c.concept?.principles || [];
  const checkpoints = [];
  const episodes = [];
  c.checkpoints.forEach((k, i) => {
    const x = extras[i];
    if (!Array.isArray(x) || x.length < 7) throw new Error(`${where} episode ${i + 1}: extra needs 7 fields`);
    const [prompt, context, opts, outcome, srcIds, insight, insightPr, extra8] = x;
    // 8th field: true (place before the existing decision) or { before, date }.
    const before = extra8 === true || Boolean(extra8?.before);
    const dateLabel = extra8?.date || k.dateLabel;
    const hist = opts.filter((o) => o[0].startsWith('*')).length;
    if (!k.live && hist !== 1) throw new Error(`${where} episode ${i + 1} extra: ${hist} historical options`);
    const n = i + 1;
    const extra = {
      id: `${k.id}x`,
      episode: n,
      title: k.title,
      dateLabel,
      prompt,
      context,
      complexity: k.complexity ?? 1,
      ...(k.live ? { live: true } : {}),
      options: opts.map((o, j) => scaleImpact(buildOption(o, j, (c.yearSort || 0) + i * 7, concept))),
      outcome: { text: outcome, sourceIds: srcIds ? ids(srcIds) : ['S1'] },
    };
    const base = { ...k, episode: n, options: k.options.map(scaleImpact) };
    checkpoints.push(...(before ? [extra, base] : [base, extra]));
    episodes.push({ n, title: k.title, dateLabel: k.dateLabel, ...(k.live ? { live: true } : {}), insight: { text: insight, principles: ids(insightPr) } });
  });
  return { ...c, checkpoints, episodes };
}

export function compileSeason(raw, polish, labels, extras) {
  return withEpisodes(compileBase(raw, polish, labels), extras?.[raw.n], `season ${raw.n}`);
}

function compileBase(raw, polish, labels) {
  const s = relabelled(polished(raw, polish), labels);
  const e = CATALOGUE.find((x) => x.n === s.n);
  if (!e) throw new Error(`season ${s.n}: not in catalogue`);
  if (!Array.isArray(s.eps) || s.eps.length !== 4) throw new Error(`season ${s.n}: needs exactly 4 episodes`);
  const sources = [e.wiki, ...(s.src || [])].map((t, i) => ({
    id: `S${i + 1}`,
    title: `Wikipedia: ${t}`,
    publisher: 'Wikipedia',
    url: wikiUrl(t),
    type: 'Reference',
  }));
  const concept = ids(s.pr);
  return {
    id: `season-${e.id}`,
    catalogueId: e.id,
    title: e.title,
    company: s.co,
    yearLabel: e.when,
    yearSort: e.yearSort,
    era: e.era,
    pillar: e.pillar,
    domain: DOMAIN[e.pillar] || 'STRATEGY',
    scale: 'ENTERPRISE',
    difficulty: s.diff || 2,
    minutes: 16,
    tagline: s.tag,
    imageQuery: e.wiki,
    reading: e.reading,
    classification: 'HISTORICAL',
    source: 'curated',
    situation: { role: s.role, headline: s.head, context: s.ctx, stakes: s.stakes },
    concept: { framework: s.fw, explanation: s.ex, principles: concept },
    evidence: (s.ev || []).map(([label, value, note]) => ({ label, value, note, sourceId: 'S1' })),
    sources,
    checkpoints: s.eps.map(([dateLabel, prompt, context, opts, outcome, srcIds], i) => {
      const hist = opts.filter((o) => o[0].startsWith('*')).length;
      if (hist !== 1) throw new Error(`season ${s.n} episode ${i + 1}: ${hist} historical options`);
      return {
        id: `e${i + 1}`,
        title: e.episodes[i],
        dateLabel,
        prompt,
        context,
        complexity: 0.9 + i * 0.1,
        options: opts.map((o, j) => buildOption(o, j, s.n + i, concept)),
        outcome: { text: outcome, sourceIds: srcIds ? ids(srcIds) : ['S1'] },
      };
    }),
    outcome: {
      summary: s.sum,
      secondOrder: s.so || [],
      baseRate: s.base,
      lessons: (s.les || []).map(([text, pr]) => ({ text, principles: ids(pr) })),
    },
  };
}
