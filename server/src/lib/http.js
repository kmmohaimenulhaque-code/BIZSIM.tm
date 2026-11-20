import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/** fetch with a timeout, a body-size limit and a descriptive User-Agent. */
export async function fetchText(url, { timeout = 12000, maxBytes = 3_000_000, headers = {}, method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      method,
      body,
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'en', ...headers },
    });
    if (!res.ok) {
      const err = new HttpError(`${new URL(url).hostname} responded ${res.status}`, res.status);
      try {
        err.body = (await res.text()).slice(0, 2000);
      } catch {
        err.body = '';
      }
      throw err;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        ctrl.abort();
        break;
      }
      chunks.push(value);
    }
    return { text: Buffer.concat(chunks).toString('utf8'), url: res.url, headers: res.headers };
  } catch (e) {
    if (e.name === 'AbortError') throw new HttpError(`${new URL(url).hostname} timed out`, 504);
    throw e;
  } finally {
    clearTimeout(timer);
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

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v === '::';
}

/** Guard against server-side request forgery when fetching third-party URLs. */
export async function assertPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError('Invalid URL', 400);
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new HttpError('Only http(s) URLs are allowed', 400);
  const { address } = await dns.lookup(u.hostname);
  if (isPrivateIp(address)) throw new HttpError('Refusing to fetch a private network address', 400);
  return u;
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

/** Per-key fixed-window rate limiter for expensive endpoints. */
export function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || 'local';
    const now = Date.now();
    const e = hits.get(key);
    if (!e || now > e.reset) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return next();
    }
    if (++e.n > max) {
      res.setHeader('Retry-After', Math.ceil((e.reset - now) / 1000));
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
const SECRET_PATTERNS = [/AIza[0-9A-Za-z_-]{20,}/g, /sk-(?:ant-|or-|proj-)?[0-9A-Za-z_-]{16,}/g, /nvapi-[0-9A-Za-z_-]{16,}/g, /gsk_[0-9A-Za-z]{16,}/g, /xai-[0-9A-Za-z]{16,}/g, /Bearer\s+[0-9A-Za-z._-]{12,}/gi, /([?&](?:key|api_key|token)=)[^&\s]+/gi];
export function redactSecrets(text) {
  let s = String(text ?? '');
  for (const re of SECRET_PATTERNS) s = s.replace(re, (m, p1) => (typeof p1 === 'string' && m.startsWith(p1) ? `${p1}[redacted]` : '[redacted]'));
  return s;
}
