// Turns a research dossier into a playable, source-grounded case.
// The model may only cite sources present in the dossier and principles present
// in the BIZSIM library; deterministic gates remove anything else.
import { writeSeasonParts } from './seasonWriter.js';
import { languageInstruction, cleanLocale, promptLanguage } from '../../../shared/locales.js';
import { validateCase } from '../../../shared/validate.js';
import { wikipediaArticle } from '../research/wikiArticle.js';
import { checkCaseClaims } from '../../../shared/evidenceCheck.js';
import { sanitizeImageUrl } from '../../../shared/imagePolicy.js';

const SYSTEM = `You are BIZSIM's case architect. You write rigorous, neutral executive business cases for learners.
Rules:
- Use ONLY the facts in the dossier. Clearly separate Verified Fact (must cite a sourceId present in sources, e.g. "S2") from AI Analysis / Hypothetical (must set kind: "analysis" or "hypothetical" and never fabricate a URL or historical citation). Never invent numbers, dates, people or events.
- Where the dossier lacks information, say so plainly in "uncertainties" rather than guessing.
- The case is a SEASON of exactly 4 EPISODES in chronological order. Each episode holds 2 or 3 linked decisions and ends with its own outcome and insight.
  - Episodes I to III are real past turning points of THIS company documented in the dossier. Never invent past events: if the dossier documents fewer turning points, mark the missing episodes "live": true instead.
  - Episode IV is what the company faces NOW, based on recent news and filings. It is live: no historical option and no outcome.
- Do not reveal which option is best in the situation, concept or decision context (no spoilers).
- Options must be realistic executive trade-offs; each has clear trade-offs and risks.
- Cite principles ONLY by the ids provided. Never quote books; ideas are already paraphrased.
- Output a single JSON object, no prose.`;

export function buildDossier(r) {
  const lines = [];
  const sources = [];
  const add = (src) => {
    const id = `S${sources.length + 1}`;
    sources.push({ id, ...src });
    return id;
  };

  if (r.profile) {
    const id = add({ title: `Wikidata: ${r.profile.name}`, publisher: 'Wikidata', url: r.profile.sourceUrl, type: 'Structured data' });
    lines.push(`[${id}] Structured facts: ${r.profile.facts.map((f) => `${f.label}: ${f.value}${f.asOf ? ` (as of ${f.asOf})` : ''}`).join('; ')}`);
  }
  if (r.wikipedia) {
    const id = add({ title: `Wikipedia: ${r.wikipedia.title}`, publisher: 'Wikipedia', url: r.wikipedia.url, type: 'Reference', date: r.wikipedia.lastModified });
    lines.push(`[${id}] Encyclopedia article (company history): ${r.wikipediaFull || r.wikipedia.extract}`);
  }
  if (r.sec) {
    const id = add({ title: `SEC EDGAR: ${r.sec.entityName}`, publisher: 'U.S. SEC', url: r.sec.sourceUrl, type: 'Regulatory filing' });
    const fmt = (s) => s?.series.map((p) => `${p.period}: ${(p.value / 1e9).toFixed(2)}bn ${s.unit}`).join(', ');
    if (r.sec.revenue) lines.push(`[${id}] Annual revenue (annual filings, ${r.sec.revenue.tag}): ${fmt(r.sec.revenue)}`);
    if (r.sec.netIncome) lines.push(`[${id}] Annual net income (annual filings): ${fmt(r.sec.netIncome)}`);
    if (r.sec.filings?.length) lines.push(`[${id}] Recent filings: ${r.sec.filings.map((f) => `${f.form} ${f.date}`).join('; ')}`);
  }
  for (const n of r.news || []) {
    const id = add({ title: n.title, publisher: n.publisher || 'News', url: n.url, type: 'News', date: n.date });
    lines.push(`[${id}] Headline (${n.date ? n.date.slice(0, 10) : 'undated'}, ${n.publisher || 'unknown publisher'}): ${n.title}`);
  }
  if (r.website && !r.website.blockedByRobots && (r.website.description || r.website.title)) {
    const id = add({ title: r.website.title || 'Official website', publisher: 'Company website', url: r.website.url, type: 'Company', date: r.website.fetchedAt });
    lines.push(`[${id}] Company's own website (${r.website.page === 'about' ? 'about page' : 'home page'}): ${r.website.title}. ${r.website.description}${r.website.text ? `\n${r.website.text.slice(0, 3000)}` : ''}`);
  }
  return { text: lines.join('\n'), sources };
}

