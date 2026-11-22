import { config } from '../config.js';
import {
  isPrivateIp,
  assertPublicUrl as assertPublicUrlSafe,
  fetchSafeText,
  createBoundedRateLimiter,
} from './netSafety.js';

export { isPrivateIp, fetchSafeText, createBoundedRateLimiter };

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** SSRF-hardened HTTP(S) fetch using DNS-pinned, redirect-validating transport. */
export async function fetchText(url, { timeout = 12000, maxBytes = 3_000_000, headers = {}, method = 'GET', body } = {}) {
  let hostLabel = 'host';
  try {
    hostLabel = new URL(url).hostname;
  } catch {
    throw new HttpError('Invalid URL', 400);
  }
  try {
    const res = await fetchSafeText(url, {
      method,
      body,
      timeoutMs: timeout,
      maxBytes,
      headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'en', ...headers },
    });
    if (res.status < 200 || res.status >= 300) {
      const err = new HttpError(`${hostLabel} responded ${res.status}`, res.status);
      err.body = (res.text || '').slice(0, 2000);
      throw err;
    }
    return { text: res.text, url: res.finalUrl, headers: res.headers };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (/timed? ?out/i.test(e?.message || '')) throw new HttpError(`${hostLabel} timed out`, 504);
    if (/Blocked|Invalid URL|Disallowed|credentials|private|numeric IP|Too many redirects/i.test(e?.message || '')) {
      throw new HttpError(e.message, 400);
    }
    throw e;
  }
}

export async function fetchJson(url, opts = {}) {
  const { text } = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers || {}) } });
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(`Invalid JSON from ${new URL(url).hostname}`, 502);
  }
}

/** Guard against server-side request forgery when fetching third-party URLs. */
export async function assertPublicUrl(raw) {
  try {
    const { url } = await assertPublicUrlSafe(raw);
    return url;
  } catch (e) {
    throw new HttpError(e.message || 'Blocked destination URL', 400);
  }
}

/** Minimal robots.txt check for the generic user agent. */
export async function robotsAllows(urlStr) {
  const u = new URL(urlStr);
  try {
    const { text } = await fetchText(`${u.origin}/robots.txt`, { timeout: 6000, maxBytes: 300_000 });
    let applies = false;
    const disallow = [];
    for (const line of text.split(/\r?\n/)) {
      const [k, ...rest] = line.split(':');
      const key = k.trim().toLowerCase();
      const val = rest.join(':').trim();
      if (key === 'user-agent') applies = val === '*' || /bizsim/i.test(val);
      else if (applies && key === 'disallow' && val) disallow.push(val);
    }
    const p = u.pathname || '/';
    return !disallow.some((rule) => p.startsWith(rule));
  } catch {
    return true; // No robots.txt (or unreachable) → allowed by convention.
  }
}

/** Tiny TTL cache. */
export function ttlCache(ttlMs, max = 500) {
  const map = new Map();
  return {
    get(k) {
      const e = map.get(k);
      if (!e) return undefined;
      if (Date.now() > e.exp) {
        map.delete(k);
        return undefined;
      }
      return e.v;
    },
    set(k, v) {
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(k, { v, exp: Date.now() + ttlMs });
      return v;
    },
  };
}

/** Per-key bounded fixed-window rate limiter for expensive endpoints. */
export function rateLimiter({ windowMs, max, maxKeys = 10_000 }) {
  const checkLimit = createBoundedRateLimiter({ windowMs, max, maxKeys });
  return (req, res, next) => {
    const key = req.ip || 'local';
    const r = checkLimit(key);
    if (!r.ok) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    next();
  };
}

export function decodeEntities(s = '') {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Masks anything that looks like a provider credential before it reaches a
// response, an event stream or a log. Defence in depth: errors are written not
// to contain keys in the first place.
const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z_-]{20,}/g,
  /AQ\.[0-9A-Za-z._-]{20,}/g,
  /sk-(?:ant-|or-|proj-)?[0-9A-Za-z_-]{16,}/g,
  /nvapi-[0-9A-Za-z_-]{16,}/g,
  /gsk_[0-9A-Za-z]{16,}/g,
  /xai-[0-9A-Za-z]{16,}/g,
  /Bearer\s+[0-9A-Za-z._-]{12,}/gi,
  /(x-(?:goog-api-key|api-key|bizsim-keys|bizsim-sealed-keys|bizsim-admin|bizsim-public-token)\s*[:=]\s*)[^\s,;]+/gi,
  /([?&](?:key|api_key|token)=)[^&\s]+/gi,
];

export function redactSecrets(text) {
  let s = String(text ?? '');
  for (const re of SECRET_PATTERNS) {
    s = s.replace(re, (m, p1) => (typeof p1 === 'string' && m.startsWith(p1) ? `${p1}[redacted]` : '[redacted]'));
  }
  return s;
}

/** Recursively redact secret patterns inside strings, arrays, and plain objects. */
export function redactSecretsDeep(value, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map((v) => redactSecretsDeep(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactSecretsDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}
