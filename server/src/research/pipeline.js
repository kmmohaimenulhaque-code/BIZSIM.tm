// The live research pipeline. Every stage reported to the user corresponds to a
// real operation below; sources are emitted only when they are actually retrieved.
import { seasonShape } from '../../../shared/episodes.js';
import { resolveCompany, extractFacts, labelOf } from './wikidata.js';
import { wikipediaSummary, findSecCompany, secFinancials, recentNews, readWebsite, wikipediaWebsite } from './sources.js';
import { synthesiseCase } from '../ai/caseSynth.js';
import { llmEnabled } from '../ai/llm.js';
import { config } from '../config.js';
import { ttlCache } from '../lib/http.js';

export const STAGES = [
  { id: 'resolve', label: 'Identifying the company' },
  { id: 'profile', label: 'Collecting structured company data' },
  { id: 'filings', label: 'Checking SEC EDGAR filings' },
  { id: 'news', label: 'Gathering recent news coverage' },
  { id: 'website', label: 'Reading the official website' },
  { id: 'synthesis', label: 'Constructing the case' },
];

const cache = ttlCache(60 * 60 * 1000, 100);

export async function runResearch(query, emit = () => {}, { generate = true } = {}) {
  const q = String(query || '').trim().slice(0, 120);
  if (q.length < 2) throw new Error('Enter a company name.');
  const cacheKey = `${q.toLowerCase()}|${generate && llmEnabled()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    for (const s of STAGES) emit('stage', { id: s.id, status: cached.stages[s.id]?.status || 'done', detail: cached.stages[s.id]?.detail || 'Loaded from recent research' });
    for (const src of cached.sources) emit('source', src);
    emit('result', { ...cached, fromCache: true });
    return cached;
  }

  const result = { query: q, startedAt: new Date().toISOString(), stages: {}, sources: [], candidates: [], profile: null, wikipedia: null, sec: null, news: [], website: null, generated: null };
  const stage = (id, status, detail) => {
    result.stages[id] = { status, detail };
    emit('stage', { id, status, detail });
  };
  const source = (s) => {
    const src = { retrievedAt: new Date().toISOString(), ...s };
    result.sources.push(src);
    emit('source', src);
  };

  // 1. Resolve
  stage('resolve', 'running');
  const { entity, candidates, via } = await resolveCompany(q);
  result.candidates = candidates;
  if (!entity) {
    stage('resolve', 'error', 'No matching organisation found in Wikidata');
    for (const s of STAGES.slice(1)) stage(s.id, 'skipped', 'Company not identified');
    result.finishedAt = new Date().toISOString();
    emit('result', result);
    return result;
  }
  stage('resolve', 'done', via ? `${labelOf(entity)}, maker of ${via.label}` : `${labelOf(entity)} (${entity.id})`);
  if (via) result.via = via;

  // 2. Profile: Wikidata facts + Wikipedia summary
  stage('profile', 'running');
  result.profile = await extractFacts(entity);
  source({ kind: 'structured', title: `Wikidata: ${result.profile.name}`, publisher: 'Wikidata', url: result.profile.sourceUrl });
  if (result.profile.wikipediaTitle) {
    try {
      result.wikipedia = await wikipediaSummary(result.profile.wikipediaTitle);
      source({ kind: 'reference', title: `Wikipedia: ${result.wikipedia.title}`, publisher: 'Wikipedia', url: result.wikipedia.url, date: result.wikipedia.lastModified });
    } catch (e) {
      result.wikipediaError = e.message;
    }
  }
  stage('profile', 'done', `${result.profile.facts.length} structured facts${result.wikipedia ? ' + encyclopedia summary' : ''}`);

  // 3–5 run concurrently: they are independent network operations.
  const filings = (async () => {
    if (!config.secUserAgent) return stage('filings', 'skipped', 'SEC access not configured (set SEC_USER_AGENT)');
    stage('filings', 'running');
    try {
      const hit = await findSecCompany({ tickers: result.profile.tickers, name: result.profile.name });
      if (!hit) return stage('filings', 'skipped', 'Not an SEC registrant');
      result.sec = await secFinancials(hit.cik);
      source({ kind: 'filing', title: `SEC EDGAR: ${result.sec.entityName}`, publisher: 'U.S. Securities and Exchange Commission', url: result.sec.sourceUrl });
      stage('filings', 'done', `${result.sec.revenue?.series.length || 0} years of audited revenue, ${result.sec.filings.length} recent filings`);
    } catch (e) {
      stage('filings', 'error', e.message);
    }
  })();

  const news = (async () => {
    stage('news', 'running');
    try {
      result.news = await recentNews(result.profile.name);
      result.news.forEach((n) => source({ kind: 'news', title: n.title, publisher: n.publisher, url: n.url, date: n.date }));
      stage('news', result.news.length ? 'done' : 'skipped', result.news.length ? `${result.news.length} articles` : 'No recent coverage found');
    } catch (e) {
      stage('news', 'error', e.message);
    }
  })();

  const website = (async () => {
    stage('website', 'running');
    // Candidates: Wikidata's official website, then the Wikipedia infobox's.
    const fromWiki = result.wikipedia?.title ? await wikipediaWebsite(result.wikipedia.title).catch(() => null) : null;
    const host = (u) => {
      try {
        return new URL(/^https?:/.test(u) ? u : `https://${u}`).host.replace(/^www\./, '');
      } catch {
        return u;
      }
    };
    const sites = [result.profile.website, fromWiki].filter(Boolean).filter((u, i, a) => a.findIndex((x) => host(x) === host(u)) === i);
    if (!sites.length) return stage('website', 'skipped', 'No official website found in Wikidata or Wikipedia');
    const problems = [];
    let robots = false;
    for (const site of sites) {
      try {
        const w = await readWebsite(site);
        if (w.blockedByRobots) {
          robots = true;
          continue;
        }
        result.website = w;
        source({ kind: 'company', title: w.title || site, publisher: 'Official website', url: w.url, date: w.fetchedAt });
        return stage('website', 'done', `${new URL(w.url).hostname}${w.page === 'about' ? ' (about page)' : ''}`);
      } catch (e) {
        problems.push(`${host(site)}: ${String(e.message).slice(0, 100)}`);
      }
    }
    if (robots && !problems.length) return stage('website', 'skipped', 'The site asks automated readers not to visit its pages');
    stage('website', 'error', `Could not read the website (${problems.join('; ')})`);
  })();

  await Promise.all([filings, news, website]);

  // 6. Synthesis
  if (!generate) stage('synthesis', 'skipped', 'Case generation not requested');
  else if (!llmEnabled()) stage('synthesis', 'skipped', 'No AI key set up, so showing verified evidence only');
  else {
    stage('synthesis', 'running');
    try {
      result.generated = await synthesiseCase(result, (detail) => stage('synthesis', 'running', detail));
      stage('synthesis', 'done', `${seasonShape(result.generated.case)}${result.generated.case.model ? ` · ${result.generated.case.model}` : ''}`);
    } catch (e) {
      stage('synthesis', 'error', e.message);
    }
  }

  delete result.wikipediaFull; // used for synthesis only; too large to send to the browser
  result.finishedAt = new Date().toISOString();
  // Only reuse fully successful research; failures should be retried fresh.
  if (!Object.values(result.stages).some((st) => st.status === 'error')) cache.set(cacheKey, result);
  emit('result', result);
  return result;
}
