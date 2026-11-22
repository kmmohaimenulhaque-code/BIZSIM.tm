// .bizsim packages: portable, versioned files that carry one season, one
// episode, an AI-built case or a custom season between devices, by file or by
// a sequence of QR codes. The format is specified in docs/PACKAGE-FORMAT.md.
//
// Security notes:
// * Packages never contain API keys, pairing data, progress, settings or any
//   other personal data: only the case content listed in the spec.
// * Everything read from a package is untrusted and goes through
//   sanitizeCase() before it is stored or shown.
// * The SHA-256 digest detects damaged or incomplete transfers. It is NOT a
//   signature: anyone can make a package with a valid digest, so it says
//   nothing about who made it or whether its content is true.
import { gzipSync, gunzipSync, Gunzip, strToU8, strFromU8 } from 'fflate';
import { sha256, toHex } from './sha256.js';
import { sanitizeCase, cleanStr } from './caseSchema.js';
import { contentClassOf, isAiGenerated } from './contentClass.js';
import { episodesOf } from './episodes.js';

export const FORMAT = 'bizsim-package';
export const SCHEMA_VERSION = 1;
export const MAX_PACKAGE_BYTES = 1_500_000; // decoded JSON
export const MAX_FILE_BYTES = 2_000_000;
export const FRAME_PREFIX = 'BZP1';
export const FRAME_CHUNK = 280;
export const MAX_FRAMES = 400;

// Streaming bounded decompression (prevents zip bombs before full allocation)
export function gunzipBounded(compressedBytes, maxOutputBytes) {
  const chunks = [];
  let total = 0;
  let exceeded = false;
  const gunzip = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > maxOutputBytes) {
      exceeded = true;
      throw new Error(`Decompressed package exceeds limit (${maxOutputBytes} bytes)`);
    }
    chunks.push(chunk);
  });
  gunzip.push(compressedBytes, true);
  if (exceeded) throw new Error(`Decompressed package exceeds limit (${maxOutputBytes} bytes)`);

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

const POISON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SECRET_LEAK_PATTERNS = [
  /\bsk-[A-Za-z0-9_\-]{20,}\b/,       // OpenAI / OpenRouter keys
  /\bAIza[0-9A-Za-z_\-]{30,}\b/,     // Google Gemini API keys (legacy)
  /\bAQ\.[0-9A-Za-z._\-]{20,}\b/,     // Google Gemini API keys (Auth Keys)
  /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/,  // Anthropic keys
  /\bgsk_[A-Za-z0-9]{20,}\b/,        // Groq keys
  /\bxai-[A-Za-z0-9_\-]{20,}\b/,     // xAI keys
];

const MAX_RECURSION_DEPTH = 32;

export function stripPoisonKeys(value, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) throw new Error('Package nesting depth exceeded safe limit.');
  if (Array.isArray(value)) return value.map((v) => stripPoisonKeys(v, depth + 1));
  if (value && typeof value === 'object') {
    const clean = Object.create(null);
    for (const [k, v] of Object.entries(value)) {
      if (POISON_KEYS.has(k)) continue;
      clean[k] = stripPoisonKeys(v, depth + 1);
    }
    return Object.assign({}, clean);
  }
  return value;
}

export function assertNoSecretsInPayload(payload) {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const re of SECRET_LEAK_PATTERNS) {
    if (re.test(serialized)) {
      throw new Error('Blocked export: payload appears to contain an API key or secret token.');
    }
  }
}

const KNOWN_TOP = new Set(['format', 'schemaVersion', 'id', 'createdAt', 'appVersion', 'kind', 'title', 'subject', 'industry', 'period', 'seasonEpisodes', 'classification', 'ai', 'content', 'integrity']);

