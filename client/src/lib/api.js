import { claimProof, sessionKey, rotatedKey, sign } from '../../../shared/sha256.js';
import { seal } from '../../../shared/sealed.js';
import { t } from '../i18n/index.js';
// API client. Works same-origin (web, desktop) or against a configured server
// (mobile builds, or a self-hosted backend) set in Settings.
const KEY = 'bizsim.apiBase';

export function apiBase() {
  let v = '';
  try {
    v = localStorage.getItem(KEY) || '';
  } catch {
    /* storage unavailable */
  }
  return (v || import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
}

export function setApiBase(url) {
  try {
    if (url) localStorage.setItem(KEY, url.trim());
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Pairing with a desktop BIZSIM over Wi-Fi ----------
// See docs/SECURITY.md. The QR holds http://IP:PORT/#pair=CODE.SECRET. The
// secret never crosses the network: the phone proves it has it, receives a
// session id, derives the session key locally and signs every request.

const PAIRING_KEY = 'bizsim.pairing';
const ROTATE_AFTER_MS = 7 * 24 * 3600_000;

try {
  localStorage.removeItem('bizsim.apiToken'); // 1.5 static token, no longer accepted
} catch {
  /* ignore */
}

export function pairing() {
  try {
    const p = JSON.parse(localStorage.getItem(PAIRING_KEY) || 'null');
    return p && typeof p.base === 'string' && typeof p.sessionId === 'string' && typeof p.key === 'string' ? p : null;
  } catch {
    return null;
  }
}
function savePairing(p) {
  try {
    if (p) localStorage.setItem(PAIRING_KEY, JSON.stringify(p));
    else localStorage.removeItem(PAIRING_KEY);
  } catch {
    /* ignore */
  }
}
export const clearPairing = () => savePairing(null);

function randomId(n = 16) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function deviceName() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone or iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  return `${isNativeApp() ? 'BIZSIM app' : 'Browser'} on ${os}`;
}

/** Parse a pairing link. Throws a readable error for anything else. */
export function parsePairLink(text) {
  let u;
  try {
    u = new URL(String(text).trim());
  } catch {
    throw new Error(t('pairing.notCode'));
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(t('pairing.notCode'));
  if (u.searchParams.get('pair')) throw Object.assign(new Error(t('pairing.oldCode')), { code: 'oldCode' });
  const m = /(?:^#|&)pair=([A-Za-z0-9_-]{4,40})\.([A-Za-z0-9_-]{16,80})(?:&|$)/.exec(u.hash);
  if (!m) throw new Error(t('pairing.notCode'));
  return { origin: u.origin, code: m[1], secret: m[2] };
}

/** Pair with a desktop BIZSIM from its QR link. Resolves to the computer's address. */
export async function pairFromUrl(text) {
  const { origin, code, secret } = parsePairLink(text);
  const ts = Date.now();
  const nonce = randomId();
  let res;
  try {
    res = await fetch(`${origin}/api/pair/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, ts, nonce, device: deviceName(), proof: claimProof(secret, code, ts, nonce) }),
    });
  } catch {
    throw new Error(t('pairing.unreachable'));
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok || !data.sessionId) throw new Error(pairingMessage(data) || t('pairing.failed', { status: res.status }));
  savePairing({ base: origin, sessionId: data.sessionId, key: sessionKey(secret, data.sessionId), pairedAt: Date.now(), rotatedAt: Date.now() });
  const sameOrigin = typeof location !== 'undefined' && location.origin === origin;
  setApiBase(sameOrigin ? '' : origin);
  return origin;
}

const effectiveBase = () => apiBase() || (typeof location !== 'undefined' ? location.origin : '');
function activePairing() {
  const p = pairing();
  return p && p.base === effectiveBase() ? p : null;
}

function signedHeaders(p, method, pathAndQuery, body) {
  const ts = Date.now();
  const nonce = randomId();
  return {
    'X-Bizsim-Session': p.sessionId,
    'X-Bizsim-Ts': String(ts),
    'X-Bizsim-Nonce': nonce,
    'X-Bizsim-Sig': sign(p.key, { method, path: pathAndQuery, ts, nonce, body: body || '' }),
  };
}

let rotating = null;
async function maybeRotate(p) {
  if (Date.now() - (p.rotatedAt || p.pairedAt || 0) < ROTATE_AFTER_MS) return p;
  if (!rotating) {
    rotating = (async () => {
      try {
        const path = '/api/pair/rotate';
        const res = await fetch(`${p.base}${path}`, { method: 'POST', headers: signedHeaders(p, 'POST', path, '') });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.sessionId) {
          const next = { ...p, sessionId: d.sessionId, key: rotatedKey(p.key, d.sessionId), rotatedAt: Date.now() };
          savePairing(next);
          return next;
        }
      } catch {
        /* keep the current session; try again later */
      }
      return p;
    })().finally(() => setTimeout(() => (rotating = null), 0));
  }
  return rotating;
}

/** End this device's pairing on the computer too (best effort). */
export async function unpair() {
  const p = activePairing() || pairing();
  if (p) {
    try {
      const path = '/api/pair/session';
      await fetch(`${p.base}${path}`, { method: 'DELETE', headers: signedHeaders(p, 'DELETE', path, '') });
    } catch {
      /* the computer may be off; forget locally anyway */
    }
  }
  clearPairing();
  if (p && apiBase() === p.base) setApiBase('');
}

/** Headers for a request: signature when paired, plus the user's own keys. */
async function authHeaders(method, path, body) {
  let p = activePairing();
  const h = {};
  if (p) {
    p = await maybeRotate(p);
    Object.assign(h, signedHeaders(p, method, path, body));
    const k = deviceKeys();
    if (Object.keys(k).length) h['X-Bizsim-Sealed-Keys'] = seal(p.key, JSON.stringify(k));
  } else Object.assign(h, keyHeaders());
  return h;
}

/** Localised text for a pairing error code from the computer, falling back to its own message. */
function pairingMessage(data) {
  const code = data?.code === 'expired' && /code/i.test(data?.error || '') ? 'codeExpired' : data?.code;
  return code && ['revoked', 'expired', 'unpaired', 'signature', 'clock', 'codeExpired', 'invalid', 'replay'].includes(code) ? t(`pairing.codes.${code}`) : data?.error;
}

function pairingError(res, data) {
  if (res.status === 401 && activePairing() && ['revoked', 'expired', 'unpaired', 'signature'].includes(data?.code)) {
    clearPairing();
    return new Error(pairingMessage(data) || t('pairing.noLongerPaired'));
  }
  return null;
}

// ---------- Device keys: the user's own API keys kept on this device ----------
const DEVICE_KEYS = 'bizsim.deviceKeys';
export function deviceKeys() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEYS) || '{}');
  } catch {
    return {};
  }
}
export function setDeviceKeys(obj) {
  try {
    const clean = Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v));
    if (Object.keys(clean).length) localStorage.setItem(DEVICE_KEYS, JSON.stringify(clean));
    else localStorage.removeItem(DEVICE_KEYS);
  } catch {
    /* ignore */
  }
}
function keyHeaders() {
  const k = deviceKeys();
  if (!Object.keys(k).length) return {};
  return { 'X-BizSim-Keys': btoa(encodeURIComponent(JSON.stringify(k))) };
}

export function assetUrl(path) {
  if (!path) return path;
  // Covers ship inside the app itself, so they never depend on a server.
  if (path.startsWith('/covers/')) return path;
  return /^https?:|^data:/.test(path) ? path : `${apiBase()}${path}`;
}

/** True inside the Android or iPhone app. */
export const isNativeApp = () => Boolean(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());

/** The phone apps have no built-in server: they need a paired computer or a server address. */
export const hasServer = () => Boolean(apiBase()) || !isNativeApp();
export const noServerMessage = () => t('server.none');

async function request(path, opts = {}) {
  if (!hasServer()) throw new Error(noServerMessage());
  const method = (opts.method || 'GET').toUpperCase();
  const body = typeof opts.body === 'string' ? opts.body : '';
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(await authHeaders(method, path, body)), ...(opts.headers || {}) },
    });
  } catch {
    throw new Error(activePairing() ? t('server.unreachableComputer') : t('server.unreachable'));
  }
  // A web host that is not BIZSIM (or the phone's own file server) answers with HTML.
  if (!/json/i.test(res.headers.get('content-type') || '')) {
    throw new Error(res.ok ? t('server.notBizsim') : t('server.requestFailed', { status: res.status }));
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* malformed JSON */
  }
  if (!res.ok) throw pairingError(res, data) || new Error(data?.error || t('server.requestFailed', { status: res.status }));
  if (data == null) throw new Error(t('server.unreadable'));
  return data;
}

export const getStatus = async () => {
  const s = await request('/api/status');
  if (!s || typeof s !== 'object' || !s.ai || !s.version) throw new Error(t('server.notBizsim'));
  return { ...s, images: s.images || {}, ai: { enabled: false, ...s.ai } };
};
export const getKeys = () => request('/api/keys');
export const testKey = (key, baseUrl) => request('/api/keys/test', { method: 'POST', body: JSON.stringify({ key, baseUrl }) });
export const saveServerKeys = (settings) => request('/api/keys', { method: 'POST', body: JSON.stringify({ settings }) });
export const changeServerChain = (op) => request('/api/keys/chain', { method: 'POST', body: JSON.stringify({ op }) });
export const getShare = () => request('/api/share');
export const setShare = (enabled) => request('/api/share', { method: 'POST', body: JSON.stringify({ enabled }) });
export const newShareCode = () => request('/api/share/code', { method: 'POST', body: '{}' });
export const revokeShareDevice = (id) => request('/api/share/revoke', { method: 'POST', body: JSON.stringify(id === 'all' ? { all: true } : { id }) });
export const searchImages = (q, limit = 6) => request(`/api/images/search?q=${encodeURIComponent(q)}&limit=${limit}`);
export const generateImage = (prompt) => request('/api/images/generate', { method: 'POST', body: JSON.stringify({ prompt }) });

/** Start a background job (research or chat builder). Resolves to { id }. */
export const startJobRequest = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body || {}) });

/**
 * Follow a job's events from event number `from`. Calls onEvent({ i, event, data })
 * for each event and onClose(error?) when the stream ends or drops.
 * error.gone is set when the server no longer has the job. Returns a cancel function.
 */
export function streamJobEvents(id, from, { onEvent, onClose }) {
  const ctrl = new AbortController();
  let closed = false;
  const close = (err) => {
    if (closed) return;
    closed = true;
    onClose?.(err);
  };
  (async () => {
    try {
      if (!hasServer()) throw Object.assign(new Error(noServerMessage()), { gone: true });
      const path = `/api/jobs/${encodeURIComponent(id)}/events?from=${from}`;
      const res = await fetch(`${apiBase()}${path}`, { headers: { Accept: 'text/event-stream', ...(await authHeaders('GET', path, '')) }, signal: ctrl.signal });
      if (!res.ok) {
        let msg = t('server.followFailed', { status: res.status });
        let data = null;
        try {
          data = await res.json();
          msg = data.error || msg;
        } catch {
          /* not JSON */
        }
        const pe = pairingError(res, data);
        return close(Object.assign(pe || new Error(msg), { gone: res.status === 404 || Boolean(pe) }));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = 'message';
          let num = null;
          const data = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('id:')) num = Number(line.slice(3).trim());
            else if (line.startsWith('data:')) data.push(line.slice(5).trim());
          }
          if (!data.length || num == null) continue;
          let d = {};
          try {
            d = JSON.parse(data.join('\n'));
          } catch {
            continue;
          }
          onEvent({ i: num, event, data: d });
          if (event === 'end') return close();
        }
      }
      close(new Error(t('server.connectionClosed')));
    } catch (e) {
      if (e.name === 'AbortError') return close();
      close(e.gone ? e : new Error(t('server.lostConnection')));
    }
  })();
  return () => {
    ctrl.abort();
  };
}
