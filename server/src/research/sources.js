// Wikipedia, SEC EDGAR, news (Google News RSS) and official-website readers.
import { fetchJson, fetchText, assertPublicUrl, robotsAllows, ttlCache, decodeEntities, HttpError } from '../lib/http.js';
import { config } from '../config.js';

// ---------- Wikipedia ----------
export async function wikipediaSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const d = await fetchJson(url);
  return {
    title: d.title,
    extract: d.extract || '',
    url: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    lastModified: d.timestamp || null,
    thumbnail: d.thumbnail?.source || null,
  };
}

// ---------- SEC EDGAR ----------
const secCache = ttlCache(24 * 3600 * 1000, 5);

function secHeaders() {
  if (!config.secUserAgent) throw new HttpError('SEC_USER_AGENT is not configured', 412);
  return { 'User-Agent': config.secUserAgent };
}

async function secTickers() {
  const hit = secCache.get('tickers');
  if (hit) return hit;
  const data = await fetchJson('https://www.sec.gov/files/company_tickers.json', { headers: secHeaders(), maxBytes: 10_000_000 });
  const list = Object.values(data).map((r) => ({ cik: r.cik_str, ticker: String(r.ticker).toUpperCase(), title: r.title }));
  return secCache.set('tickers', list);
}

const norm = (s) => s.toLowerCase().replace(/[.,]/g, '').replace(/\b(inc|corp|corporation|co|company|ltd|plc|holdings?|group|sa|ag|nv)\b/g, '').replace(/\s+/g, ' ').trim();

/** Find an SEC registrant by ticker (preferred) or exact normalised name. */
export async function findSecCompany({ tickers = [], name }) {
  const list = await secTickers();
  for (const t of tickers) {
    const hit = list.find((r) => r.ticker === t.ticker);
    if (hit) return hit;
  }
  const n = norm(name || '');
  return list.find((r) => norm(r.title) === n) || null;
}

const REVENUE_TAGS = [
  ['us-gaap', 'Revenues'],
  ['us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax'],
  ['us-gaap', 'SalesRevenueNet'],
  ['us-gaap', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  ['ifrs-full', 'Revenue'],
  ['ifrs-full', 'RevenueFromContractsWithCustomers'],
];
const INCOME_TAGS = [
  ['us-gaap', 'NetIncomeLoss'],
  ['us-gaap', 'ProfitLoss'],
  ['ifrs-full', 'ProfitLossAttributableToOwnersOfParent'],
  ['ifrs-full', 'ProfitLoss'],
];
const ANNUAL_FORMS = ['10-K', '20-F', '40-F'];

/** Annual values from XBRL company facts (10-K / 20-F / 40-F, ~12-month periods).
 *  Companies change tags over time, so periods are merged across tags (earlier
 *  tags in the list win for the same period). */
function annualSeries(facts, tags) {
  const byEnd = new Map();
  let unitUsed = null;
  const tagsUsed = new Set();
  for (const [ns, tag] of tags) {
    const unitMap = facts?.facts?.[ns]?.[tag]?.units;
    if (!unitMap) continue;
    const unit = unitUsed && unitMap[unitUsed] ? unitUsed : unitMap.USD ? 'USD' : Object.keys(unitMap)[0];
    if (unitUsed && unit !== unitUsed) continue;
    for (const u of unitMap[unit] || []) {
      if (!ANNUAL_FORMS.includes(u.form) || !u.start || !u.end) continue;
      const days = (new Date(u.end) - new Date(u.start)) / 86400000;
      if (days < 330 || days > 400) continue;
      const prev = byEnd.get(u.end);
      if (prev && prev.tag !== tag) continue;
      if (!prev || u.filed > prev.filed) {
        byEnd.set(u.end, { ...u, tag });
        unitUsed = unit;
        tagsUsed.add(`${ns}:${tag}`);
      }
    }
  }
  const series = [...byEnd.values()]
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(-10)
    .map((u) => ({ period: u.end, value: u.val, form: u.form, filed: u.filed, accession: u.accn }));
  return series.length >= 2 ? { tag: [...tagsUsed].join(', '), unit: unitUsed, series } : null;
}

export async function secFinancials(cik) {
  const padded = String(cik).padStart(10, '0');
  const [facts, subs] = await Promise.all([
    fetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, { headers: secHeaders(), maxBytes: 60_000_000, timeout: 20000 }),
    fetchJson(`https://data.sec.gov/submissions/CIK${padded}.json`, { headers: secHeaders(), maxBytes: 20_000_000 }),
  ]);
  const revenue = annualSeries(facts, REVENUE_TAGS);
  const netIncome = annualSeries(facts, INCOME_TAGS);
  const recent = subs.filings?.recent || {};
  const filings = [];
  for (let i = 0; i < (recent.form || []).length && filings.length < 8; i++) {
    if (!['10-K', '10-Q', '8-K', '20-F', '6-K'].includes(recent.form[i])) continue;
    const acc = recent.accessionNumber[i].replace(/-/g, '');
    filings.push({
      form: recent.form[i],
      date: recent.filingDate[i],
      description: recent.primaryDocDescription?.[i] || recent.form[i],
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${recent.primaryDocument[i]}`,
    });
  }
  return {
    entityName: facts.entityName || subs.name,
    cik: Number(cik),
    sic: subs.sicDescription || null,
    revenue,
    netIncome,
    filings,
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${padded}`,
  };
}

// ---------- News: Google News RSS, then Bing News RSS, then GDELT ----------
function parseRss(text, limit) {
  const items = [];
  for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (tag) => decodeEntities((new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(block) || [])[1] || '').trim();
    const sourceMatch = /<source url="([^"]*)">([\s\S]*?)<\/source>/.exec(block);
    const title = pick('title');
    const link = pick('link');
    if (!title || !link) continue;
    const publisher = sourceMatch ? decodeEntities(sourceMatch[2]) : pick('News:Source');
    const date = pick('pubDate');
    items.push({
      title: publisher && title.endsWith(` - ${publisher}`) ? title.slice(0, -(publisher.length + 3)) : title,
      url: link,
      publisher,
      date: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
    });
    if (items.length >= limit) break;
  }
  return items;
}

