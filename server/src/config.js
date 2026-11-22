import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');

// Load ./.env if present (values already in the environment take precedence).
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] !== '' && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const env = process.env;

// Keys and model settings can come from three places, highest priority first:
//   1. the current request, keys a user keeps on their own device ("device keys")
//   2. settings saved from the in-app Settings screen (settings.json in the data folder)
//   3. environment variables / .env / bizsim.env
export const KEY_NAMES = [
  'LLM_PROVIDER', 'IMAGE_PROVIDER',
  'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_IMAGE_MODEL',
  'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL',
  'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_IMAGE_MODEL',
  'SEC_USER_AGENT',
  'AI_KEYS', // JSON list: the ordered fallback chain of AI keys (see aiChain below)
];
export const requestKeys = new AsyncLocalStorage();
let saved = {};
export const setSavedSettings = (s) => (saved = { ...(s || {}) });
export const getSavedSettings = () => saved;

function get(name) {
  const r = requestKeys.getStore();
  if (r && r[name] !== undefined && r[name] !== '') return r[name];
  if (saved[name] !== undefined && saved[name] !== '') return saved[name];
  return env[name] || '';
}

// ---------- AI key chain ----------
// Every AI key the user adds becomes one entry in an ordered chain. Case writing
// tries the entries in order and, inside each entry, its models in order; if a
// call fails (rate limit, outage, bad JSON), the next one takes over.
// Entry: { id, provider, key, baseUrl?, models: [string], enabled, label? }
const BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  xai: 'https://api.x.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};

export function parseKeyList(text) {
  if (!text) return [];
  try {
    const list = typeof text === 'string' ? JSON.parse(text) : text;
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.key === 'string' && typeof e.provider === 'string')
      .map((e) => ({
        id: String(e.id || `${e.provider}-${e.key.slice(-6)}`),
        provider: e.provider,
        key: e.key.trim(),
        baseUrl: e.baseUrl || BASE_URLS[e.provider] || '',
        models: Array.isArray(e.models) ? e.models.filter((m) => typeof m === 'string' && m).slice(0, 6) : [],
        imageModel: typeof e.imageModel === 'string' ? e.imageModel : '',
        enabled: e.enabled !== false,
        label: typeof e.label === 'string' ? e.label.slice(0, 40) : '',
      }));
  } catch {
    return [];
  }
}

function legacyEntries(read, origin) {
  const out = [];
  const g = read('GEMINI_API_KEY');
  const a = read('ANTHROPIC_API_KEY');
  const o = read('OPENAI_API_KEY');
  const oBase = read('OPENAI_BASE_URL') || BASE_URLS.openai;
  if (a) out.push({ id: `${origin}-anthropic`, provider: 'anthropic', key: a, baseUrl: '', models: [read('ANTHROPIC_MODEL') || 'claude-sonnet-5-5'], enabled: true, origin });
  if (o || /localhost|127\.0\.0\.1/.test(read('OPENAI_BASE_URL'))) {
    const known = Object.entries(BASE_URLS).find(([, u]) => oBase.startsWith(u));
    out.push({ id: `${origin}-openai`, provider: known ? known[0] : 'custom', key: o || 'local', baseUrl: oBase, models: read('OPENAI_MODEL') ? [read('OPENAI_MODEL')] : ['gpt-4o-mini'], imageModel: read('OPENAI_IMAGE_MODEL'), enabled: true, origin });
  }
  if (g) out.push({ id: `${origin}-gemini`, provider: 'gemini', key: g, baseUrl: '', models: read('GEMINI_MODEL') ? [read('GEMINI_MODEL')] : [], imageModel: read('GEMINI_IMAGE_MODEL'), enabled: true, origin });
  const pref = read('LLM_PROVIDER').toLowerCase();
  if (pref) out.sort((x, y) => (y.provider === pref || (pref === 'openai' && y.id.endsWith('-openai'))) - (x.provider === pref || (pref === 'openai' && x.id.endsWith('-openai'))));
  return out;
}

