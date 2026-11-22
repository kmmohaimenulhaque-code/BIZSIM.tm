#!/usr/bin/env node
// BIZSIM localisation tooling. No dependencies beyond Node 18+.
//
//   node scripts/i18n.mjs validate   JSON, placeholders, markup tags, plural forms, arrays, unknown keys
//   node scripts/i18n.mjs missing    keys missing per language, and keys the code uses that English lacks
//   node scripts/i18n.mjs coverage   per-language coverage and translation status (add --json for JSON)
//   node scripts/i18n.mjs check      everything above, plus unused keys and hard-coded interface text
//
// validate and check also check season content overlays (client/src/i18n/content/<locale>/<caseId>.json):
// valid JSON, a known locale, an existing season, only existing checkpoint and option ids, a status,
// and whether the English text changed since translation (warning: "stale").
//
// Exit code 1 when an error is found. Warnings never fail the run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, SOURCE_LOCALE } from '../shared/locales.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'client/src/i18n/resources');
const SRC = path.join(ROOT, 'client/src');
const PLURAL = /_(zero|one|two|few|many|other)$/;
const cmd = process.argv[2] || 'check';
const asJson = process.argv.includes('--json');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ---------- loading ----------
function load(code) {
  const file = path.join(RES, `${code}.json`);
  if (!fs.existsSync(file)) return { missingFile: true, data: {} };
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return { data: JSON.parse(raw) };
  } catch (e) {
    err(`${code}.json is not valid JSON: ${e.message}`);
    return { invalid: true, data: {} };
  }
}

