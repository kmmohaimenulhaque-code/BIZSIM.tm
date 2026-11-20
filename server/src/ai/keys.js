// "Bring your own API key": recognise the provider from the key itself, verify
// it, and choose the best available model automatically.
import fs from 'node:fs/promises';
import path from 'node:path';
import { config, KEY_NAMES, setSavedSettings, getSavedSettings, aiChain, parseKeyList } from '../config.js';
import { fetchJson, HttpError } from '../lib/http.js';
import { geminiCandidates } from './geminiModels.js';
import { applyChainOp } from '../../../shared/keychain.js';

export const PROVIDERS = {
  gemini: { name: 'Google Gemini', free: true, signup: 'https://aistudio.google.com/apikey' },
  anthropic: { name: 'Anthropic Claude', signup: 'https://console.anthropic.com/settings/keys' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', signup: 'https://platform.openai.com/api-keys' },
  nvidia: { name: 'NVIDIA NIM', free: true, baseUrl: 'https://integrate.api.nvidia.com/v1', signup: 'https://build.nvidia.com/settings/api-keys' },
  groq: { name: 'Groq', free: true, baseUrl: 'https://api.groq.com/openai/v1', signup: 'https://console.groq.com/keys' },
  xai: { name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', signup: 'https://console.x.ai' },
  openrouter: { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', signup: 'https://openrouter.ai/keys' },
  custom: { name: 'OpenAI-compatible endpoint' },
};

/** Guess the provider from the key format (or a custom endpoint). */
export function detectProvider(key, baseUrl) {
  const k = String(key || '').trim();
  if (baseUrl) {
    const known = Object.entries(PROVIDERS).find(([, p]) => p.baseUrl && baseUrl.startsWith(p.baseUrl));
    return known ? known[0] : 'custom';
  }
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(k)) return 'gemini';
  if (/^sk-ant-/.test(k)) return 'anthropic';
  if (/^nvapi-/.test(k)) return 'nvidia';
  if (/^sk-or-/.test(k)) return 'openrouter';
  if (/^gsk_/.test(k)) return 'groq';
  if (/^xai-/.test(k)) return 'xai';
  if (/^sk-/.test(k)) return 'openai';
  return null;
}

const newestFirst = (a, b) => (b.created || 0) - (a.created || 0) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true });

async function listOpenAiModels(baseUrl, key) {
  const d = await fetchJson(`${baseUrl.replace(/\/$/, '')}/models`, { headers: key ? { Authorization: `Bearer ${key}` } : {}, maxBytes: 20_000_000 });
  return (d.data || d.models || []).map((m) => ({ id: m.id || m.name, created: m.created || 0 }));
}

// Models that cannot write a case (embeddings, speech, safety filters, vision-only, code-only...).
const NOT_CHAT = /whisper|tts|embed|moderation|dall-e|image|audio|transcri|realtime|rerank|guard|safety|retriev|clip|detector|translate|starcoder|cosmos|ising|parse|ocr|search|vision-preview|babbage|davinci|-vl\b|-vlm|reward/i;

// NVIDIA NIM (free endpoint at build.nvidia.com): fast, capable models first,
// bigger or slower ones as fallbacks, a small model as the last resort.
// The live catalogue changes often, so these are patterns, matched against
// what the key can actually see.
export const NVIDIA_PREFS = [
  /gpt-oss-120b/,
  /glm-[\d.]+-flash/,
  /minimax-m[\d.]+-flash/,
  /llama-3\.3-70b-instruct/,
  /nemotron-[\d.]+-lightning/,
  /qwen3[\w.-]*-instruct/,
  /gemma-4-\d+b-it/,
  /deepseek-v3/,
  /kimi-k2[\w.-]*instruct/,
  /mistral-large/,
  /nemotron-[\d.]+-super/,
  /gpt-oss-20b/,
  /nemotron-[\d.]+-ultra/,
  /gemma-3-12b-it/,
  /llama-3\.1-8b-instruct/,
];

