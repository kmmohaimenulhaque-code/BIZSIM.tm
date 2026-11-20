// On-topic cover images: the lead image of the season's own Wikipedia article,
// served by Wikimedia Commons. Wikipedia only marks freely licensed files as
// page images (non-free files are excluded), and the licence is read from the
// file's metadata and shown with the image. Works in the browser (CORS via
// origin=*) and in Node 18+.
const API = 'https://en.wikipedia.org/w/api.php';
const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const isNode = typeof window === 'undefined';
async function api(params, timeout = 9000) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal, headers: isNode ? { Accept: 'application/json', 'User-Agent': 'BIZSIM/1.6 (open-source business case simulator; https://github.com/)' } : { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Wikipedia responded ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toImage(file, info, article) {
  if (!info) return null;
  const m = info.extmetadata || {};
  if (String(m.NonFree?.value || '').toLowerCase() === 'true') return null;
  const license = strip(m.LicenseShortName?.value) || 'Free licence';
  if (/fair use|non-free/i.test(license)) return null;
  if ((info.width || 0) < 240) return null;
  return {
    id: `wiki:${file}`,
    url: info.thumburl || info.url,
    title: strip(m.ObjectName?.value) || file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '),
    creator: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons contributor',
    license,
    licenseUrl: m.LicenseUrl?.value || null,
    landingUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
    article,
    provider: 'Wikimedia Commons',
    width: info.thumbwidth || info.width,
    height: info.thumbheight || info.height,
  };
}

const fileInfo = (titles, width) =>
  api({
    action: 'query',
    titles: titles.map((f) => `File:${f}`).join('|'),
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: String(width),
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|NonFree|ObjectName',
  });

/** The lead image of a Wikipedia article (by exact title), or null. */
export async function wikiLeadImage(title, width = 960) {
  if (!title) return null;
  return (await wikiLeadImages([title], width))[title] || null;
}

/** Lead images for many articles at once (50 per request). Returns { title: image|null }. */
export async function wikiLeadImages(titles, width = 960) {
  const out = {};
  const uniq = [...new Set(titles.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const group = uniq.slice(i, i + 50);
    const d = await api({ action: 'query', titles: group.join('|'), redirects: '1', prop: 'pageimages', piprop: 'name', pilicense: 'free', pilimit: '50' });
    const q = d?.query || {};
    const alias = {};
    for (const r of [...(q.normalized || []), ...(q.redirects || [])]) alias[r.to] = [...(alias[r.to] || []), r.from, ...(alias[r.from] || [])];
    const fileOf = {};
    for (const p of q.pages || []) {
      if (!p.pageimage) continue;
      for (const t of [p.title, ...(alias[p.title] || [])]) fileOf[t] = { file: p.pageimage, article: p.title };
    }
    const files = [...new Set(Object.values(fileOf).map((x) => x.file))];
    const infos = {};
    for (let j = 0; j < files.length; j += 50) {
      const f = await fileInfo(files.slice(j, j + 50), width);
      for (const p of f?.query?.pages || []) infos[p.title.replace(/^File:/, '').replace(/ /g, '_')] = p.imageinfo?.[0];
    }
    for (const t of group) {
      const hit = fileOf[t];
      out[t] = hit ? toImage(hit.file, infos[hit.file.replace(/ /g, '_')], hit.article) : null;
    }
  }
  return out;
}

/** Find the best-matching article for free text, then use its lead image. */
export async function wikiImageForQuery(query) {
  const q = String(query || '').trim().slice(0, 100);
  if (!q) return null;
  const d = await api({ action: 'query', list: 'search', srsearch: q, srlimit: '3', srnamespace: '0' });
  for (const hit of d?.query?.search || []) {
    const img = await wikiLeadImage(hit.title).catch(() => null);
    if (img) return img;
  }
  return null;
}