/** Flatten to { 'a.b.c': value }. Arrays stay as leaves. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const placeholders = (s) => [...String(s).matchAll(/\{\{\s*([\w.]+)\s*(?:,[^}]*)?\}\}/g)].map((m) => m[1]).sort();
const tags = (s) => [...String(s).matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[0].replace(/\s/g, '')).sort();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const strings = (v) => (Array.isArray(v) ? v.map(String) : [String(v)]);

const source = flatten(load(SOURCE_LOCALE).data);
// Plural groups in the source: base -> { one: ..., other: ... }
const pluralBases = new Set(Object.keys(source).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
const sourceUnits = new Set(Object.keys(source).map((k) => (PLURAL.test(k) ? k.replace(PLURAL, '') : k)));

function pluralCategories(intl) {
  try {
    return new Intl.PluralRules(intl).resolvedOptions().pluralCategories;
  } catch {
    return ['one', 'other'];
  }
}

// ---------- per-language analysis ----------
function analyse(l) {
  const { data, missingFile } = load(l.code);
  const flat = flatten(data);
  const isVariant = Boolean(l.variantOf);
  const cats = pluralCategories(l.intl);
  const result = { code: l.code, status: l.status, variantOf: l.variantOf || null, missingFile: Boolean(missingFile), total: sourceUnits.size, translated: 0, missing: [], unknown: [], sameAsSource: 0 };
  if (l.code === SOURCE_LOCALE) {
    result.translated = sourceUnits.size;
    for (const base of pluralBases) {
      if (!(`${base}_other` in source)) err(`en: plural "${base}" has no _other form`);
    }
    return result;
  }
  for (const key of Object.keys(flat)) {
    const base = key.replace(PLURAL, '');
    if (!sourceUnits.has(key) && !(PLURAL.test(key) && pluralBases.has(base))) result.unknown.push(key);
  }
  for (const unit of sourceUnits) {
    if (pluralBases.has(unit)) {
      const present = cats.filter((c) => typeof flat[`${unit}_${c}`] === 'string' && flat[`${unit}_${c}`].trim());
      if (present.length === 0) {
        if (!isVariant) result.missing.push(unit);
        continue;
      }
      result.translated++;
      for (const c of cats) if (!present.includes(c)) err(`${l.code}: "${unit}" lacks the plural form "${c}" (${l.english} uses ${cats.join(', ')})`);
      const ref = placeholders(source[`${unit}_other`]).filter((p) => p !== 'count');
      for (const c of present) {
        const got = placeholders(flat[`${unit}_${c}`]).filter((p) => p !== 'count');
        if (!same([...new Set(ref)], [...new Set(got)])) err(`${l.code}: "${unit}_${c}" placeholders {${got.join(', ')}} differ from English {${ref.join(', ')}}`);
      }
      continue;
    }
    const v = flat[unit];
    const s = source[unit];
    if (v == null || (typeof v === 'string' && !v.trim())) {
      if (!isVariant) result.missing.push(unit);
      continue;
    }
    result.translated++;
    if (Array.isArray(s) !== Array.isArray(v)) {
      err(`${l.code}: "${unit}" must be ${Array.isArray(s) ? 'a list' : 'text'}`);
      continue;
    }
    if (Array.isArray(s) && s.length !== v.length) err(`${l.code}: "${unit}" has ${v.length} items, English has ${s.length}`);
    const sv = strings(s);
    const tv = strings(v);
    sv.forEach((x, i) => {
      if (tv[i] == null) return;
      const a = [...new Set(placeholders(x))];
      const b = [...new Set(placeholders(tv[i]))];
      if (!same(a, b)) err(`${l.code}: "${unit}" placeholders {${b.join(', ')}} differ from English {${a.join(', ')}}`);
      if (!same(tags(x), tags(tv[i]))) err(`${l.code}: "${unit}" markup ${tags(tv[i]).join(' ') || '(none)'} differs from English ${tags(x).join(' ') || '(none)'}`);
      if (/<script|javascript:|on\w+=/i.test(tv[i])) err(`${l.code}: "${unit}" contains markup that is never allowed`);
      if (tv[i] === x && /[a-z]{4}/i.test(x)) result.sameAsSource++;
    });
  }
  if (result.unknown.length) for (const k of result.unknown) err(`${l.code}: unknown key "${k}" (not in English)`);
  return result;
}

// ---------- code scan ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['resources', 'content', 'assets'].includes(e.name)) walk(p, out);
    } else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}
const codeFiles = [...walk(SRC), ...['shared/notifyPlan.js', 'shared/package.js'].map((f) => path.join(ROOT, f))];

function scanUsage() {
  const used = new Set();
  const explicit = new Set();
  const prefixes = new Set();
  for (const f of codeFiles) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/\b(?:t|tr|i18n\.t)\(\s*'([\w.-]+)'/g)) explicit.add(m[1]);
    for (const m of s.matchAll(/i18nKey="([\w.-]+)"/g)) explicit.add(m[1]);
    for (const m of s.matchAll(/'(notify\.plan\.[\w]+)'/g)) used.add(m[1]);
    for (const m of s.matchAll(/\b(?:t|tr|i18n\.t)\(\s*`([\w.-]*)\$\{/g)) prefixes.add(m[1]);
    for (const m of s.matchAll(/`((?:errors|contentClass|evidence|taxonomy|navigation|notify|collections|settings|language|dimensions|method|simulation|research|case|learning|keys|transfer|import|share|report)\.[\w.-]*)\$\{/g)) prefixes.add(m[1]);
    // Any quoted string that is exactly a key (e.g. passed through a ternary) counts as used.
    for (const m of s.matchAll(/['"]([a-zA-Z][\w-]*(?:\.[\w-]+)+)['"]/g)) used.add(m[1]);
  }
  for (const k of explicit) used.add(k);
  return { used, explicit, prefixes };
}

// User-facing English left in code: JSX text, common attributes, toasts and dialogs.
function scanHardcoded() {
  const found = [];
  const ALLOW = /^(BIZSIM|BZS1|BZP1|OK|AI|PDF|QR|URL|API|SEC EDGAR|Wikidata|Wikipedia|N\/A|×|·|—|→|←)$/;
  for (const f of walk(SRC)) {
    const rel = path.relative(ROOT, f);
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line) || /i18n-ignore/.test(line)) return;
      const hits = [];
      for (const m of line.matchAll(/>([^<>{}`]*[A-Za-z]{3,}[^<>{}`]*)</g)) {
        const txt = m[1].trim();
        if (txt && !ALLOW.test(txt) && /[a-z]{2,}\s+[a-z]{2,}|^[A-Z][a-z]{3,}$/.test(txt)) hits.push(txt);
      }
      for (const m of line.matchAll(/\b(?:title|placeholder|aria-label|alt|label)="([^"{}]*[a-z]{3,}[^"{}]*)"/g)) if (/\s/.test(m[1]) || /^[A-Z][a-z]+$/.test(m[1])) hits.push(m[1]);
      for (const m of line.matchAll(/\b(?:toast|confirm|alert)\(\s*['`]([^'`]*[a-z]{3,}[^'`]*)['`]/g)) hits.push(m[1]);
      for (const m of line.matchAll(/new Error\(\s*['`]([A-Z][^'`]*\s[^'`]*)['`]/g)) hits.push(m[1]);
      // Whole-line JSX text (multi-line elements).
      const bare = line.trim();
      if (/^[A-Z][a-z]+(?:[ ,.'’:;()-]+[A-Za-z][a-z]*){2,}[.:!?]?$/.test(bare) && !/[=;{}()]\s*$/.test(bare.replace(/\.$/, ''))) hits.push(bare);
      for (const h of hits) found.push(`${rel}:${i + 1}: ${h.slice(0, 90)}`);
    });
  }
  return found;
}

// ---------- commands ----------
const reports = LOCALES.map(analyse);

function printCoverage() {
  const rows = reports.map((r) => {
    const l = LOCALES.find((x) => x.code === r.code);
    const pct = r.variantOf ? null : Math.round((1000 * r.translated) / r.total) / 10;
    return { code: r.code, language: l.english, status: r.status, coverage: pct, translated: r.translated, total: r.total, missing: r.missing.length, sameAsEnglish: r.sameAsSource, note: r.variantOf ? `variant of ${r.variantOf}: ${r.translated} overrides, the rest falls back` : '' };
  });
  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), sourceKeys: sourceUnits.size, locales: rows }, null, 2));
    return;
  }
  console.log(`Source strings (en): ${sourceUnits.size}\n`);
  console.log('code     language               status     coverage   missing  same-as-English');
  for (const r of rows) console.log(`${r.code.padEnd(8)} ${r.language.padEnd(22)} ${String(r.status).padEnd(10)} ${(r.coverage == null ? 'variant' : `${r.coverage.toFixed(1)}%`).padStart(8)}   ${String(r.missing).padStart(7)}  ${String(r.sameAsEnglish).padStart(6)}${r.note ? `   (${r.note})` : ''}`);
}

function doMissing() {
  for (const r of reports) {
    if (r.missingFile && r.code !== SOURCE_LOCALE) err(`${r.code}: resource file is missing`);
    if (r.missing.length) {
      err(`${r.code}: ${r.missing.length} missing key(s)`);
      if (!asJson) for (const k of r.missing.slice(0, 40)) console.log(`  ${r.code}  ${k}`);
      if (r.missing.length > 40) console.log(`  ${r.code}  … and ${r.missing.length - 40} more`);
    }
  }
  const { explicit } = scanUsage();
  for (const k of explicit) {
    if (!(k in source) && !pluralBases.has(k) && !Object.keys(source).some((s) => s.startsWith(`${k}.`))) err(`code uses "${k}", which English does not define`);
  }
}

function doUnused() {
  const { used, prefixes } = scanUsage();
  const unused = [...sourceUnits].filter((u) => !used.has(u) && ![...used].some((x) => u.startsWith(`${x}.`)) && ![...prefixes].some((p) => p && u.startsWith(p)));
  for (const u of unused) warn(`possibly unused key "${u}"`);
}

function finish() {
  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(errors.length ? 1 : 0);
}


// ---------- season content overlays ----------
const CONTENT = path.join(ROOT, 'client/src/i18n/content');
const OVERLAY_STATUS = new Set(['machine', 'review', 'reviewed', 'release']);
async function checkOverlays() {
  const summary = {};
  if (!fs.existsSync(CONTENT)) return summary;
  const { CASE_BY_ID } = await import('../shared/cases/index.js');
  const { digestOf } = await import('../shared/package.js');
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k]]));
  // Same fingerprint as client/src/lib/caseLocale.js sourceRevision().
  const revision = (c) => digestOf({
    t: pick(c, ['title', 'tagline', 'reading']),
    s: c.situation,
    c: pick(c.concept || {}, ['framework', 'explanation']),
    e: (c.evidence || []).map((e) => pick(e, ['label', 'value', 'note'])),
    k: c.checkpoints.map((k) => [k.id, pick(k, ['title', 'dateLabel', 'prompt', 'context']), k.outcome?.text, k.options.map((o) => [o.id, pick(o, ['label', 'summary', 'consequence', 'tradeoffs', 'risks'])])]),
    p: (c.episodes || []).map((e) => [e.n, e.title, e.dateLabel, e.insight?.text]),
    o: [c.outcome?.summary, c.outcome?.secondOrder, c.outcome?.baseRate, (c.outcome?.lessons || []).map((l) => l.text)],
  }).slice(0, 16);
  for (const loc of fs.readdirSync(CONTENT)) {
    const dir = path.join(CONTENT, loc);
    if (!fs.statSync(dir).isDirectory()) continue;
    if (!LOCALES.some((l) => l.code === loc) || loc === SOURCE_LOCALE) { err(`content/${loc}: not a supported translation locale`); continue; }
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const where = `content/${loc}/${f}`;
      let ov;
      try { ov = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { err(`${where}: invalid JSON (${e.message})`); continue; }
      const id = f.replace(/\.json$/, '');
      if (ov.caseId !== id) { err(`${where}: caseId "${ov.caseId}" does not match the file name`); continue; }
      const c = CASE_BY_ID[id];
      if (!c) { err(`${where}: no built-in season "${id}"`); continue; }
      if (!OVERLAY_STATUS.has(ov.status)) err(`${where}: status must be one of ${[...OVERLAY_STATUS].join(', ')}`);
      if (!ov.fields || typeof ov.fields !== 'object') { err(`${where}: no fields`); continue; }
      for (const [kid, k] of Object.entries(ov.fields.checkpoints || {})) {
        const ck = c.checkpoints.find((x) => x.id === kid);
        if (!ck) { err(`${where}: unknown checkpoint "${kid}"`); continue; }
        for (const oid of Object.keys(k.options || {})) if (!ck.options.some((o) => o.id === oid)) err(`${where}: unknown option "${kid}.${oid}"`);
      }
      for (const n of Object.keys(ov.fields.episodes || {})) if (!(c.episodes || []).some((e) => String(e.n) === n)) err(`${where}: unknown episode ${n}`);
      if (!ov.sourceRevision) warn(`${where}: no sourceRevision, staleness cannot be detected`);
      else if (ov.sourceRevision !== revision(c)) warn(`${where}: stale, the English season changed after translation`);
      (summary[loc] ||= []).push(`${id} (${ov.status})`);
    }
  }
  return summary;
}

const overlaySummary = cmd === 'missing' ? {} : await checkOverlays();
const printOverlays = () => {
  const e = Object.entries(overlaySummary);
  console.log(`\nSeason content overlays: ${e.length ? e.map(([l, ids]) => `${l}: ${ids.join(', ')}`).join('; ') : 'none'}. All other built-in seasons are English only.`);
};

if (cmd === 'coverage') {
  printCoverage();
  if (!asJson) { printOverlays(); finish(); }
} else if (cmd === 'validate') {
  finish();
} else if (cmd === 'missing') {
  doMissing();
  finish();
} else if (cmd === 'check') {
  printCoverage();
  printOverlays();
  console.log('');
  doMissing();
  doUnused();
  const hard = scanHardcoded();
  for (const h of hard) warn(`hard-coded text? ${h}`);
  finish();
} else {
  console.error(`Unknown command "${cmd}". Use check, validate, missing or coverage.`);
  process.exit(2);
}
