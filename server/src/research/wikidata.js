import { fetchJson } from '../lib/http.js';

const API = 'https://www.wikidata.org/w/api.php';

// Properties we read, with labels and kinds.
const PROPS = {
  P571: { label: 'Founded', kind: 'time' },
  P112: { label: 'Founded by', kind: 'item', multi: true },
  P452: { label: 'Industry', kind: 'item', multi: true },
  P159: { label: 'Headquarters', kind: 'item' },
  P17: { label: 'Country', kind: 'item' },
  P169: { label: 'Chief executive', kind: 'item', latest: true },
  P488: { label: 'Chair', kind: 'item', latest: true },
  P749: { label: 'Parent organisation', kind: 'item' },
  P1128: { label: 'Employees', kind: 'quantity', latest: true },
  P2139: { label: 'Revenue', kind: 'quantity', latest: true },
  P2295: { label: 'Net income', kind: 'quantity', latest: true },
  P856: { label: 'Official website', kind: 'string' },
  P1056: { label: 'Products', kind: 'item', multi: true, limit: 6 },
  P414: { label: 'Stock exchange', kind: 'item', multi: true },
  P576: { label: 'Dissolved', kind: 'time' },
};

const ORG_SIGNALS = ['P452', 'P414', 'P159', 'P1128', 'P2139', 'P856', 'P169', 'P112'];
// Signals that an item is a creative work or product rather than an organisation.
const WORK_SIGNALS = ['P577', 'P178', 'P123', 'P136', 'P400', 'P404', 'P57', 'P50'];
const NOT_ORG_TYPES = new Set(['Q5', 'Q7889', 'Q11424', 'Q5398426', 'Q7397', 'Q166142', 'Q7725634', 'Q482994', 'Q515', 'Q6256', 'Q2425052']);

async function wbGet(ids, props) {
  if (!ids.length) return {};
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `${API}?action=wbgetentities&ids=${chunk.join('|')}&props=${props}&languages=en|mul&languagefallback=1&sitefilter=enwiki&format=json`;
    const data = await fetchJson(url);
    Object.assign(out, data.entities || {});
  }
  return out;
}

/** English label, else the language-neutral ("mul") label, else any label. */
export const labelOf = (e) => e?.labels?.en?.value || e?.labels?.mul?.value || Object.values(e?.labels || {})[0]?.value || e?.id;

const firstItem = (claims, p) => claims?.[p]?.find((s) => s.rank !== 'deprecated')?.mainsnak?.datavalue?.value?.id;

function scoreEntity(e, i) {
  const claims = e?.claims || {};
  let score = ORG_SIGNALS.reduce((s, p) => s + (claims[p] ? 1 : 0), 0);
  if (claims.P414) score += 2;
  if (claims.P452) score += 1;
  if (e?.sitelinks?.enwiki) score += 1;
  const types = (claims.P31 || []).map((s) => s.mainsnak?.datavalue?.value?.id);
  const isWork = WORK_SIGNALS.some((p) => claims[p]) || types.some((t) => NOT_ORG_TYPES.has(t));
  if (isWork) score -= 6;
  return { score: score - i * 0.3, isWork };
}

/** Find the Wikidata item that most plausibly is the company the user meant.
 *  If the best match is a product or creative work (e.g. a video game), its
 *  publisher or developer is researched instead. */
export async function resolveCompany(query) {
  const url = `${API}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&uselang=en&type=item&limit=10&format=json`;
  const data = await fetchJson(url);
  const hits = data.search || [];
  if (!hits.length) return { entity: null, candidates: [] };

  const entities = await wbGet(hits.map((h) => h.id), 'claims|labels|descriptions|sitelinks');
  const scored = hits.map((h, i) => {
    const e = entities[h.id];
    return { id: h.id, label: h.label || labelOf(e), description: h.description || '', entity: e, ...scoreEntity(e, i) };
  });
  const candidates = [...scored].sort((a, b) => b.score - a.score).slice(0, 5).map(({ id, label, description }) => ({ id, label, description }));
  const best = [...scored].sort((a, b) => b.score - a.score)[0];
  if (best.score >= 2) return { entity: best.entity, candidates };

  // Best match is a product/work: research the organisation behind it.
  const top = scored[0];
  if (top?.isWork) {
    const ownerId = firstItem(top.entity.claims, 'P123') || firstItem(top.entity.claims, 'P178') || firstItem(top.entity.claims, 'P176') || firstItem(top.entity.claims, 'P127');
    if (ownerId) {
      const owner = (await wbGet([ownerId], 'claims|labels|descriptions|sitelinks'))[ownerId];
      if (owner) return { entity: owner, via: { id: top.id, label: top.label }, candidates };
    }
  }
  return { entity: null, candidates };
}

