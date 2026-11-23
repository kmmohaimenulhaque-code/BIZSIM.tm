// Picks a working Gemini model automatically and retries transient failures.
// Google retires model ids often and the free tier returns 503/429 under load,
// so BIZSIM (1) asks the API which models this key can use, (2) retries
// overloaded/rate-limited calls with backoff, and (3) moves to the next-newest
// model when one is missing (404) or keeps failing.
import crypto from 'node:crypto';
import { fetchJson, HttpError } from '../lib/http.js';

const MAX_KEY_CACHE = 256;
const CACHE_HMAC_KEY = crypto.randomBytes(32);
function cacheKeyId(token) {
  return crypto.createHmac('sha256', CACHE_HMAC_KEY).update(String(token || '')).digest('hex').slice(0, 24);
}
function setBounded(map, k, v) {
  if (map.size >= MAX_KEY_CACHE && !map.has(k)) {
    map.delete(map.keys().next().value);
  }
  map.set(k, v);
}

const listCache = new Map(); // keyed by hashed API key
const preferredByKey = new Map();
const prefFor = (key) => {
  const kid = cacheKeyId(key);
  if (!preferredByKey.has(kid)) setBounded(preferredByKey, kid, {});
  return preferredByKey.get(kid);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listModels(key) {
  const kid = cacheKeyId(key);
  const hit = listCache.get(kid);
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.models;
  const models = [];
  let pageToken = '';
  for (let i = 0; i < 5; i++) {
    const d = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`, {
      headers: { 'x-goog-api-key': key },
    });
    models.push(...(d.models || []));
    if (!d.nextPageToken) break;
    pageToken = d.nextPageToken;
  }
  setBounded(listCache, kid, { at: Date.now(), models });
  return models;
}

const version = (id) => (/gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] || '0').split('.').map(Number);
const byNewest = (a, b) => {
  const [x, y] = [version(a), version(b)];
  return y[0] - x[0] || (y[1] || 0) - (x[1] || 0);
};

/** Ordered candidates: newest stable first, then lite, then previews. kind: 'text' | 'image' */
export async function geminiCandidates(kind, key) {
  const ids = (await listModels(key))
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
  const groups =
    kind === 'image'
      ? [/^gemini-[\d.]+-flash-image$/, /^gemini-[\d.]+-flash-image-preview$/, /^gemini-[\d.]+-pro-image(-preview)?$/]
      : [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-lite$/, /^gemini-[\d.]+-flash(-lite)?-preview$/];
  const out = [];
  for (const g of groups) out.push(...ids.filter((id) => g.test(id)).sort(byNewest));
  return [...new Set(out)];
}

export async function pickGeminiModel(kind, key) {
  const c = await geminiCandidates(kind, key);
  if (!c.length) throw new Error(`No Gemini ${kind} model is available for this API key`);
  return c[0];
}

export function currentGeminiModel(kind, key) {
  return (key && prefFor(key)[kind]) || null;
}

const TRANSIENT = [429, 500, 502, 503, 504];

/** generateContent with retries and automatic model fallback. */
export async function geminiGenerate({ kind, configured, key, body, timeout, maxBytes }) {
  const preferred = prefFor(key);
  const call = (model) =>
    fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      timeout,
      maxBytes,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });

  let order = [configured, preferred[kind]].filter(Boolean);
  let listed = false;
  let lastError;
  for (let i = 0; i < 6; i++) {
    if (!order.length && !listed) {
      order = await geminiCandidates(kind, key);
      listed = true;
    }
    const model = order.shift();
    if (!model) break;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const d = await call(model);
        preferred[kind] = model;
        return d;
      } catch (e) {
        lastError = e;
        if (!(e instanceof HttpError)) throw e;
        if (TRANSIENT.includes(e.status) && attempt < 2) {
          await sleep([2000, 6000][attempt]);
          continue;
        }
        break; // 404/400, or still failing: move to the next model
      }
    }
    if (preferred[kind] === model) delete preferred[kind];
    if (!order.length && !listed) {
      order = (await geminiCandidates(kind, key)).filter((m) => m !== model);
      listed = true;
    }
  }
  const status = lastError?.status;
  throw new Error(
    status === 429
      ? 'Gemini usage limit reached (free tier). Wait a minute and try again.'
      : status === 503
        ? 'Gemini is overloaded right now. Please try again in a minute.'
        : lastError?.message || 'Gemini request failed',
  );
}
