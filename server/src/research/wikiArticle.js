// Full plain-text Wikipedia article fetch, used to ground live seasons in the
// company's documented history.
import { fetchJson } from '../lib/http.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Wikipedia API call with back-off on rate limits (HTTP 429 / throttling). */
async function wiki(url, opts) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchJson(url, opts);
    } catch (e) {
      if (attempt >= 3 || (e.status && e.status !== 429 && e.status !== 502 && e.status !== 503)) throw e;
      await sleep(1500 * (attempt + 1));
    }
  }
}

export async function wikipediaArticle(title, limit = 40000) {
  const u = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`;
  const d = await wiki(u, { maxBytes: 4_000_000 });
  const page = Object.values(d.query?.pages || {})[0];
  if (!page || page.missing !== undefined || !page.extract) throw new Error(`Wikipedia article "${title}" not found`);
  // Drop reference-only sections; keep the narrative within a sensible budget.
  const text = page.extract.split(/\n== (See also|References|Notes|Further reading|External links|Bibliography|Sources|Citations) ==/)[0];
  return { title: page.title, url: page.fullurl, touched: page.touched, text: text.slice(0, limit) };
}
