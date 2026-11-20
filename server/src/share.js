// "Use on your phone over Wi-Fi".
//
// The desktop app can open a second listener on the local network so a phone
// can use this computer's research, case building and AI keys. Security model
// (documented in docs/SECURITY.md):
//
// * Pairing QR: http://IP:PORT/#pair=CODE.SECRET. The part after # is never
//   sent over the network by browsers, so SECRET only travels through the QR
//   image (out of band).
// * CODE is single use, expires after five minutes and rotates after every
//   successful pairing.
// * The phone proves it holds SECRET with an HMAC (the secret itself is never
//   transmitted) and receives a session id. Both sides derive the session key
//   from SECRET and the id.
// * Every API request is signed: HMAC(key, method, path, timestamp, nonce,
//   SHA-256(body)). Timestamps outside two minutes and repeated nonces are
//   rejected, so captured requests cannot be replayed or altered.
// * Sessions expire after 30 idle days, can be rotated by the phone, ended by
//   the phone, or revoked from the computer. Failed attempts are rate limited.
// * Only private-network addresses may connect.
// * AI keys a phone sends are encrypted with a key derived from the session
//   (see shared/sealed.js); plain key headers are refused on this listener.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { claimProof, sessionKey, rotatedKey, sign, safeEqual } from '../../shared/sha256.js';

export const PAIR_CODE_TTL_MS = 5 * 60_000;
export const SESSION_IDLE_MS = 30 * 24 * 3600_000;
export const CLOCK_SKEW_MS = 120_000;
const MAX_BODY = 300_000;

let lan = null;
let store = null; // { file, sessions: Map }
let pending = null; // { code, secret, expiresAt }
const nonces = new Map(); // `${session}|${nonce}` -> expiry
const failures = new Map(); // ip -> { n, until }
const claims = new Map(); // ip -> { n, reset }

const b64 = (n) => crypto.randomBytes(n).toString('base64url');

// ---------- addresses ----------
export function isPrivateAddress(ip) {
  let a = String(ip || '').toLowerCase();
  if (a.startsWith('::ffff:')) a = a.slice(7);
  if (a === '::1' || a.startsWith('127.')) return true;
  if (/^10\./.test(a) || /^192\.168\./.test(a) || /^169\.254\./.test(a)) return true;
  const m = /^172\.(\d+)\./.exec(a);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(a)) return true; // carrier-grade NAT, some hotspots
  if (/^f[cd][0-9a-f]{2}:/.test(a) || /^fe[89ab][0-9a-f]:/.test(a)) return true; // unique-local, link-local IPv6
  return false;
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.') && isPrivateAddress(a.address)) out.push(a.address);
    }
  }
  const rank = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3);
  // Extra addresses to offer (for example a VPN or a test machine), private ones only.
  for (const h of String(process.env.BIZSIM_PAIR_HOSTS || '').split(',').map((x) => x.trim())) if (h && isPrivateAddress(h) && !out.includes(h)) out.push(h);
  return out.sort((a, b) => rank(a) - rank(b));
}

// ---------- persisted sessions ----------
export function initPairingStore(dataDir) {
  const file = path.join(dataDir, 'pairing.json');
  const sessions = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const s of raw.sessions || []) {
      if (typeof s.id === 'string' && typeof s.key === 'string' && Date.now() - (s.lastSeen || 0) < SESSION_IDLE_MS) sessions.set(s.id, s);
    }
  } catch {
    /* first run or unreadable: start empty */
  }
  store = { file, sessions };
  return store;
}

function persist() {
  if (!store) return;
  try {
    fs.mkdirSync(path.dirname(store.file), { recursive: true });
    const tmp = `${store.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, sessions: [...store.sessions.values()] }), { mode: 0o600 });
    fs.renameSync(tmp, store.file);
  } catch {
    /* sessions still work for this run */
  }
}

const publicSession = (s) => ({ id: s.id.slice(0, 6), fullId: s.id, device: s.device, createdAt: s.createdAt, lastSeen: s.lastSeen, ip: s.ip });

export function listDevices() {
  if (!store) return [];
  return [...store.sessions.values()].filter((s) => !s.retireAt).map(publicSession).sort((a, b) => b.lastSeen - a.lastSeen);
}

export function revokeDevice(id) {
  if (!store) return false;
  const ok = store.sessions.delete(id);
  if (ok) persist();
  return ok;
}
export function revokeAll() {
  if (!store) return;
  store.sessions.clear();
  persist();
}

// ---------- pairing codes ----------
export function newPairingCode() {
  pending = { code: b64(6), secret: b64(24), expiresAt: Date.now() + PAIR_CODE_TTL_MS };
  return pending;
}
function currentCode() {
  if (!pending || pending.expiresAt <= Date.now()) newPairingCode();
  return pending;
}

export function shareState() {
  if (!lan) return { enabled: false, devices: listDevices() };
  const p = currentCode();
  return {
    enabled: true,
    port: lan.port,
    expiresAt: p.expiresAt,
    urls: lanAddresses().map((ip) => `http://${ip}:${lan.port}/#pair=${p.code}.${p.secret}`),
    devices: listDevices(),
  };
}

