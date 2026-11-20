// Checks every source cited by the built-in seasons and records an evidence
// status for every claim (decision outcomes and evidence items).
//
//   node scripts/check-sources.mjs            fetch (with a local cache) and write shared/evidenceData.js
//   node scripts/check-sources.mjs --offline  re-score from the cache only
//
// Sources are fetched politely (one request at a time, with a pause) and cached
// in .cache/sources so a rerun does not hit Wikipedia again. A claim is marked
// "verified" only when its specific details are found in the cited source text;
// see shared/evidenceCheck.js. Nothing here proves historical truth.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CASES } from '../shared/cases/index.js';
import { checkClaim } from '../shared/evidenceCheck.js';

const ROOT = new URL('..', import.meta.url);
const CACHE = new URL('.cache/sources/', ROOT);
mkdirSync(CACHE, { recursive: true });
const OFFLINE = process.argv.includes('--offline');
const UA = 'BIZSIM/1.6 (open-source education app; source checker; https://github.com/)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyOf = (url) => createHash('sha1').update(url).digest('hex');

function wikiTitle(url) {
  const m = /^https:\/\/en\.wikipedia\.org\/wiki\/(.+)$/.exec(url || '');
  return m ? decodeURIComponent(m[1].split('#')[0]) : null;
}

async function fetchSource(url) {
  const file = new URL(`${keyOf(url)}.json`, CACHE);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (OFFLINE) return { url, ok: false, checked: false, error: 'not in cache' };
  const title = wikiTitle(url);
  let result;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (title) {
        const api = `https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&prop=extracts|revisions|info&explaintext=1&exsectionformat=plain&rvprop=timestamp&redirects=1&titles=${encodeURIComponent(title)}`;
        const res = await fetch(api, { headers: { 'User-Agent': UA } });
        if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
        const data = await res.json();
        const page = data?.query?.pages?.[0];
        if (!page || page.missing) result = { url, ok: false, checked: true, error: 'page not found' };
        else
          result = {
            url,
            ok: Boolean(page.extract),
            checked: true,
            title: page.title,
            pageid: page.pageid,
            lastRevision: page.revisions?.[0]?.timestamp || null,
            text: page.extract || '',
          };
      } else {
        const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
        const html = res.ok ? await res.text() : '';
        const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
        const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
        result = { url, ok: res.ok, checked: true, status: res.status, title: t || null, text };
      }
      break;
    } catch (e) {
      if (!e.retry || attempt === 3) {
        // A refusal by the build machine's network is not evidence that the source is gone.
        result = { url, ok: false, checked: false, error: String(e.message || e) };
        break;
      }
      await sleep(15000 * (attempt + 1));
    }
  }
  if (result.checked) writeFileSync(file, JSON.stringify({ ...result, fetchedAt: new Date().toISOString() }));
  await sleep(1200);
  return result;
}

const urls = [...new Set(CASES.flatMap((c) => c.sources.map((s) => s.url).filter(Boolean)))];
console.log(`${urls.length} distinct sources across ${CASES.length} seasons`);
const fetched = new Map();
let n = 0;
for (const url of urls) {
  fetched.set(url, await fetchSource(url));
  if (++n % 25 === 0) console.log(`  ${n}/${urls.length}`);
}

const sources = {};
for (const [url, r] of fetched) {
  sources[url] = r.checked
    ? { status: r.ok ? 'available' : 'inaccessible', title: r.title || null, lastRevision: r.lastRevision || null, checkedAt: r.fetchedAt || new Date().toISOString() }
    : { status: 'unchecked', note: 'Could not be reached from the build machine' };
}

const claims = {};
const tally = { verified: 0, available: 0, inaccessible: 0, insufficient: 0, unchecked: 0 };
const forClaim = (c, text, ids) => {
  const cited = (ids || []).map((id) => c.sources.find((s) => s.id === id)).filter(Boolean);
  if (!cited.length) return checkClaim(text, []);
  const rs = cited.map((s) => (s.url ? fetched.get(s.url) : null));
  // A source never checked (e.g. a book with no link, or a site the build machine could not reach)
  // leaves the claim unchecked rather than inaccessible.
  if (rs.every((r) => !r || !r.checked)) return { status: 'unchecked', matched: 0, total: 0 };
  return checkClaim(text, rs.map((r) => (r && r.checked ? { ok: r.ok, text: r.text } : { ok: false })));
};
for (const c of CASES) {
  const entry = {};
  for (const k of c.checkpoints) {
    if (!k.outcome?.text) continue;
    const r = forClaim(c, k.outcome.text, k.outcome.sourceIds);
    entry[k.id] = [r.status, r.matched || 0, r.total || 0];
    tally[r.status]++;
  }
  (c.evidence || []).forEach((e, i) => {
    const r = forClaim(c, `${e.label} ${e.value} ${e.note || ''}`, e.sourceId ? [e.sourceId] : []);
    entry[`ev${i}`] = [r.status, r.matched || 0, r.total || 0];
    tally[r.status]++;
  });
  claims[c.id] = entry;
}

const out = {
  checkedAt: new Date().toISOString(),
  method: 'Automated: each claim’s years, figures and proper names are searched for in the plain text of the sources it cites. Verified means at least two details and 75% of them were found. This shows source support for details, not historical truth.',
  tally,
  sources,
  claims,
};
writeFileSync(
  new URL('shared/evidenceData.js', ROOT),
  `// Generated by scripts/check-sources.mjs. Do not edit by hand.\n// Claim entries are [status, details found, details checked].\nexport default ${JSON.stringify(out)};\n`,
);
console.log('claims:', tally);
console.log('sources:', Object.values(sources).reduce((m, s) => ({ ...m, [s.status]: (m[s.status] || 0) + 1 }), {}));