function gdeltDate(s = '') {
  const m = /^(\d{4})(\d\d)(\d\d)T?(\d\d)(\d\d)(\d\d)/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export async function recentNews(name, limit = 10) {
  const q = encodeURIComponent(`"${name}"`);
  const providers = [
    async () => parseRss((await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`)).text, limit),
    async () => parseRss((await fetchText(`https://www.bing.com/news/search?q=${q}&format=rss`)).text, limit),
    async () => {
      const d = await fetchJson(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}%20sourcelang:english&mode=artlist&format=json&maxrecords=${limit}&sort=datedesc`);
      return (d.articles || []).map((a) => ({ title: a.title, url: a.url, publisher: a.domain, date: gdeltDate(a.seendate) }));
    },
  ];
  const errors = [];
  const names = ['Google News', 'Bing News', 'GDELT'];
  for (const [i, p] of providers.entries()) {
    try {
      const items = await p();
      if (items.length) return items;
    } catch (e) {
      errors.push(`${names[i]}: ${e.status || 'unreachable'}`);
    }
  }
  if (errors.length === providers.length) {
    const err = new Error(`News sources unavailable (${errors.join(', ')}), usually temporary rate limiting`);
    throw err;
  }
  return [];
}

// ---------- Official website ----------
// Browser-style identification: many company sites refuse unknown clients
// outright. BIZSIM still says who it is and still obeys robots.txt.
const SITE_UA = 'Mozilla/5.0 (compatible; BIZSIM/1.6; +https://github.com/bizsim; open-source business research)';
const SITE_HEADERS = { 'User-Agent': SITE_UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en,*;q=0.5' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SKIP_CONTAINERS = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header', 'form']);
const RAW_TEXT_CONTAINERS = new Set(['script', 'style', 'noscript']);
const EXTRACT_BLOCKS = new Set(['h1', 'h2', 'h3', 'p', 'li']);
const BOILERPLATE_RE = /cookie|javascript|subscribe|sign in|log in|©/i;

/**
 * Deterministic single-pass HTML -> plain-text extractor for research dossiers.
 * Extracts text from h1, h2, h3, p, and li blocks while skipping comments and
 * non-content containers (script, style, noscript, svg, nav, footer, header, form).
 * Output is plain text only (capped at 4000 chars) and is never injected as HTML.
 */
export function pageText(html, maxLen = 4000) {
  const src = String(html || '');
  const n = src.length;
  const pieces = [];
  let totalLen = 0;

  let skipDepth = 0;
  let rawSkipTag = null; // e.g. 'script' | 'style' | 'noscript'
  let blockDepth = 0;
  let buf = '';

  const flush = () => {
    if (!buf) return;
    const t = decodeEntities(buf).replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    buf = '';
    if (t.length >= 30 && !BOILERPLATE_RE.test(t) && !pieces.includes(t)) {
      pieces.push(t);
      totalLen += t.length + 1;
    }
  };

  let i = 0;
  let steps = 0;
  const maxSteps = Math.min(n * 2 + 1024, 5_000_000);
  while (i < n && totalLen < maxLen && steps++ < maxSteps) {
    const prevI = i;
    // Inside raw-text container (<script>, <style>, <noscript>): scan strictly for matching </tag
    if (rawSkipTag) {
      const lt = src.indexOf('<', i);
      if (lt === -1) break;
      if (src[lt + 1] === '/') {
        let j = lt + 2;
        while (j < n && /[a-zA-Z0-9-]/.test(src[j])) j++;
        const closeName = src.slice(lt + 2, j).toLowerCase();
        if (closeName === rawSkipTag) {
          const gt = src.indexOf('>', j);
          if (gt === -1) break;
          rawSkipTag = null;
          if (skipDepth > 0) skipDepth--;
          i = gt + 1;
          continue;
        }
      }
      i = lt + 1;
      continue;
    }

    const ch = src[i];
    if (ch === '<') {
      // HTML comment: <!-- ... -->
      if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i + 4);
        if (end === -1) break;
        i = end + 3;
        continue;
      }

      // Find end of tag (respecting quoted attribute values)
      let j = i + 1;
      let quote = '';
      while (j < n) {
        const c = src[j];
        if (quote) {
          if (c === quote) quote = '';
        } else if (c === '"' || c === "'") {
          quote = c;
        } else if (c === '>') {
          break;
        }
        j++;
      }
      if (j >= n) break; // unclosed tag tail: drop safely

      const inner = src.slice(i + 1, j).trim();
      i = j + 1;
      if (!inner || inner[0] === '!' || inner[0] === '?') continue;

      const isClose = inner[0] === '/';
      const isSelfClose = !isClose && inner.endsWith('/');
      let nameStart = isClose ? 1 : 0;
      while (nameStart < inner.length && /\s/.test(inner[nameStart])) nameStart++;
      let nameEnd = nameStart;
      while (nameEnd < inner.length && /[a-zA-Z0-9-]/.test(inner[nameEnd])) nameEnd++;
      const tag = inner.slice(nameStart, nameEnd).toLowerCase();
      if (!tag) continue;

      if (SKIP_CONTAINERS.has(tag)) {
        if (!isClose && !isSelfClose) {
          skipDepth++;
          if (RAW_TEXT_CONTAINERS.has(tag)) rawSkipTag = tag;
        } else if (isClose && skipDepth > 0) {
          skipDepth--;
        }
        continue;
      }

      if (skipDepth === 0 && EXTRACT_BLOCKS.has(tag)) {
        if (!isClose && !isSelfClose) {
          if (blockDepth > 0) flush();
          blockDepth++;
        } else if (isClose && blockDepth > 0) {
          flush();
          blockDepth--;
        }
      } else if (skipDepth === 0 && blockDepth > 0) {
        buf += ' ';
      }
      continue;
    }

    if (skipDepth === 0 && blockDepth > 0) {
      const nextLt = src.indexOf('<', i);
      const end = nextLt === -1 ? n : nextLt;
      buf += src.slice(i, end);
      i = end;
    } else {
      const nextLt = src.indexOf('<', i + 1);
      i = nextLt === -1 ? n : nextLt;
    }
    if (i <= prevI) i = prevI + 1;
  }

  flush();
  return pieces.join('\n').slice(0, maxLen);
}

async function getPage(href) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetchText(href, { timeout: 15000, maxBytes: 2_500_000, headers: SITE_HEADERS });
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError) || ![408, 425, 429, 500, 502, 503, 504].includes(e.status)) break;
      await sleep(1500);
    }
  }
  throw lastErr;
}

/** Variants of a site address worth trying: as given, https, with and without www. */
function addressVariants(raw) {
  const out = [];
  const add = (u) => {
    try {
      const x = new URL(u);
      x.hash = '';
      if (!out.includes(x.href)) out.push(x.href);
    } catch {
      /* skip */
    }
  };
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  add(base);
  const u = new URL(base);
  add(`https://${u.host}${u.pathname}`);
  add(`https://${u.host.startsWith('www.') ? u.host.slice(4) : `www.${u.host}`}${u.pathname}`);
  return out;
}

/**
 * Read a company's official website: the home page, or if that is refused,
 * its "about" page. Returns { url, title, description, siteName, text, fetchedAt }
 * or { blockedByRobots: true } when every candidate page is off limits.
 */
export async function readWebsite(rawUrl) {
  const errors = [];
  let robotsBlocked = false;
  for (const home of addressVariants(rawUrl)) {
    const origin = new URL(home).origin;
    const candidates = [home, `${origin}/about`, `${origin}/about-us`, `${origin}/company`, `${origin}/en/about`];
    for (const href of candidates) {
      try {
        const u = await assertPublicUrl(href);
        if (!(await robotsAllows(u.href))) {
          robotsBlocked = true;
          continue;
        }
        const { text, url } = await getPage(u.href);
        if (!/<html|<body|<title/i.test(text.slice(0, 5000))) throw new Error('not an HTML page');
        const meta = (attr, name) => {
          const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]*>`, 'i');
          const tag = re.exec(text)?.[0];
          return tag ? decodeEntities((/content=["']([^"']*)["']/i.exec(tag) || [])[1] || '').trim() : '';
        };
        const title = decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(text) || [])[1] || '').replace(/\s+/g, ' ').trim();
        const description = meta('name', 'description') || meta('property', 'og:description');
        const body = pageText(text);
        if (!title && !description && body.length < 80) throw new Error('page had no readable text');
        // Bot walls and browser checks are not the company's words.
        if (/unsupported (client|browser)|access denied|just a moment|attention required|are you a robot|captcha|forbidden|request blocked|enable javascript/i.test(`${title} ${body.slice(0, 300)}`) && body.length < 600) throw new Error(`refused automated reading ("${title.slice(0, 40)}")`);
        return { url, title, description, siteName: meta('property', 'og:site_name'), text: body, fetchedAt: new Date().toISOString(), page: href === home ? 'home' : 'about' };
      } catch (e) {
        errors.push(`${new URL(href).host}${new URL(href).pathname}: ${e.message}`);
        // A dead host will not answer the about pages either.
        if (!(e instanceof HttpError) && /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|certificate|private|not allowed/i.test(e.message)) break;
      }
    }
  }
  if (robotsBlocked && !errors.length) return { url: rawUrl, blockedByRobots: true };
  throw new Error(errors.slice(0, 2).join('; ') || 'the site could not be read');
}

/** The "website" field of a Wikipedia infobox, when Wikidata has none. */
export async function wikipediaWebsite(title) {
  if (!title) return null;
  const u = `https://en.wikipedia.org/w/api.php?action=parse&format=json&formatversion=2&prop=wikitext&section=0&redirects=1&page=${encodeURIComponent(title)}`;
  const d = await fetchJson(u);
  const wt = d?.parse?.wikitext || '';
  // Only the infobox's own field (a line starting with "| website ="), never citation parameters.
  const line = /(?:^|\n)\s*\|\s*(?:website|homepage)\s*=\s*([^\n]*)/i.exec(wt)?.[1] || '';
  const tpl = /\{\{\s*(?:URL|url|Official URL|official website)\s*\|\s*([^|}]+)/i.exec(line)?.[1];
  const bare = /(https?:\/\/[^\s\]|}]+)/i.exec(line)?.[1];
  const raw = (tpl || bare || '').trim();
  if (!raw || /wikidata|^\{\{|\.pdf\b/i.test(raw)) return null;
  try {
    const u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
    return `${u.protocol}//${u.host}/`; // the home page, without tracking or text fragments
  } catch {
    return null;
  }
}