// ---------- rate limiting ----------
function tooManyFailures(ip) {
  const f = failures.get(ip);
  return Boolean(f && f.until > Date.now() && f.n >= 20);
}
function noteFailure(ip) {
  const now = Date.now();
  const f = failures.get(ip);
  if (!f || f.until <= now) failures.set(ip, { n: 1, until: now + 5 * 60_000 });
  else f.n += 1;
}
function claimAllowed(ip) {
  const now = Date.now();
  const c = claims.get(ip);
  if (!c || c.reset <= now) {
    claims.set(ip, { n: 1, reset: now + 60_000 });
    return true;
  }
  c.n += 1;
  return c.n <= 10;
}
function seenNonce(sessionId, nonce) {
  const now = Date.now();
  if (nonces.size > 20000) for (const [k, exp] of nonces) if (exp <= now) nonces.delete(k);
  const k = `${sessionId}|${nonce}`;
  if (nonces.has(k) && nonces.get(k) > now) return true;
  nonces.set(k, now + 2 * CLOCK_SKEW_MS);
  return false;
}

// ---------- protocol (pure functions, unit tested) ----------
/** Handle a claim. Returns { status, body }. */
export function claim(input, ip = '') {
  const { code, ts, nonce, proof } = input || {};
  const device = String(input?.device || 'Phone').replace(/[^\p{L}\p{N} ._()-]/gu, '').slice(0, 60) || 'Phone';
  if (![code, nonce, proof].every((v) => typeof v === 'string' && v.length > 0 && v.length < 200) || !Number.isFinite(ts)) return { status: 400, body: { error: 'Malformed pairing request.' } };
  if (Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) return { status: 400, body: { error: 'The clocks on this phone and the computer differ by more than two minutes. Fix the time and try again.', code: 'clock' } };
  const p = pending;
  if (!p || p.expiresAt <= Date.now() || !safeEqual(code, p.code)) return { status: 410, body: { error: 'This pairing code has expired or was already used. Show a new code on the computer and scan it again.', code: 'expired' } };
  if (!safeEqual(proof, claimProof(p.secret, code, ts, nonce))) return { status: 401, body: { error: 'This pairing code is not valid.', code: 'invalid' } };
  if (seenNonce('claim', nonce)) return { status: 401, body: { error: 'Repeated pairing request refused.', code: 'replay' } };
  const id = b64(16);
  const now = Date.now();
  const s = { id, key: sessionKey(p.secret, id), device, createdAt: now, lastSeen: now, ip };
  if (!store) initPairingStore(os.tmpdir());
  store.sessions.set(id, s);
  persist();
  newPairingCode(); // single use
  return { status: 200, body: { sessionId: id, idleDays: SESSION_IDLE_MS / 86400_000 } };
}

/** Verify a signed request. Returns { ok, session } or { ok:false, status, error, code }. */
export function verifyRequest({ method, path: p, headers, body }) {
  const sid = headers['x-bizsim-session'];
  const ts = Number(headers['x-bizsim-ts']);
  const nonce = headers['x-bizsim-nonce'];
  const sig = headers['x-bizsim-sig'];
  if (!sid || !nonce || !sig || !Number.isFinite(ts)) return { ok: false, status: 401, code: 'unpaired', error: 'This device is not paired with the computer. Scan a pairing code in Settings.' };
  const s = store?.sessions.get(String(sid));
  if (s?.retireAt && s.retireAt <= Date.now()) revokeDevice(s.id);
  if (!s || (s.retireAt && s.retireAt <= Date.now())) return { ok: false, status: 401, code: 'revoked', error: 'This device is no longer paired (it was removed on the computer or the pairing expired). Pair again.' };
  if (Date.now() - s.lastSeen > SESSION_IDLE_MS) {
    revokeDevice(s.id);
    return { ok: false, status: 401, code: 'expired', error: 'The pairing expired after 30 days without use. Pair again.' };
  }
  if (Math.abs(Date.now() - ts) > CLOCK_SKEW_MS) return { ok: false, status: 401, code: 'clock', error: 'The phone clock differs from the computer by more than two minutes.' };
  if (String(nonce).length > 64) return { ok: false, status: 400, code: 'bad', error: 'Malformed request.' };
  const expect = sign(s.key, { method, path: p, ts, nonce, body });
  if (!safeEqual(sig, expect)) return { ok: false, status: 401, code: 'signature', error: 'Request signature is not valid.' };
  if (seenNonce(s.id, nonce)) return { ok: false, status: 401, code: 'replay', error: 'Repeated request refused.' };
  const now = Date.now();
  if (now - s.lastSeen > 60_000) {
    s.lastSeen = now;
    persist();
  }
  return { ok: true, session: s };
}

