// Localisation tests for the shared (server + client) modules: locale matching,
// plural rules, AI language instructions, package error codes, Unicode packages,
// notifications in another language and the resource files themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES, LOCALE_BY_CODE, LANGUAGE_COUNT, matchLocale, resolveLocale, cleanLocale, languageInstruction, promptLanguage, isRtl } from '../shared/locales.js';
import { CASE_BY_ID } from '../shared/cases/index.js';
import { createPackage, readPackage, packageToText, packageToFrames, FrameCollector, pkgError } from '../shared/package.js';
import { planNotifications, DEFAULT_SETTINGS } from '../shared/notifyPlan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'client/src/i18n/resources');
const load = (code) => JSON.parse(fs.readFileSync(path.join(RES, `${code}.json`), 'utf8'));
const flat = (o, p = '', out = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
};

test('the 15 required languages plus the English (UK) variant, and nothing else', () => {
  const codes = LOCALES.map((l) => l.code).sort();
  assert.deepEqual(codes, ['ar', 'bn', 'de', 'en', 'en-GB', 'es', 'fr', 'hi', 'id', 'ja', 'ko', 'pt-BR', 'ru', 'tr', 'ur', 'zh-Hans'].sort());
  assert.equal(LANGUAGE_COUNT, 15);
  assert.equal(LOCALE_BY_CODE['en-GB'].variantOf, 'en');
  for (const l of LOCALES) assert.ok(l.native && l.english && l.intl && (l.dir === 'ltr' || l.dir === 'rtl'), l.code);
});

test('no language claims a human review that has not happened', () => {
  for (const l of LOCALES) {
    if (l.code === 'en') assert.equal(l.status, 'source');
    else assert.equal(l.status, 'machine', `${l.code} must stay "machine" until a fluent speaker reviews it`);
  }
});

test('RTL only for Arabic and Urdu', () => {
  assert.deepEqual(LOCALES.filter((l) => isRtl(l.code)).map((l) => l.code).sort(), ['ar', 'ur']);
});

test('system language matching and detection order', () => {
  assert.equal(matchLocale('en-US'), 'en');
  assert.equal(matchLocale('en-GB'), 'en-GB');
  assert.equal(matchLocale('en_IE'), 'en-GB');
  assert.equal(matchLocale('en-BD'), 'en-GB');
  assert.equal(matchLocale('bn-BD'), 'bn');
  assert.equal(matchLocale('bn-IN'), 'bn');
  assert.equal(matchLocale('pt-PT'), 'pt-BR');
  assert.equal(matchLocale('zh-CN'), 'zh-Hans');
  assert.equal(matchLocale('zh-TW'), 'zh-Hans');
  assert.equal(matchLocale('ar-EG'), 'ar');
  assert.equal(matchLocale('ur-PK'), 'ur');
  assert.equal(matchLocale('es-419'), 'es');
  assert.equal(matchLocale('nl-NL'), null);
  assert.equal(matchLocale(''), null);
  assert.equal(matchLocale(undefined), null);
  // saved choice beats the system; then the first supported system language; then English
  assert.equal(resolveLocale('ja', ['de-DE']), 'ja');
  assert.equal(resolveLocale(null, ['nl-NL', 'tr-TR', 'de-DE']), 'tr');
  assert.equal(resolveLocale('xx', ['sv-SE']), 'en');
  assert.equal(resolveLocale(null, []), 'en');
});

test('locale codes from clients are sanitised; AI instructions name the language', () => {
  assert.equal(cleanLocale('bn'), 'bn');
  for (const bad of ['', 'xx', '../en', 'en; DROP', 42, null, {}, 'EN']) assert.equal(cleanLocale(bad), null);
  assert.equal(languageInstruction('en'), '');
  assert.equal(languageInstruction('nope'), '');
  assert.match(languageInstruction('en-GB'), /British English/);
  const bn = languageInstruction('bn');
  assert.match(bn, /Bengali \(বাংলা\)/);
  assert.match(bn, /Keep JSON keys, ids/);
  assert.match(languageInstruction('ar'), /Arabic/);
  assert.equal(promptLanguage('zh-Hans'), 'Simplified Chinese (简体中文)');
});