/** Deterministic JSON: object keys sorted, so the digest does not depend on key order. */
export function canonical(v, depth = 0) {
  if (depth > MAX_RECURSION_DEPTH) throw new Error('Object nesting depth exceeded safe limit.');
  if (Array.isArray(v)) return `[${v.map((x) => canonical(x, depth + 1)).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k], depth + 1)}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

export const digestOf = (content) => toHex(sha256(canonical(content)));

function randomId() {
  const b = new Uint8Array(9);
  globalThis.crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Errors carry a stable `code` (and `params`) so the interface can show them in
 * the user's language; `message` stays in English for logs and tests.
 */
export function pkgError(code, message, params = {}) {
  return Object.assign(new Error(message), { code: `package.${code}`, params });
}

/** A case trimmed to one episode, playable on its own. */
export function episodeSlice(c, n) {
  const ep = episodesOf(c).find((e) => e.n === n);
  if (!ep) throw pkgError('episodeNotFound', `Episode ${n} not found`, { n });
  const ids = new Set(ep.decisions.map((k) => k.id));
  const checkpoints = c.checkpoints.filter((k) => ids.has(k.id)).map((k) => ({ ...k, episode: 1 }));
  const used = new Set(checkpoints.flatMap((k) => k.outcome?.sourceIds || []));
  (c.evidence || []).forEach((e) => e.sourceId && used.add(e.sourceId));
  const sources = c.sources.filter((s) => used.has(s.id));
  const src = (c.episodes || []).find((e) => e.n === n) || { n, title: ep.title, dateLabel: ep.dateLabel, insight: ep.insight };
  return {
    ...c,
    id: `${c.id}.ep${n}`.slice(0, 120),
    title: `${c.title}: Episode ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][n - 1] || n}`,
    sources: sources.length ? sources : c.sources,
    evidence: (c.evidence || []).filter((e) => !e.sourceId || sources.some((s) => s.id === e.sourceId)),
    checkpoints,
    episodes: [{ ...src, n: 1 }],
    minutes: Math.max(4, Math.round((c.minutes || 16) / Math.max(1, episodesOf(c).length))),
    evidenceChecks: c.evidenceChecks ? Object.fromEntries(Object.entries(c.evidenceChecks).filter(([k]) => ids.has(k))) : undefined,
  };
}

/**
 * Build a package. kind: 'season' | 'episode' | 'ai-case' | 'custom-season'.
 * Only fields that pass sanitizeCase are included, which by construction
 * excludes keys, credentials and personal data.
 */
export function createPackage(c, { episode, appVersion = '0.0.0', now = new Date() } = {}) {
  const base = episode ? episodeSlice(c, episode) : c;
  const clean = sanitizeCase(base);
  if (!clean.ok) throw pkgError('notExportable', `This season cannot be exported: ${clean.errors.slice(0, 2).join('; ')}`, { details: clean.errors.slice(0, 2).join('; ') });
  const value = clean.value;
  delete value.importedAt;
  const kind = episode ? 'episode' : isAiGenerated(c) ? 'ai-case' : c.source === 'curated' ? 'season' : 'custom-season';
  const content = { case: value, ...(episode ? { origin: { caseId: c.id, episode } } : {}) };
  const ai = isAiGenerated(value)
    ? { generated: true, model: value.model || null, provider: value.provider || null, disclosure: 'Written by an AI model from the cited sources. Check important facts in the sources.' }
    : { generated: false };
  const pkg = {
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    id: randomId(),
    createdAt: now.toISOString(),
    appVersion,
    kind,
    title: value.title,
    subject: value.company,
    industry: value.pillar || value.domain,
    period: value.yearLabel,
    seasonEpisodes: (value.episodes || []).length || 1,
    classification: contentClassOf(value),
    ai,
    content,
    integrity: { algorithm: 'SHA-256', digest: digestOf(content), note: 'Detects damage only. Not proof of authorship or accuracy.' },
  };
  assertNoSecretsInPayload(pkg);
  return pkg;
}

export const packageFileName = (pkg) =>
  `${String(pkg.title || 'season')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'season'}.bizsim`;

/** Serialise for a .bizsim file. */
export const packageToText = (pkg) => JSON.stringify(pkg, null, 1);

/**
 * Parse and validate a package from untrusted text. Throws an Error with a
 * plain-language message, or returns { pkg, case, warnings }.
 */
export function readPackage(text) {
  if (typeof text !== 'string') throw pkgError('notPackage', 'This is not a BIZSIM package.');
  if (text.length > MAX_PACKAGE_BYTES) throw pkgError('tooLarge', 'This package is too large to import safely.');
  let pkg;
  try {
    pkg = stripPoisonKeys(JSON.parse(text));
  } catch {
    throw pkgError('notJson', 'This file is not a BIZSIM package (it is not valid JSON).');
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg) || pkg.format !== FORMAT) throw pkgError('notPackageFile', 'This file is not a BIZSIM package.');
  if (!Number.isInteger(pkg.schemaVersion)) throw pkgError('noSchema', 'This package has no schema version.');
  if (pkg.schemaVersion > SCHEMA_VERSION) throw pkgError('newer', `This package was made with a newer BIZSIM (package format ${pkg.schemaVersion}). Update the app to import it.`, { version: pkg.schemaVersion });
  if (pkg.schemaVersion < 1) throw pkgError('unsupportedFormat', 'This package uses an unsupported format.');
  for (const f of ['id', 'createdAt', 'kind', 'content', 'integrity']) if (pkg[f] == null) throw pkgError('missingField', `This package is missing its ${f}.`, { field: f });
  if (typeof pkg.id !== 'string' || !/^[a-f0-9]{8,64}$/.test(pkg.id)) throw pkgError('badId', 'This package has an invalid id.');
  if (!['season', 'episode', 'ai-case', 'custom-season'].includes(pkg.kind)) throw pkgError('badKind', 'This package contains an unsupported kind of content.');
  if (!pkg.content || typeof pkg.content !== 'object' || !pkg.content.case) throw pkgError('noSeason', 'This package has no season in it.');
  const warnings = [];
  const unknown = Object.keys(pkg).filter((k) => !KNOWN_TOP.has(k));
  if (unknown.length) warnings.push(`Ignored unsupported fields: ${unknown.slice(0, 5).map((k) => cleanStr(k, 30)).join(', ')}`);
  if (pkg.integrity?.algorithm !== 'SHA-256' || typeof pkg.integrity?.digest !== 'string') throw pkgError('noIntegrity', 'This package has no integrity check.');
  if (digestOf(pkg.content) !== pkg.integrity.digest) throw pkgError('damaged', 'This package is damaged or incomplete (its integrity check does not match). Ask the sender to share it again.');
  const r = sanitizeCase(pkg.content.case);
  if (!r.ok) throw pkgError('invalidSeason', `The season in this package is not valid: ${r.errors.slice(0, 2).join('; ')}`, { details: r.errors.slice(0, 2).join('; ') });
  warnings.push(...r.warnings.slice(0, 5));
  const declaredAi = pkg.ai?.generated === true;
  const value = { ...r.value };
  if (declaredAi) value.aiGenerated = true;
  if (value.source === 'curated' && pkg.kind !== 'season') value.source = 'imported';
  return {
    pkg: {
      id: pkg.id,
      kind: pkg.kind,
      createdAt: cleanStr(pkg.createdAt, 40),
      appVersion: cleanStr(pkg.appVersion, 20),
      title: cleanStr(pkg.title, 300) || value.title,
      digest: pkg.integrity.digest,
      origin: pkg.content.origin && typeof pkg.content.origin === 'object' ? { caseId: cleanStr(pkg.content.origin.caseId, 120), episode: Number.isInteger(pkg.content.origin.episode) ? pkg.content.origin.episode : undefined } : undefined,
      ai: declaredAi ? { generated: true, model: cleanStr(pkg.ai.model, 120), provider: cleanStr(pkg.ai.provider, 60) } : { generated: false },
    },
    case: value,
    warnings,
  };
}

/**
 * Decide how an incoming case relates to what is already on the device.
 * Returns { status: 'new' | 'builtin' | 'identical' | 'conflict', existing? }.
 */
export function duplicateStatus(incoming, { builtInIds, myCases }) {
  if (builtInIds.has(incoming.id)) return { status: 'builtin' };
  const mine = myCases.find((x) => x.id === incoming.id);
  if (!mine) return { status: 'new' };
  const strip = (c) => {
    const { importedAt, generatedAt, evidenceCheckedAt, ...rest } = sanitizeCase(c).value || c;
    void importedAt;
    void generatedAt;
    void evidenceCheckedAt;
    return rest;
  };
  return digestOf(strip(mine)) === digestOf(strip(incoming)) ? { status: 'identical', existing: mine } : { status: 'conflict', existing: mine };
}

// ---------- QR frames ----------
const b64url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (str) => {
  const clean = str.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const b = atob(clean + '==='.slice((clean.length + 3) % 4));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
};
const frameCheck = (pid, i, n, chunk) => toHex(sha256(`${pid}|${i}|${n}|${chunk}`)).slice(0, 6);

/** Split a package into QR frame texts: BZP1|pid|i|n|check|chunk. */
export function packageToFrames(pkg) {
  assertNoSecretsInPayload(pkg);
  const data = b64url(gzipSync(strToU8(JSON.stringify(pkg)), { level: 9, mtime: 0 }));
  const pid = String(pkg.id).slice(0, 12);
  const n = Math.max(1, Math.ceil(data.length / FRAME_CHUNK));
  if (n > MAX_FRAMES) throw pkgError('tooManyFrames', 'This season is too large to send by QR code. Share the .bizsim file instead.');
  return Array.from({ length: n }, (_, i) => {
    const chunk = data.slice(i * FRAME_CHUNK, (i + 1) * FRAME_CHUNK);
    return `${FRAME_PREFIX}|${pid}|${i}|${n}|${frameCheck(pid, i, n, chunk)}|${chunk}`;
  });
}

export function parsePackageFrame(text) {
  const m = /^BZP1\|([a-f0-9]{8,12})\|(\d{1,3})\|(\d{1,3})\|([a-f0-9]{6})\|([A-Za-z0-9_-]{1,400})$/.exec(String(text || '').trim());
  if (!m) return null;
  const f = { pid: m[1], i: +m[2], n: +m[3], check: m[4], data: m[5] };
  if (f.n < 1 || f.n > MAX_FRAMES || f.i >= f.n) return null;
  if (frameCheck(f.pid, f.i, f.n, f.data) !== f.check) return { ...f, corrupt: true };
  return f;
}

/**
 * Collects frames for one package. Tolerates repeats, any order and frames
 * from a different package (reported, not mixed in). State is a plain object
 * so it can be saved and resumed.
 */
export class FrameCollector {
  constructor(saved) {
    this.pid = saved?.pid || null;
    this.n = saved?.n || 0;
    this.parts = { ...(saved?.parts || {}) };
  }
  get count() {
    return Object.keys(this.parts).length;
  }
  get missing() {
    return Array.from({ length: this.n }, (_, i) => i).filter((i) => !(i in this.parts));
  }
  get complete() {
    return this.n > 0 && this.count === this.n;
  }
  toJSON() {
    return { pid: this.pid, n: this.n, parts: this.parts };
  }
  /** Returns 'added' | 'duplicate' | 'other-package' | 'corrupt' | 'invalid' | 'complete'. */
  add(text) {
    const f = parsePackageFrame(text);
    if (!f) return 'invalid';
    if (f.corrupt) return 'corrupt';
    if (this.pid && (f.pid !== this.pid || f.n !== this.n)) return 'other-package';
    if (!this.pid) {
      this.pid = f.pid;
      this.n = f.n;
    }
    if (f.i in this.parts) return 'duplicate';
    this.parts[f.i] = f.data;
    return this.complete ? 'complete' : 'added';
  }
  /** Reassemble and decompress. Returns the package JSON text. */
  assemble() {
    if (!this.complete) throw pkgError('incomplete', `Still missing ${this.missing.length} of ${this.n} codes.`, { missing: this.missing.length, n: this.n });
    const data = Array.from({ length: this.n }, (_, i) => this.parts[i]).join('');
    let bytes;
    try {
      bytes = gunzipBounded(fromB64url(data), MAX_PACKAGE_BYTES);
    } catch (err) {
      if (err && /exceeds limit/i.test(err.message)) throw pkgError('tooLarge', 'This package is too large to import safely.');
      throw pkgError('undecodable', 'The codes could not be decoded. Scan them again.');
    }
    if (bytes.length > MAX_PACKAGE_BYTES) throw pkgError('tooLarge', 'This package is too large to import safely.');
    return strFromU8(bytes);
  }
}