export function rotateSession(session) {
  const id = b64(16);
  const next = { ...session, id, key: rotatedKey(session.key, id), lastSeen: Date.now(), rotatedAt: Date.now() };
  delete next.retireAt;
  // Requests already in flight with the old session stay valid for two minutes.
  session.retireAt = Date.now() + CLOCK_SKEW_MS;
  store.sessions.set(id, next);
  persist();
  return next;
}

// ---------- listener ----------
const LAN_ORIGINS = new Set(['http://localhost', 'https://localhost', 'capacitor://localhost', 'ionic://localhost']);

function send(res, status, body, origin) {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (origin) h['Access-Control-Allow-Origin'] = origin;
  res.writeHead(status, h);
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function lanHandler(app, { port: getPort = () => lan?.port } = {}) {
  return async (req, res) => {
    const ip = req.socket.remoteAddress || '';
    if (!isPrivateAddress(ip)) {
      res.writeHead(403);
      return res.end();
    }
    const u = new URL(req.url, 'http://lan');
    const origin = req.headers.origin;
    const selfOrigin = req.headers.host ? `http://${req.headers.host}` : '';
    const allowedOrigin = origin && (LAN_ORIGINS.has(origin) || origin === selfOrigin) ? origin : null;
    req.viaLan = true;
    req.lanOrigin = allowedOrigin;
    void getPort;

    if (!u.pathname.startsWith('/api/')) return app(req, res);
    if (origin && !allowedOrigin) return send(res, 403, { error: 'Origin not allowed' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': allowedOrigin || '',
        'Access-Control-Allow-Headers': 'Content-Type, X-Bizsim-Session, X-Bizsim-Ts, X-Bizsim-Nonce, X-Bizsim-Sig, X-Bizsim-Sealed-Keys',
        'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
        'Access-Control-Max-Age': '600',
      });
      return res.end();
    }
    if (tooManyFailures(ip)) return send(res, 429, { error: 'Too many failed attempts. Wait five minutes and pair again.' }, allowedOrigin);

    let raw;
    try {
      raw = await readBody(req);
    } catch (e) {
      return send(res, e.status || 400, { error: e.status === 413 ? 'Request too large' : 'Could not read the request' }, allowedOrigin);
    }
    let parsed;
    if (raw.length) {
      try {
        parsed = JSON.parse(raw.toString('utf8'));
      } catch {
        return send(res, 400, { error: 'Malformed JSON' }, allowedOrigin);
      }
    }

    if (u.pathname === '/api/pair/hello' && req.method === 'GET') return send(res, 200, { name: 'BIZSIM', pairing: 1 }, allowedOrigin);
    if (u.pathname === '/api/pair/claim' && req.method === 'POST') {
      if (!claimAllowed(ip)) return send(res, 429, { error: 'Too many pairing attempts. Wait a minute.' }, allowedOrigin);
      const r = claim(parsed, ip);
      if (r.status !== 200) noteFailure(ip);
      return send(res, r.status, r.body, allowedOrigin);
    }

    if (req.headers['x-bizsim-keys']) return send(res, 400, { error: 'Plain key headers are refused over Wi-Fi. Update the BIZSIM app on this device.' }, allowedOrigin);
    const v = verifyRequest({ method: req.method, path: u.pathname + u.search, headers: req.headers, body: raw.toString('utf8') });
    if (!v.ok) {
      noteFailure(ip);
      return send(res, v.status, { error: v.error, code: v.code }, allowedOrigin);
    }
    if (u.pathname === '/api/pair/rotate' && req.method === 'POST') {
      const n = rotateSession(v.session);
      return send(res, 200, { sessionId: n.id }, allowedOrigin);
    }
    if (u.pathname === '/api/pair/session' && req.method === 'DELETE') {
      revokeDevice(v.session.id);
      return send(res, 200, { ok: true }, allowedOrigin);
    }
    req.pairSession = v.session;
    // Hand the already-read body to Express; body-parser skips requests with _body set.
    req.body = parsed ?? {};
    req._body = true;
    app(req, res);
  };
}

export async function enableShare(app, dataDir) {
  if (lan) return shareState();
  if (!store) initPairingStore(dataDir || os.tmpdir());
  newPairingCode();
  const server = http.createServer(lanHandler(app));
  server.headersTimeout = 20_000;
  server.requestTimeout = 0; // job event streams stay open
  let port = null;
  for (const p of [47830, 47831, 47832, 0]) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(p, '0.0.0.0', resolve);
      });
      port = server.address().port;
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  lan = { server, port };
  return shareState();
}

export async function disableShare() {
  if (!lan) return shareState();
  const { server } = lan;
  lan = null;
  pending = null;
  await new Promise((r) => {
    server.close(() => r());
    server.closeAllConnections?.();
  });
  return shareState();
}

export const _test = {
  reset() {
    pending = null;
    nonces.clear();
    failures.clear();
    claims.clear();
  },
  pending: () => pending,
  store: () => store,
};
