// Provider-agnostic JSON completion with automatic fallbacks.
//
// The user can add several AI keys (Settings > AI keys). They form an ordered
// chain; each key can carry several models. completeJson() walks the chain:
//   key 1 / model 1 -> key 1 / model 2 -> key 2 / model 1 -> ...
// and moves on when a call is rate-limited, fails, returns broken JSON, or
// returns JSON that does not pass the caller's validation. Broken JSON is first
// repaired (missing commas, unclosed brackets, trailing text) before giving up.
import { jsonrepair } from 'jsonrepair';
import { config } from '../config.js';
import { fetchJson, HttpError, redactSecrets } from '../lib/http.js';
import { assertPublicUrl, fetchSafeText } from '../lib/netSafety.js';
import { geminiGenerate } from './geminiModels.js';
import { deepNoEmDash } from '../../../shared/text.js';

export function llmEnabled() {
  return config.llm.chain.length > 0;
}

const NAMES = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
  nvidia: 'NVIDIA NIM',
  groq: 'Groq',
  xai: 'xAI',
  openrouter: 'OpenRouter',
  custom: 'Custom endpoint',
};

export const STYLE_RULE = 'House style: never use the em dash character (\u2014). Use commas, colons, parentheses or full stops instead.';

/** Parse model output as JSON, repairing common defects. Throws a readable error. */
export function parseJsonLoose(text) {
  const cleaned = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // reasoning models
    .replace(/```(?:json)?/gi, '')
    .trim();
  const start = cleaned.indexOf('{');
  if (start < 0) throw new Error('The model did not return JSON');
  const end = cleaned.lastIndexOf('}');
  const body = end > start ? cleaned.slice(start, end + 1) : cleaned.slice(start);
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(jsonrepair(body));
    } catch {
      // The reply may have been cut off: repair from the first brace to the very end.
      try {
        return JSON.parse(jsonrepair(cleaned.slice(start)));
      } catch (e) {
        throw new Error(`The model returned malformed JSON (${String(e.message).slice(0, 80)})`);
      }
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TRANSIENT = [408, 409, 425, 429, 500, 502, 503, 504, 529];

// ---------- one call to one provider / model ----------
async function callAnthropic(entry, model, { system, user, maxTokens, timeout }) {
  const d = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    timeout,
    headers: { 'Content-Type': 'application/json', 'x-api-key': entry.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  return (d.content || []).map((b) => b.text || '').join('');
}

async function callGemini(entry, model, { system, user, maxTokens, timeout, json = true }) {
  const d = await geminiGenerate({
    kind: 'text',
    configured: model || null,
    key: entry.key,
    timeout,
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { ...(json ? { responseMimeType: 'application/json' } : {}), maxOutputTokens: maxTokens },
    },
  });
  return (d.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
}

// Which OpenAI-compatible providers accept response_format: json_object.
const JSON_MODE = new Set(['openai', 'groq', 'xai']);
// Free hosted endpoints (NVIDIA NIM, Groq...) cap output length per model. We ask
// for the full length first and step down if the endpoint says it is too much;
// these models are also asked to keep every field short so the JSON fits.
const MAX_OUT = { groq: 8000 };
const COMPACT = new Set(['nvidia', 'groq', 'openrouter', 'custom']);
const COMPACT_RULE = 'Keep every text field short (one or two sentences) so the whole JSON object is complete.';

async function callOpenAiCompatible(entry, model, { system, user, maxTokens, timeout, json = true }) {
  await assertPublicUrl(entry.baseUrl);
  const url = `${(entry.baseUrl || '').replace(/\/$/, '')}/chat/completions`;
  let jsonMode = json && JSON_MODE.has(entry.provider);
  let maxOut = Math.min(maxTokens, MAX_OUT[entry.provider] || maxTokens);
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = {
      model,
      temperature: 0.4,
      max_tokens: maxOut,
      messages: [
        { role: 'system', content: json && COMPACT.has(entry.provider) ? `${system}\n${COMPACT_RULE}` : system },
        { role: 'user', content: user },
      ],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    };
    if (entry.provider === 'openai') {
      // Newer OpenAI models reject max_tokens and custom temperature.
      delete body.max_tokens;
      delete body.temperature;
      body.max_completion_tokens = maxOut;
    }
    try {
      const res = await fetchSafeText(url, {
        method: 'POST',
        timeoutMs: timeout,
        maxBytes: 8_000_000,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(entry.key && entry.key !== 'local' ? { Authorization: `Bearer ${entry.key}` } : {}) },
        body: JSON.stringify(body),
      });
      if (res.status < 200 || res.status >= 300) {
        const httpErr = new HttpError(`${new URL(url).hostname} responded ${res.status}`, res.status);
        httpErr.body = (res.text || '').slice(0, 2000);
        throw httpErr;
      }
      let d;
      try {
        d = JSON.parse(res.text);
      } catch {
        throw new HttpError(`Invalid JSON from ${new URL(url).hostname}`, 502);
      }
      const msg = d.choices?.[0]?.message || {};
      const text = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map((c) => c.text || '').join('') : '';
      if (!text && msg.reasoning_content) return msg.reasoning_content;
      return text;
    } catch (e) {
      const detail = `${e.message} ${e.body || ''}`;
      if (e instanceof HttpError && [400, 422].includes(e.status)) {
        if (jsonMode && /response_format|json_object|json mode/i.test(detail)) {
          jsonMode = false;
          continue;
        }
        if (maxOut > 2048 && /max_tokens|max_completion_tokens|maximum|too large|context length/i.test(detail)) {
          maxOut = maxOut > 4096 ? 4096 : 2048;
          continue;
        }
      }
      throw e;
    }
  }
  throw new Error('The endpoint rejected the request');
}

function callOnce(entry, model, args) {
  if (entry.provider === 'anthropic') return callAnthropic(entry, model, args);
  if (entry.provider === 'gemini') return callGemini(entry, model, args);
  return callOpenAiCompatible(entry, model, args);
}

/** Expand the key chain into (key, model) attempts. */
export function attemptsFor(chain) {
  const out = [];
  for (const entry of chain) {
    const models = entry.models?.length ? entry.models : [entry.provider === 'gemini' ? '' : null].filter((m) => m !== null);
    if (!models.length) continue;
    for (const model of models.slice(0, 4)) out.push({ entry, model });
  }
  return out;
}

const describe = (a) => `${NAMES[a.entry.provider] || a.entry.provider}${a.model ? ` ${a.model}` : ''}`;

function shortReason(e) {
  if (e instanceof HttpError) {
    if ([401, 403].includes(e.status)) return 'key rejected';
    if (e.status === 404) return 'model not available';
    if (e.status === 429) return 'rate limited';
    if (e.status >= 500) return `provider error ${e.status}`;
    return `request failed (${e.status})`;
  }
  if (/abort|timed? ?out/i.test(e?.message || '')) return 'timed out';
  return redactSecrets(String(e?.message || e)).slice(0, 120);
}

/**
 * Ask the chain for a JSON object.
 * @param {object} p
 * @param {string} p.system
 * @param {string} p.user
 * @param {number} [p.maxTokens]
 * @param {(value:object)=>object} [p.validate] return the (possibly cleaned) value, or throw to try the next model
 * @param {(info:{model:string, provider:string, attempt:number, reason?:string})=>void} [p.onAttempt]
 * @returns {Promise<object>} the parsed value, with em dashes removed; `__model` says who wrote it
 */
export async function completeJson({ system, user, maxTokens = 8000, validate, onAttempt, timeout = 150000 }) {
  const chain = config.llm.chain;
  if (!chain.length) throw new Error('No AI key is set up. Add one in Settings > AI keys.');
  let attempts = attemptsFor(chain);
  // With a single model available, allow one corrective retry on the same model.
  if (attempts.length === 1) attempts = [attempts[0], { ...attempts[0], retry: true }];
  const failures = [];
  const skipKeys = new Set();
  const sys = `${system}\n${STYLE_RULE}`;
  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i];
    if (skipKeys.has(a.entry.id)) continue;
    const prev = failures[failures.length - 1];
    onAttempt?.({ model: a.model || 'auto', provider: a.entry.provider, attempt: i + 1, reason: prev?.reason });
    const userText = a.retry && prev ? `${user}\n\nYour previous reply could not be used (${prev.reason}). Reply again with one complete, valid JSON object only.` : user;
    try {
      let text;
      try {
        text = await callOnce(a.entry, a.model, { system: sys, user: userText, maxTokens, timeout });
      } catch (e) {
        // One quick retry on transient errors before moving down the chain.
        if (!(e instanceof HttpError && TRANSIENT.includes(e.status))) throw e;
        await sleep(e.status === 429 ? 2500 : 1200);
        text = await callOnce(a.entry, a.model, { system: sys, user: userText, maxTokens, timeout });
      }
      let value = deepNoEmDash(parseJsonLoose(text));
      if (validate) value = validate(value);
      Object.defineProperty(value, '__model', { value: describe(a), enumerable: false });
      return value;
    } catch (e) {
      const reason = shortReason(e);
      failures.push({ who: describe(a), reason });
      if (e instanceof HttpError && [401, 403].includes(e.status)) skipKeys.add(a.entry.id);
    }
  }
  const list = failures.map((f) => `${f.who}: ${f.reason}`).join('; ');
  const err = new Error(
    failures.every((f) => f.reason === 'rate limited')
      ? `Every AI key is rate-limited right now. Wait a minute and try again. (${list})`
      : `The AI could not produce a usable case after ${failures.length} attempt${failures.length === 1 ? '' : 's'}. ${list}`,
  );
  err.message = redactSecrets(err.message);
  err.code = 'PROVIDER_UNAVAILABLE';
  err.provider = chain[0]?.provider || null;
  err.retryable = true;
  err.failures = failures;
  throw err;
}

/** Plain-text chat completion (used by the chat builder for short replies). */
export async function completeText({ system, messages, maxTokens = 1200, timeout = 60000 }) {
  const chain = config.llm.chain;
  if (!chain.length) throw new Error('No AI key is set up. Add one in Settings > AI keys.');
  const flat = messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  let lastErr;
  for (const a of attemptsFor(chain)) {
    try {
      const text = await callOnce(a.entry, a.model, { system: `${system}\n${STYLE_RULE}`, user: flat, maxTokens, timeout, json: false });
      return text;
    } catch (e) {
      lastErr = e;
    }
  }
  const err = new Error(redactSecrets(`No AI model answered: ${shortReason(lastErr)}`));
  err.code = 'PROVIDER_UNAVAILABLE';
  err.provider = chain[0]?.provider || null;
  err.retryable = true;
  throw err;
}