/** Choose up to `limit` models for this provider, best first. */
export function pickModels(provider, models, limit = 4) {
  const ids = models
    .slice()
    .sort(newestFirst)
    .map((m) => m.id)
    .filter((id) => id && !NOT_CHAT.test(id));
  const out = [];
  const add = (id) => id && !out.includes(id) && out.push(id);
  const first = (re) => ids.find((id) => re.test(id));
  switch (provider) {
    case 'openai':
      add(first(/^gpt-[\d.]+-mini$/) || first(/^gpt-[\d.]+o?-mini$/));
      add(first(/^gpt-[\d.]+$/));
      add(first(/^gpt-[\d.]+o$/) || first(/^gpt-/));
      break;
    case 'openrouter':
      add('openrouter/auto');
      add(first(/:free$/));
      break;
    case 'groq':
      add(first(/gpt-oss-120b/));
      add(first(/llama-3\.3-70b/));
      add(first(/kimi|qwen3|70b|120b/));
      add(first(/gpt-oss-20b|8b-instant/));
      break;
    case 'xai':
      add(first(/^grok-[\d.]+-mini/) || first(/^grok-[\d.]+-fast/));
      add(first(/^grok-[\d.]+$/));
      add(first(/^grok/));
      break;
    case 'nvidia':
      for (const re of NVIDIA_PREFS) add(first(re));
      add(first(/instruct|-it$|chat/));
      break;
    default:
      add(first(/120b|70b|72b|large|versatile/i));
      add(first(/gpt|llama|qwen|mistral|gemma|deepseek|grok|claude|glm|nemotron/i));
      add(ids[0]);
  }
  return out.slice(0, limit);
}

const friendly = (e, provider) => {
  if (e instanceof HttpError && [400, 401, 403].includes(e.status)) return `${PROVIDERS[provider]?.name || 'The provider'} rejected this key. Check that it is copied completely and is active.`;
  if (e instanceof HttpError && e.status === 429) return 'The key works but is rate-limited right now. Try again in a minute.';
  return e.message;
};

