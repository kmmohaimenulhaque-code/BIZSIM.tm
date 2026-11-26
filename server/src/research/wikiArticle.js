// Full plain-text Wikipedia article fetch, used to ground live seasons in the
// company's documented history. Includes Wikimedia-compliant headers, backoff on
// transient errors, and a REST summary fallback if prop=extracts is throttled.
import { fetchJson } from '../lib/http.js';
import { config } from '../config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WIKI_HEADERS = () => ({
  'User-Agent': config.userAgent,
  'Api-User-Agent': config.userAgent,
  Accept: 'application/json',
});

/** Wikipedia API call with back-off on rate limits and transient errors. */
async function wiki(url, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJson(url, {
        timeout: 15000,
        ...opts,
        headers: { ...WIKI_HEADERS(), ...(opts.headers || {}) },
      });
    } catch (e) {
      const retryable = !e.status || [429, 500, 502, 503, 504].includes(e.status);
      if (attempt >= 3 || !retryable) throw e;
      await sleep(1200 * (attempt + 1));
    }
  }
}

export async function wikipediaArticle(title, limit = 40000) {
  const clean = String(title || '').trim();
  if (!clean) throw new Error('Empty Wikipedia title');
  const u = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(clean)}`;
  let primaryErr = null;
  try {
    const d = await wiki(u, { maxBytes: 4_000_000 });
    const page = Object.values(d.query?.pages || {})[0];
    if (page && page.missing === undefined && page.extract && page.extract.trim().length > 80) {
      // Drop reference-only sections; keep the narrative within a sensible budget.
      const text = page.extract.split(/\n== (See also|References|Notes|Further reading|External links|Bibliography|Sources|Citations) ==/)[0];
      return { title: page.title, url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`, touched: page.touched, text: text.slice(0, limit) };
    }
  } catch (e) {
    primaryErr = e;
  }

  // Fallback: Wikimedia REST v1 page summary (resilient when prop=extracts is throttled or empty)
  try {
    const slug = encodeURIComponent(clean.replace(/ /g, '_'));
    const s = await wiki(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, { maxBytes: 512_000 });
    if (s && s.type !== 'disambiguation' && s.extract && s.extract.trim().length > 40) {
      return {
        title: s.title || clean,
        url: s.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${slug}`,
        touched: s.timestamp,
        text: `${s.description ? `${s.description}.\n\n` : ''}${s.extract}`.slice(0, limit),
      };
    }
  } catch (e) {
    if (!primaryErr) primaryErr = e;
  }

  if (primaryErr) throw primaryErr;
  throw new Error(`Wikipedia article "${clean}" not found`);
}