/**
 * The full chain for the current request: this device's keys first (if any),
 * then keys saved on this computer, then keys from the environment file.
 * Duplicate keys are kept once (first position wins).
 */
export function aiChain({ includeDisabled = false } = {}) {
  const r = requestKeys.getStore() || {};
  const fromReq = (n) => (typeof r[n] === 'string' ? r[n] : '');
  const fromSaved = (n) => (saved[n] !== undefined && saved[n] !== null ? String(saved[n]) : '');
  const fromEnv = (n) => env[n] || '';
  const all = [
    ...parseKeyList(fromReq('AI_KEYS')).map((e) => ({ ...e, origin: 'device' })),
    ...legacyEntries(fromReq, 'device'),
    ...parseKeyList(fromSaved('AI_KEYS')).map((e) => ({ ...e, origin: 'settings' })),
    ...legacyEntries(fromSaved, 'settings'),
    ...parseKeyList(fromEnv('AI_KEYS')).map((e) => ({ ...e, origin: 'environment' })),
    ...legacyEntries(fromEnv, 'environment'),
  ];
  const seen = new Set();
  const out = [];
  for (const e of all) {
    if (seen.has(e.key + e.baseUrl)) continue;
    seen.add(e.key + e.baseUrl);
    if (includeDisabled || e.enabled) out.push(e);
  }
  return get('LLM_PROVIDER').toLowerCase() === 'none' && !includeDisabled ? [] : out;
}

function imageEntry() {
  const forced = get('IMAGE_PROVIDER').toLowerCase();
  if (forced === 'none') return null;
  const chain = aiChain();
  const ok = (e) => e.provider === 'gemini' || (e.provider === 'openai' && /api\.openai\.com/.test(e.baseUrl));
  return chain.find((e) => ok(e) && (!forced || e.provider === forced)) || null;
}

/** Parse Express trust proxy setting from TRUST_PROXY env var (defaults safely to "loopback"). */
export function parseTrustProxy(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 'loopback';
  const s = String(raw).trim();
  if (s === 'false' || s === '0') return false;
  if (s === 'true') return true;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

export const DEFAULT_CORS_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'http://127.0.0.1',
  'capacitor://localhost',
  'ionic://localhost',
];

export const config = {
  port: Number(env.PORT || 8787),
  host: env.HOST || '0.0.0.0',
  dataDir: env.BIZSIM_DATA_DIR || path.join(ROOT, 'server', 'data'),
  clientDist: env.BIZSIM_CLIENT_DIST || path.join(ROOT, 'client', 'dist'),
  corsOriginsExplicit: Boolean(env.CORS_ORIGINS && env.CORS_ORIGINS.trim()),
  corsOrigins: env.CORS_ORIGINS
    ? env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_CORS_ORIGINS,
  userAgent: env.BIZSIM_USER_AGENT || 'BIZSIM/1.6 (open-source business research)',
  trustProxy: parseTrustProxy(env.TRUST_PROXY),
  adminToken: env.BIZSIM_ADMIN_TOKEN || '',
  publicAiToken: env.BIZSIM_PUBLIC_AI_TOKEN || '',
};

Object.defineProperties(config, {
  // The SEC requires a descriptive User-Agent with contact details.
  secUserAgent: { enumerable: true, get: () => get('SEC_USER_AGENT') },
  llm: {
    enumerable: true,
    get: () => {
      const chain = aiChain();
      const first = chain[0];
      return { chain, provider: first?.provider || null, model: first ? first.models[0] || 'auto' : null };
    },
  },
  images: {
    enumerable: true,
    get: () => {
      const e = imageEntry();
      return {
        provider: e?.provider || null,
        geminiKey: e?.provider === 'gemini' ? e.key : '',
        openaiKey: e?.provider === 'openai' ? e.key : '',
        geminiModel: (e?.provider === 'gemini' && e.imageModel) || null, // null = auto-pick newest
        openaiModel: (e?.provider === 'openai' && e.imageModel) || 'gpt-image-1',
      };
    },
  },
});

export function llmModel() {
  return config.llm.model;
}