/** Send a tiny request to check that a model really answers with this key. */
async function probe(baseUrl, key, model) {
  try {
    await fetchJson(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      timeout: 25000,
      headers: { 'Content-Type': 'application/json', ...(key && key !== 'local' ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK' }] }),
    });
    return { model, ok: true };
  } catch (e) {
    // Rate limits and slow starts mean the model exists: keep it as a fallback.
    if (e instanceof HttpError && [429, 500, 502, 503, 504].includes(e.status)) return { model, ok: true, note: 'busy' };
    if (e instanceof HttpError && [401, 403].includes(e.status)) return { model, ok: false, auth: true };
    return { model, ok: false };
  }
}

/**
 * Verify a key and work out its configuration.
 * Returns { provider, name, entry, textModel, models, imageModel }.
 * `entry` is what gets stored in the AI key chain.
 */
export async function testKey({ key, baseUrl }) {
  const k = String(key || '').trim();
  const base = String(baseUrl || '').trim().replace(/\/$/, '');
  const provider = detectProvider(k, base);
  if (!provider) throw new Error('Could not recognise this key. Supported: Google Gemini (AIza...), Anthropic (sk-ant-...), OpenAI (sk-...), NVIDIA NIM (nvapi-...), Groq (gsk_...), xAI (xai-...), OpenRouter (sk-or-...), or any OpenAI-compatible endpoint (set the endpoint URL).');
  const id = `${provider}-${Date.now().toString(36)}`;
  try {
    if (provider === 'gemini') {
      const text = await geminiCandidates('text', k);
      if (!text.length) throw new Error('This Gemini key has no text models available.');
      const image = await geminiCandidates('image', k).catch(() => []);
      return {
        provider,
        name: PROVIDERS.gemini.name,
        textModel: text[0],
        models: text.slice(0, 4),
        imageModel: image[0] || null,
        // models: [] means "pick the newest Flash automatically", with Gemini's own fallbacks.
        entry: { id, provider, key: k, baseUrl: '', models: [], imageModel: '', enabled: true },
      };
    }
    if (provider === 'anthropic') {
      const d = await fetchJson('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } });
      const ids = (d.data || []).map((m) => ({ id: m.id, created: Date.parse(m.created_at) || 0 })).sort(newestFirst).map((m) => m.id);
      const models = [ids.find((x) => /sonnet/.test(x)), ids.find((x) => /haiku/.test(x)), ids.find((x) => /opus/.test(x))].filter(Boolean);
      if (!models.length && ids[0]) models.push(ids[0]);
      if (!models.length) throw new Error('No models are available to this Anthropic key.');
      return { provider, name: PROVIDERS.anthropic.name, textModel: models[0], models, imageModel: null, entry: { id, provider, key: k, baseUrl: '', models, enabled: true } };
    }
    // OpenAI and OpenAI-compatible providers (NVIDIA NIM, Groq, xAI, OpenRouter, local)
    const url = base || PROVIDERS[provider].baseUrl;
    if (!url) throw new Error('Enter the endpoint URL for this provider.');
    const listed = await listOpenAiModels(url, k);
    let models = pickModels(provider, listed, provider === 'nvidia' ? 6 : 4);
    if (!models.length) throw new Error('No chat models were found at this endpoint.');
    if (provider !== 'openrouter') {
      // Check each candidate really answers with this key, so the fallback chain only holds working models.
      const results = [];
      for (const m of models) {
        const r = await probe(url, k, m);
        results.push(r);
        if (r.auth) throw new HttpError('rejected', 401);
        if (results.filter((x) => x.ok).length >= 4) break;
      }
      const ok = results.filter((r) => r.ok).map((r) => r.model);
      if (!ok.length) throw new Error('The key was accepted, but none of its models answered a test message. Try again later.');
      models = ok;
    }
    const imageModel = provider === 'openai' ? listed.map((m) => m.id).find((x) => /^gpt-image/.test(x)) || null : null;
    return {
      provider,
      name: PROVIDERS[provider].name,
      textModel: models[0],
      models,
      imageModel,
      entry: { id, provider, key: k, baseUrl: url, models, imageModel: imageModel || '', enabled: true },
    };
  } catch (e) {
    throw new Error(friendly(e, provider));
  }
}

// ---------- settings saved on this server ----------
const file = () => path.join(config.dataDir, 'settings.json');

export async function loadSavedSettings() {
  let data = {};
  try {
    data = JSON.parse(await fs.readFile(file(), 'utf8'));
  } catch {
    data = {};
  }
  // Older versions stored one key per provider. Move them into the key chain once.
  const legacy = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY'].some((n) => data[n]);
  if (legacy) {
    setSavedSettings(data);
    const moved = aiChain({ includeDisabled: true }).filter((e) => e.origin === 'settings');
    const rest = Object.fromEntries(Object.entries(data).filter(([n]) => !/^(GEMINI|ANTHROPIC|OPENAI)_|^LLM_PROVIDER$/.test(n)));
    rest.AI_KEYS = JSON.stringify(moved.map(({ origin, ...e }) => e));
    data = rest;
    try {
      await fs.writeFile(file(), JSON.stringify(data, null, 2), { mode: 0o600 });
    } catch {
      /* read-only data folder: keep the migrated copy in memory */
    }
  }
  setSavedSettings(data);
}

export async function saveSettings(patch) {
  const next = { ...getSavedSettings() };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!KEY_NAMES.includes(k)) continue;
    if (v === null || v === undefined) delete next[k];
    else next[k] = k === 'AI_KEYS' ? JSON.stringify(parseKeyList(v)) : String(v).trim();
  }
  await fs.mkdir(path.dirname(file()), { recursive: true });
  await fs.writeFile(file(), JSON.stringify(next, null, 2), { mode: 0o600 });
  setSavedSettings(next);
  return next;
}

const mask = (v) => (v && v.length > 10 ? `${v.slice(0, 6)}...${v.slice(-4)}` : v ? '****' : '');

/** What the Settings screen shows: the key chain in order. Never returns full keys. */
export function describeKeys() {
  const chain = aiChain({ includeDisabled: true }).filter((e) => e.origin !== 'device');
  return {
    chain: chain.map((e) => ({ id: e.id, provider: e.provider, masked: mask(e.key), models: e.models, baseUrl: e.baseUrl, enabled: e.enabled, label: e.label, origin: e.origin })),
    images: config.images.provider,
    sec: getSavedSettings().SEC_USER_AGENT || process.env.SEC_USER_AGENT || '',
  };
}

/** Change the chain of keys saved on this computer (add, remove, reorder, enable). */
export async function updateChain(op) {
  const list = parseKeyList(getSavedSettings().AI_KEYS);
  if (op?.type === 'add') {
    const e = op.entry || {};
    if (!e.key || !e.provider) throw new Error('Missing key');
  }
  const next = applyChainOp(list, op || {});
  await saveSettings({ AI_KEYS: JSON.stringify(next) });
  return describeKeys();
}