function timeToText(v) {
  // Wikidata time: "+1975-04-04T00:00:00Z" with precision 9=year, 10=month, 11=day.
  const m = /^([+-])(\d+)-(\d\d)-(\d\d)/.exec(v.time || '');
  if (!m) return null;
  const year = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  const yearText = year < 0 ? `${-year} BC` : String(year);
  if (v.precision >= 11 && m[4] !== '00') return `${Number(m[4])} ${MONTHS[Number(m[3]) - 1]} ${yearText}`;
  if (v.precision === 10 && m[3] !== '00') return `${MONTHS[Number(m[3]) - 1]} ${yearText}`;
  return yearText;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pointInTime(stmt) {
  const t = stmt.qualifiers?.P585?.[0]?.datavalue?.value?.time;
  return t ? t.slice(1, 11) : '';
}

/** Turn an entity into a list of verified facts, each traceable to Wikidata. */
export async function extractFacts(entity) {
  const claims = entity.claims || {};
  const raw = [];
  const needLabels = new Set();

  for (const [pid, def] of Object.entries(PROPS)) {
    let stmts = (claims[pid] || []).filter((s) => s.rank !== 'deprecated' && s.mainsnak?.datavalue);
    if (!stmts.length) continue;
    const preferred = stmts.filter((s) => s.rank === 'preferred');
    if (def.latest) {
      const pool = preferred.length ? preferred : stmts;
      stmts = [pool.slice().sort((a, b) => pointInTime(b).localeCompare(pointInTime(a)))[0]];
    } else if (!def.multi) {
      stmts = [(preferred[0] || stmts[0])];
    } else {
      stmts = stmts.slice(0, def.limit || 5);
    }
    for (const s of stmts) {
      const v = s.mainsnak.datavalue.value;
      const asOf = pointInTime(s);
      if (def.kind === 'item') {
        needLabels.add(v.id);
        raw.push({ pid, def, itemId: v.id, asOf });
      } else if (def.kind === 'quantity') {
        const unitId = (v.unit || '').split('/').pop();
        if (unitId && unitId !== '1') needLabels.add(unitId);
        raw.push({ pid, def, amount: Number(v.amount), unitId: unitId !== '1' ? unitId : null, asOf });
      } else if (def.kind === 'time') {
        raw.push({ pid, def, text: timeToText(v), asOf });
      } else {
        raw.push({ pid, def, text: String(v), asOf });
      }
    }
  }

  // Ticker symbols are qualifiers (P249) on stock-exchange statements.
  const tickers = [];
  for (const s of claims.P414 || []) {
    const t = s.qualifiers?.P249?.[0]?.datavalue?.value;
    const ex = s.mainsnak?.datavalue?.value?.id;
    if (t) tickers.push({ ticker: String(t).toUpperCase(), exchangeId: ex });
  }
  for (const s of claims.P249 || []) {
    const t = s.mainsnak?.datavalue?.value;
    if (t) tickers.push({ ticker: String(t).toUpperCase(), exchangeId: null });
  }

  const labels = await wbGet([...needLabels], 'labels');
  const label = (id) => (labels[id] ? labelOf(labels[id]) : id);

  const grouped = new Map();
  for (const r of raw) {
    let value;
    if (r.itemId) value = label(r.itemId);
    else if (r.amount != null) value = formatQuantity(r.amount, r.unitId ? label(r.unitId) : '');
    else value = r.text;
    if (!value) continue;
    const key = r.def.label;
    const prev = grouped.get(key);
    if (prev) prev.value += `, ${value}`;
    else grouped.set(key, { label: key, value, asOf: r.asOf || null, property: r.pid, numeric: r.amount ?? null, unit: r.unitId ? label(r.unitId) : null });
  }

  const sourceUrl = `https://www.wikidata.org/wiki/${entity.id}`;
  const facts = [...grouped.values()].map((f) => ({ ...f, sourceUrl }));

  return {
    id: entity.id,
    name: labelOf(entity),
    description: entity.descriptions?.en?.value || entity.descriptions?.mul?.value || '',
    wikipediaTitle: entity.sitelinks?.enwiki?.title || null,
    website: facts.find((f) => f.property === 'P856')?.value || null,
    tickers: tickers.map((t) => ({ ticker: t.ticker, exchange: t.exchangeId ? label(t.exchangeId) : null })),
    facts,
    sourceUrl,
  };
}

function formatQuantity(n, unit) {
  const abs = Math.abs(n);
  const fmt = (x, s) => `${(x).toLocaleString('en-US', { maximumFractionDigits: 1 })}${s}`;
  let text;
  if (abs >= 1e12) text = fmt(n / 1e12, ' trillion');
  else if (abs >= 1e9) text = fmt(n / 1e9, ' billion');
  else if (abs >= 1e6) text = fmt(n / 1e6, ' million');
  else text = n.toLocaleString('en-US');
  return unit ? `${text} ${unit}` : text;
}
