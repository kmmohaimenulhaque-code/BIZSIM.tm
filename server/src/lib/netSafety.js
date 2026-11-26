// bizsim/server/src/lib/netSafety.js
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';

const MAX_REDIRECTS = 5;

function ipv4ToInt(ip) {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr4(ipInt, baseStr, prefixLen) {
  const base = ipv4ToInt(baseStr);
  if (base === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (base & mask);
}

const BLOCKED_V4_CIDRS = [
  ['0.0.0.0', 8],       // "This" network
  ['10.0.0.0', 8],      // RFC1918 private
  ['100.64.0.0', 10],   // CGNAT (RFC6598)
  ['127.0.0.0', 8],     // Loopback
  ['169.254.0.0', 16],  // Link-local / Cloud metadata (AWS/GCP/Azure)
  ['172.16.0.0', 12],   // RFC1918 private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.0.2.0', 24],    // TEST-NET-1
  ['192.168.0.0', 16],  // RFC1918 private
  ['198.18.0.0', 15],   // Benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24],  // TEST-NET-3
  ['224.0.0.0', 4],     // Multicast
  ['240.0.0.0', 4],     // Reserved / Broadcast
];

/**
 * Returns true if an IPv4 or IPv6 address is private, loopback, link-local,
 * metadata, CGNAT, multicast, reserved, or unparseable.
 */
export function isPrivateIp(rawIp) {
  if (!rawIp || typeof rawIp !== 'string') return true;
  let ip = rawIp.trim().toLowerCase();

  // Strip IPv6 zone identifier (e.g. fe80::1%eth0)
  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) ip = ip.slice(0, zoneIdx);

  // Unwrap IPv4-mapped IPv6 addresses (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (ip.startsWith('::ffff:')) {
    const tail = ip.slice(7);
    if (net.isIPv4(tail)) {
      ip = tail;
    } else {
      const hexParts = tail.split(':');
      if (hexParts.length === 2) {
        const hi = parseInt(hexParts[0], 16);
        const lo = parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          ip = `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
        }
      }
    }
  }

  if (net.isIPv4(ip)) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return true;
    return BLOCKED_V4_CIDRS.some(([base, prefix]) => inCidr4(ipInt, base, prefix));
  }

  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    // Expand first hextet to test prefix blocks reliably
    const first = ip.split(':')[0] || '0';
    const val = parseInt(first, 16);
    if (Number.isNaN(val)) return true;
    // fc00::/7 (Unique Local Address)
    if ((val & 0xfe00) === 0xfc00) return true;
    // fe80::/10 (Link-local)
    if ((val & 0xffc0) === 0xfe80) return true;
    // ff00::/8 (Multicast)
    if ((val & 0xff00) === 0xff00) return true;
    // 2001:db8::/32 (Documentation)
    if (ip.startsWith('2001:db8:') || ip.startsWith('2001:0db8:')) return true;
    // 64:ff9b::/96 (NAT64)
    if (ip.startsWith('64:ff9b:')) return true;
    return false;
  }

  // Anything unrecognized is blocked fail-closed
  return true;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

/**
 * Validates URL syntax, scheme, hostname, and ALL DNS A/AAAA records.
 * Returns { url: URL, addresses: Array<{ address: string, family: number }> }.
 */
export async function assertPublicUrl(rawUrl, { allowHttp = true } = {}) {
  let u;
  try {
    u = new URL(String(rawUrl));
  } catch {
    throw new Error('Invalid URL');
  }

  const allowedProtocols = allowHttp ? ['https:', 'http:'] : ['https:'];
  if (!allowedProtocols.includes(u.protocol)) {
    throw new Error(`Disallowed URL scheme: ${u.protocol}`);
  }
  if (u.username || u.password) {
    throw new Error('URLs containing embedded credentials are not allowed');
  }

  const hostname = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error(`Blocked destination host: ${hostname}`);
  }

  // Reject non-canonical IP encodings (pure decimal, hex, octal)
  if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    throw new Error('Non-standard numeric IP literals are not allowed');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`Blocked private/prohibited IP address: ${hostname}`);
    }
    return { url: u, addresses: [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }] };
  }

  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error(`Unable to resolve host: ${hostname}`);
  }
  for (const rec of records) {
    if (isPrivateIp(rec.address)) {
      throw new Error(`Blocked host resolving to private/prohibited IP: ${hostname}`);
    }
  }

  return { url: u, addresses: records };
}

/**
 * Safe HTTP(S) request helper that:
 * 1. Validates initial URL & every 3xx redirect target via assertPublicUrl()
 * 2. Pins the validated IP into the socket lookup to block DNS rebinding
 * 3. Enforces timeout and maximum response byte cap
 */
/**
 * Creates a Node 18/20/22+-compatible custom dns.lookup function pinned to
 * pre-validated public IP addresses. Handles both single-address callbacks
 * and `{ all: true }` (used by Node 20+ Happy Eyeballs autoSelectFamily).
 */
export function createPinnedLookup(addresses) {
  const ordered = [
    ...addresses.filter((a) => a.family === 4),
    ...addresses.filter((a) => a.family !== 4),
  ];
  const primary = ordered[0];
  return function pinnedLookup(_host, lookupOpts, cb) {
    if (typeof lookupOpts === 'function') {
      return lookupOpts(null, primary.address, primary.family);
    }
    if (lookupOpts && lookupOpts.all) {
      return cb(
        null,
        ordered.map((a) => ({ address: a.address, family: a.family }))
      );
    }
    return cb(null, primary.address, primary.family);
  };
}

export async function fetchSafeText(rawUrl, opts = {}) {
  const {
    method = 'GET',
    headers = {},
    body = undefined,
    timeoutMs = 15000,
    maxBytes = 2 * 1024 * 1024,
    allowHttp = true,
  } = opts;

  const payload =
    body === undefined
      ? undefined
      : typeof body === 'string' || Buffer.isBuffer(body)
        ? body
        : JSON.stringify(body);

  const reqHeaders = { ...headers };
  if (!Object.keys(reqHeaders).some((k) => k.toLowerCase() === 'user-agent')) {
    reqHeaders['User-Agent'] = 'BIZSIM/1.7 (https://github.com/kmmohaimenulhaque-code/BIZSIM.tm; open-source business research)';
  }
  if (!Object.keys(reqHeaders).some((k) => k.toLowerCase() === 'accept-encoding')) {
    reqHeaders['Accept-Encoding'] = 'gzip, deflate, br';
  }
  if (payload !== undefined && !Object.keys(reqHeaders).some((k) => k.toLowerCase() === 'content-length')) {
    reqHeaders['Content-Length'] = String(Buffer.byteLength(payload));
  }

  let currentUrl = rawUrl;
  let currentMethod = method;
  let currentPayload = payload;
  let currentHeaders = { ...reqHeaders };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { url, addresses } = await assertPublicUrl(currentUrl, { allowHttp });
    const mod = url.protocol === 'https:' ? https : http;
    const lookup = createPinnedLookup(addresses);

    const result = await new Promise((resolve, reject) => {
      let settled = false;
      const done = (fn, val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };

      const req = mod.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: currentMethod,
          headers: currentHeaders,
          servername: url.protocol === 'https:' ? url.hostname : undefined,
          lookup,
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode || 0;
          const location = res.headers.location;

          if (status >= 300 && status < 400 && location) {
            res.resume();
            done(resolve, { redirect: new URL(location, url).toString(), status });
            return;
          }

          const enc = String(res.headers['content-encoding'] || '').toLowerCase().trim();
          let stream = res;
          if (enc === 'gzip' || enc === 'x-gzip') stream = res.pipe(zlib.createGunzip());
          else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
          else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());

          const chunks = [];
          let total = 0;
          stream.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
              const err = new Error(`Response exceeded maximum size (${maxBytes} bytes)`);
              stream.destroy();
              req.destroy(err);
              done(reject, err);
              return;
            }
            chunks.push(chunk);
          });
          stream.on('error', (err) => {
            req.destroy();
            done(reject, err);
          });
          stream.on('end', () => {
            done(resolve, {
              status,
              headers: res.headers,
              text: Buffer.concat(chunks).toString('utf8'),
              finalUrl: url.toString(),
            });
          });
        }
      );

      req.on('timeout', () => {
        const err = new Error('Request timed out');
        req.destroy(err);
        done(reject, err);
      });
      req.on('error', (err) => done(reject, err));
      if (currentPayload !== undefined) {
        req.write(currentPayload);
      }
      req.end();
    });

    if (result.redirect) {
      if (hop === MAX_REDIRECTS) {
        throw new Error('Too many redirects');
      }
      // On 301/302/303 (or 302 POST), switch to GET and drop request body/auth if cross-origin
      const prevOrigin = url.origin;
      const nextOrigin = new URL(result.redirect).origin;
      if (result.status === 303 || ((result.status === 301 || result.status === 302) && currentMethod !== 'GET' && currentMethod !== 'HEAD')) {
        currentMethod = 'GET';
        currentPayload = undefined;
        for (const k of Object.keys(currentHeaders)) {
          if (k.toLowerCase() === 'content-length' || k.toLowerCase() === 'content-type') delete currentHeaders[k];
        }
      }
      if (prevOrigin !== nextOrigin) {
        for (const k of Object.keys(currentHeaders)) {
          if (/^(authorization|cookie|x-api-key|x-goog-api-key)$/i.test(k)) delete currentHeaders[k];
        }
      }
      currentUrl = result.redirect;
      continue;
    }

    return result;
  }

  throw new Error('Request failed');
}

/**
 * Bounded in-memory rate limiter with automatic stale-entry cleanup.
 */
export function createBoundedRateLimiter({ windowMs = 60_000, max = 30, maxKeys = 10_000 } = {}) {
  const hits = new Map();
  let lastPrune = Date.now();

  function prune(now) {
    if (now - lastPrune < windowMs && hits.size < maxKeys) return;
    lastPrune = now;
    for (const [k, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(k);
    }
    while (hits.size > maxKeys) {
      const oldestKey = hits.keys().next().value;
      hits.delete(oldestKey);
    }
  }

  return function checkLimit(key) {
    const now = Date.now();
    prune(now);
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: max - 1, resetAt: now + windowMs };
    }
    cur.count += 1;
    if (cur.count > max) {
      return { ok: false, remaining: 0, resetAt: cur.resetAt };
    }
    return { ok: true, remaining: max - cur.count, resetAt: cur.resetAt };
  };
}

/**
 * Bounded per-key concurrency limiter for long-lived SSE/event streams.
 * Returns { ok: true, active, release } or { ok: false, active }.
 */
export function createConcurrencyLimiter({ maxPerKey = 3, maxKeys = 5_000 } = {}) {
  const activeMap = new Map();

  return function acquire(key) {
    const k = String(key || 'local');
    const cur = activeMap.get(k) || 0;
    if (cur >= maxPerKey) {
      return { ok: false, active: cur };
    }
    // Never evict an active entry (every entry in activeMap has count > 0).
    // Fail closed when the bounded table is saturated so IP churn cannot bypass limits.
    if (!activeMap.has(k) && activeMap.size >= maxKeys) {
      return { ok: false, active: 0, saturated: true };
    }
    activeMap.set(k, cur + 1);
    let released = false;
    return {
      ok: true,
      active: cur + 1,
      release() {
        if (released) return;
        released = true;
        const now = (activeMap.get(k) || 1) - 1;
        if (now <= 0) activeMap.delete(k);
        else activeMap.set(k, now);
      },
    };
  };
}

/**
 * Optional public-web AI gate: when configuredToken is empty/unset, always allows
 * (preserving desktop/local workflows). When set, requires a timing-safe match
 * via X-BizSim-Public-Token or Authorization: Bearer <token>.
 */
export function checkPublicAiToken(headers = {}, configuredToken = '') {
  const expected = String(configuredToken || '').trim();
  if (!expected) return { ok: true, required: false };

  const h = headers || {};
  const direct = typeof h['x-bizsim-public-token'] === 'string' ? h['x-bizsim-public-token'].trim() : '';
  const auth = typeof h.authorization === 'string' ? h.authorization.trim() : '';
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() || '';
  const supplied = direct || bearer;
  if (!supplied) return { ok: false, required: true };

  const a = Buffer.from(supplied, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return { ok: false, required: true };
  return { ok: crypto.timingSafeEqual(a, b), required: true };
}