export async function synthesiseCase(research, onProgress, { locale = null } = {}) {
  const lang = cleanLocale(locale);
  if (research.wikipedia && !research.wikipediaFull) {
    try {
      research.wikipediaFull = (await wikipediaArticle(research.wikipedia.title, 30000)).text;
    } catch {
      /* summary is enough to continue */
    }
  }
  const dossier = buildDossier(research);
  if (dossier.sources.length < 2) throw new Error('Not enough evidence to construct a case');

  const brief = `Company: ${research.profile?.name || research.query}
Today's date: ${new Date().toISOString().slice(0, 10)}

DOSSIER (cite by id):
${dossier.text}`;

  const slug = (research.profile?.name || research.query).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sourceIds = dossier.sources.map((x) => x.id);
  const parts = await writeSeasonParts({
    system: SYSTEM + languageInstruction(lang) + (lang && lang !== 'en' ? `\nWrite ALL user-facing prose—including title, summary, dilemmas, evidence, outcomes, and baseRate—strictly in ${promptLanguage(lang)} (${lang}). Do not mix English prose into non-English responses.` : ''),
    brief,
    sourceIds,
    liveLast: true,
    isLive: (i, total, e) => i === total - 1 || e?.live === true,
    onProgress,
  });
  const raw = parts.frame;
  const candidate = {
    title: raw.title,
    tagline: raw.tagline,
    situation: raw.situation,
    concept: raw.concept,
    evidence: raw.evidence,
    analysis: raw.analysis,
    scenarios: raw.scenarios,
    id: `gen-${slug}-${Date.now().toString(36)}`,
    company: research.profile?.name || research.query,
    yearLabel: String(new Date().getFullYear()),
    yearSort: new Date().getFullYear(),
    era: 'LATEST',
    domain: 'STRATEGY',
    scale: 'ENTERPRISE',
    difficulty: 2,
    minutes: 18,
    classification: 'LIVE',
    source: 'generated',
    contentLocale: lang && lang !== 'en' ? lang : undefined,
    generatedAt: new Date().toISOString(),
    imageQuery: research.profile?.name || research.query,
    wiki: research.wikipedia?.title || undefined,
    cover: sanitizeImageUrl(research.wikipedia?.thumbnail, research.wikipedia?.title || research.query) || undefined,
    sources: dossier.sources.map(({ id, title, publisher, url, type, date }) => ({ id, title, publisher, url, type, date })),
    checkpoints: parts.checkpoints,
    episodes: parts.episodes,
    outcome: {
      summary: raw.analysis?.summary || '',
      secondOrder: [],
      baseRate: 'The final episode is a live, unresolved situation: its outcome is not yet known, and its assessments are AI-generated analysis, not verified results. Earlier episodes summarise documented history from the cited sources.',
      lessons: raw.lessons || [],
    },
  };
  const expectedEpisodes = parts.partial ? parts.episodes.length : 4;
  const { ok, errors, warnings, value } = validateCase(candidate, { requireHistorical: true, episodes: expectedEpisodes });
  if (!ok) throw new Error(`case failed checks: ${errors.slice(0, 3).join('; ')}`);
  value.model = parts.model;
  value.aiGenerated = true;
  if (parts.partial) value.partial = parts.partial;
  // Compare each outcome and evidence item with the dossier text it cites.
  const textById = {};
  for (const line of dossier.text.split('\n')) {
    const m = /^\[(S\d+)\]/.exec(line);
    if (m) textById[m[1]] = `${textById[m[1]] || ''}\n${line}`;
  }
  value.evidenceChecks = checkCaseClaims(value, textById);
  value.evidenceCheckedAt = new Date().toISOString();
  return { case: value, warnings, dossierSources: dossier.sources };
}