test('resource files: every language has every key, matching placeholders, tags and plural forms', () => {
  const en = flat(load('en'));
  const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');
  const enUnits = new Set(Object.keys(en).map(base));
  const ph = (s) => [...String(s).matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]).sort().join(',');
  const tg = (s) => [...String(s).matchAll(/<\/?[a-zA-Z][\w-]*>/g)].map((m) => m[0]).sort().join(',');
  for (const l of LOCALES) {
    if (l.code === 'en' || l.variantOf) continue;
    const tr = flat(load(l.code));
    const units = new Set(Object.keys(tr).map(base));
    for (const u of enUnits) assert.ok(units.has(u), `${l.code} lacks ${u}`);
    const cats = new Intl.PluralRules(l.intl).resolvedOptions().pluralCategories;
    for (const [k, v] of Object.entries(tr)) {
      const ek = en[k] !== undefined ? k : Object.keys(en).find((x) => base(x) === base(k));
      assert.ok(ek, `${l.code} has unknown key ${k}`);
      const ev = en[ek];
      if (Array.isArray(ev)) {
        assert.equal(v.length, ev.length, `${l.code} ${k} array length`);
        continue;
      }
      // a plural form may drop {{count}} (e.g. "one season"), but must never add a placeholder English lacks
      const allowed = new Set(ph(ev).split(',').filter(Boolean));
      for (const p of ph(v).split(',').filter(Boolean)) assert.ok(allowed.has(p) || p === 'count', `${l.code} ${k}: unexpected {{${p}}}`);
      if (!/_(zero|one|two|few|many)$/.test(k)) assert.equal(ph(v), ph(ev), `${l.code} ${k} placeholders`);
      assert.equal(tg(v), tg(ev), `${l.code} ${k} markup`);
      assert.ok(!/<script|javascript:|on\w+=/i.test(v), `${l.code} ${k} unsafe markup`);
    }
    for (const b of new Set(Object.keys(en).filter((k) => /_other$/.test(k)).map(base))) {
      for (const c of cats) assert.ok(tr[`${b}_${c}`] !== undefined, `${l.code} ${b}_${c} missing`);
    }
  }
});

test('no em dashes in any interface text', () => {
  for (const l of LOCALES) {
    const raw = fs.readFileSync(path.join(RES, `${l.code}.json`), 'utf8');
    assert.ok(!raw.includes('—'), `${l.code}.json contains an em dash`);
  }
});

test('Intl plural categories used by the resource files are real for each language', () => {
  const expect = { ar: ['few', 'many', 'one', 'other', 'two', 'zero'], ru: ['few', 'many', 'one', 'other'], ja: ['other'], fr: ['many', 'one', 'other'] };
  for (const [code, cats] of Object.entries(expect)) {
    assert.deepEqual([...new Intl.PluralRules(LOCALE_BY_CODE[code].intl).resolvedOptions().pluralCategories].sort(), cats);
  }
});

test('package errors carry stable codes that the interface can translate', () => {
  const e = pkgError('damaged', 'This package is damaged', { a: 1 });
  assert.equal(e.code, 'package.damaged');
  assert.deepEqual(e.params, { a: 1 });
  assert.equal(e.message, 'This package is damaged');
  const en = load('en');
  const codes = [];
  for (const bad of ['not json', '{}', JSON.stringify({ format: 'bizsim-package', schemaVersion: 99 })]) {
    try {
      readPackage(bad);
      assert.fail('should throw');
    } catch (err) {
      assert.match(err.code, /^package\./);
      codes.push(err.code);
      assert.ok(en.errors.package[err.code.slice('package.'.length)], `no English text for ${err.code}`);
    }
  }
  for (const l of LOCALES.filter((x) => !x.variantOf && x.code !== 'en')) {
    const tr = load(l.code);
    for (const c of codes) assert.ok(tr.errors.package[c.slice(8)], `${l.code} lacks errors.${c}`);
  }
});

test('a season written in Bengali or Arabic survives the package and QR round trip byte for byte', () => {
  const c = structuredClone(CASE_BY_ID['season-c138']);
  c.id = 'gen-unicode-test';
  c.source = 'generated';
  c.contentLocale = 'bn';
  c.title = 'এম-পেসা মোবাইল মানি';
  c.situation.headline = 'বেশিরভাগ কেনিয়ানের ব্যাংক অ্যাকাউন্ট নেই। نص عربي 中文 日本語 한국어';
  const pkg = createPackage(c, { appVersion: '1.7.0' });
  const text = packageToText(pkg);
  const r = readPackage(text);
  assert.equal(r.case.title, c.title);
  assert.equal(r.case.situation.headline, c.situation.headline);
  assert.equal(r.case.contentLocale, 'bn');
  const col = new FrameCollector();
  let res;
  for (const f of packageToFrames(pkg)) res = col.add(f);
  assert.equal(res, 'complete');
  const back = readPackage(col.assemble());
  assert.equal(back.case.title, c.title);
  assert.equal(back.case.situation.headline, c.situation.headline);
});

test('notifications are written through the supplied translator, with English as the fallback', () => {
  const now = new Date('2026-11-18T08:00:00');
  const ctx = { now, curatedIds: ['season-c138'], titleOf: () => 'M-Pesa', unfinished: [{ caseId: 'season-c138', title: 'M-Pesa', lastAt: '2026-11-15T08:00:00' }], completedThisWeek: 0, days: 3 };
  const settings = { ...DEFAULT_SETTINGS, enabled: true };
  const english = planNotifications(settings, ctx);
  assert.ok(english.length > 0);
  assert.ok(english.some((n) => /Case of the Day/.test(n.title)));
  const calls = [];
  const fake = (key, opts) => (calls.push(key), `[${key}]`);
  const translated = planNotifications(settings, { ...ctx, t: fake });
  assert.equal(translated.length, english.length);
  assert.ok(translated.every((n) => /^\[notify\./.test(n.title)));
  assert.ok(calls.every((k) => k.startsWith('notify.')));
  // the keys used by the planner exist in English
  const en = flat(load('en'));
  for (const k of new Set(calls)) assert.ok(en[k] !== undefined || en[`${k}_other`] !== undefined, `missing ${k}`);
});
