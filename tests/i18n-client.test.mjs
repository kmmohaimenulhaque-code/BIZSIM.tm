// Client localisation modules, loaded through Vite's SSR loader so the same
// code paths (aliases, import.meta.glob) run as in the app: language switching,
// formatting, translated errors, the language search, season overlays and the
// report in non-Latin scripts.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { CASE_BY_ID } from '../shared/cases/index.js';
import { LOCALES } from '../shared/locales.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let vite;
let i18nMod;
let fmt;
let caseLocale;
let lang;
let report;
let pkg;

before(async () => {
  vite = await createServer({ configFile: path.join(ROOT, 'client/vite.config.js'), server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent' });
  i18nMod = await vite.ssrLoadModule('/src/i18n/index.js');
  await i18nMod.initI18n();
  fmt = await vite.ssrLoadModule('/src/i18n/format.js');
  caseLocale = await vite.ssrLoadModule('/src/lib/caseLocale.js');
  lang = await vite.ssrLoadModule('/src/components/Language.jsx');
  report = await vite.ssrLoadModule('/src/lib/report.js');
  pkg = await vite.ssrLoadModule('@shared/package.js');
});
after(async () => {
  await i18nMod?.setLocale('en');
  await vite?.close();
});

test('starts in English without a saved choice or browser languages', () => {
  assert.equal(i18nMod.getLocale(), 'en');
  assert.equal(i18nMod.t('navigation.settings'), 'Settings');
});

test('switches language at run time, with fallback, plurals per language', async () => {
  await i18nMod.setLocale('de');
  assert.equal(i18nMod.getLocale(), 'de');
  assert.equal(i18nMod.t('navigation.settings'), 'Einstellungen');
  await i18nMod.setLocale('ru');
  // Russian has one / few / many
  const one = i18nMod.t('simulation.episodes', { count: 1 });
  const few = i18nMod.t('simulation.episodes', { count: 3 });
  const many = i18nMod.t('simulation.episodes', { count: 5 });
  assert.notEqual(one, few);
  assert.notEqual(few, many);
  assert.match(few, /3/);
  await i18nMod.setLocale('ar');
  assert.equal(i18nMod.localeDir(), 'rtl');
  const forms = new Set([0, 1, 2, 3, 11, 100].map((n) => i18nMod.t('simulation.episodes', { count: n })));
  assert.ok(forms.size >= 4, 'Arabic uses several plural forms');
  await i18nMod.setLocale('en-GB');
  assert.equal(i18nMod.t('navigation.settings'), 'Settings', 'en-GB falls back to English for keys it does not override');
  assert.match(i18nMod.t('about.license'), /licence/, 'en-GB spelling override applies');
  await i18nMod.setLocale('en');
  assert.match(i18nMod.t('about.license'), /license/);
});

test('every language loads and renders a sample of keys without leaking key names', async () => {
  const keys = ['navigation.overview', 'case.reveal.processQuality', 'learning.separate', 'language.machineNote', 'report.matched'];
  for (const l of LOCALES) {
    await i18nMod.setLocale(l.code);
    for (const k of keys) {
      const v = i18nMod.t(k, { matched: 1, total: 2 });
      assert.ok(v && v !== k, `${l.code} ${k}`);
      assert.ok(!/\{\{/.test(v), `${l.code} ${k} left a placeholder`);
    }
  }
  await i18nMod.setLocale('en');
});

test('rejects unknown languages and keeps the current one', async () => {
  await i18nMod.setLocale('fr');
  await assert.rejects(() => i18nMod.setLocale('xx'));
  assert.equal(i18nMod.getLocale(), 'fr');
  await i18nMod.setLocale('en');
});

test('formatting follows the language without changing values', async () => {
  await i18nMod.setLocale('de');
  assert.equal(fmt.formatInteger(1234567), '1.234.567');
  assert.match(fmt.formatCurrency(1500, 'USD'), /\$/);
  await i18nMod.setLocale('bn');
  assert.match(fmt.formatInteger(200), /২০০/);
  await i18nMod.setLocale('en-GB');
  assert.match(fmt.formatDate('2026-03-04T12:00:00Z'), /^4 Mar/);
  await i18nMod.setLocale('en');
  assert.match(fmt.formatDate('2026-03-04T12:00:00Z'), /^Mar 4/);
  assert.equal(fmt.formatList(['a', 'b', 'c']), 'a, b, and c');
  await i18nMod.setLocale('ja');
  assert.equal(fmt.languageName('de'), 'ドイツ語');
  await i18nMod.setLocale('en');
  assert.equal(fmt.formatNumber(NaN), '');
});

test('package errors are shown in the interface language', async () => {
  let e;
  try {
    pkg.readPackage('not json');
  } catch (x) {
    e = x;
  }
  assert.equal(i18nMod.errorText(e), 'This file is not a BIZSIM package (it is not valid JSON).');
  await i18nMod.setLocale('es');
  const es = i18nMod.errorText(e);
  assert.notEqual(es, e.message);
  assert.match(es, /BIZSIM/);
  assert.equal(i18nMod.errorText(new Error('plain')), 'plain');
  await i18nMod.setLocale('en');
});

test('language search matches native names, English names and codes, ignoring accents and case', () => {
  const find = (q) => LOCALES.filter((l) => lang.matchesLanguage(l, q)).map((l) => l.code);
  assert.deepEqual(find('deutsch'), ['de']);
  assert.deepEqual(find('German'), ['de']);
  assert.ok(find('bangla').length === 0 || find('bangla').includes('bn'));
  assert.deepEqual(find('বাংলা'), ['bn']);
  assert.deepEqual(find('Bengali'), ['bn']);
  assert.deepEqual(find('francais'), ['fr']);
  assert.deepEqual(find('turkce'), ['tr']);
  assert.ok(find('ur').includes('ur'));
  assert.deepEqual(find('urdu'), ['ur']);
  assert.deepEqual(find('العربية'), ['ar']);
  assert.ok(find('english').includes('en') && find('english').includes('en-GB'));
  assert.deepEqual(find('UK'), ['en-GB']);
  assert.equal(find('').length, LOCALES.length);
  assert.deepEqual(find('klingon'), []);
});

test('season overlays translate text but never ids, scores, sources or historical flags', async () => {
  const c = CASE_BY_ID['season-c138'];
  assert.ok(caseLocale.hasOverlay('bn', 'season-c138'));
  assert.ok(caseLocale.hasOverlay('es', 'season-c138'));
  assert.ok(!caseLocale.hasOverlay('de', 'season-c138'));
  const ov = await caseLocale.loadOverlay('bn', 'season-c138');
  assert.equal(ov.status, 'machine');
  const x = caseLocale.applyOverlay(c, ov, 'bn');
  assert.equal(x.title, 'এম-পেসা মোবাইল মানি');
  assert.equal(x.contentLocale, 'bn');
  assert.equal(x.contentTranslation.status, 'machine');
  assert.equal(x.contentTranslation.stale, false, 'overlay matches the current English text');
  assert.equal(caseLocale.contentLangOf(x), 'bn');
  assert.equal(x.id, c.id);
  assert.deepEqual(x.sources, c.sources);
  assert.equal(x.checkpoints.length, c.checkpoints.length);
  x.checkpoints.forEach((k, i) => {
    const o = c.checkpoints[i];
    assert.equal(k.id, o.id);
    k.options.forEach((opt, j) => {
      const src = o.options[j];
      assert.equal(opt.id, src.id);
      assert.equal(opt.historical, src.historical);
      assert.deepEqual(opt.impact, src.impact);
      assert.deepEqual(opt.quality, src.quality);
      assert.deepEqual(opt.dimensions, src.dimensions);
    });
  });
  assert.equal(c.title, 'M-Pesa Mobile Money', 'the English original is untouched');
  // A change to the English text marks the translation as possibly outdated
  const edited = structuredClone(c);
  edited.checkpoints[0].prompt = 'Changed English prompt';
  assert.equal(caseLocale.applyOverlay(edited, ov, 'bn').contentTranslation.stale, true);
  // Empty or malformed overlay fields fall back to English
  const partial = caseLocale.applyOverlay(c, { caseId: c.id, fields: { title: '', checkpoints: { e1: { prompt: 7 } } } }, 'bn');
  assert.equal(partial.title, c.title);
  assert.equal(partial.checkpoints[0].prompt, c.checkpoints[0].prompt);
  assert.deepEqual(caseLocale.translatedIds('bn'), ['season-c138']);
});

test('report: Latin-script languages use the built-in PDF fonts, other scripts use the HTML route', async () => {
  const c = CASE_BY_ID['season-c138'];
  const run = { caseId: c.id, startedAt: '2026-11-18T08:00:00Z', choices: [{ checkpointId: 'e1', optionId: 'a', quality: 3 }, { checkpointId: 'e2', optionId: 'b', quality: 1 }], reflection: 'Watch users. ব্যবহারকারী.' };
  const lib = { principleById: {} };
  for (const [code, builtIn] of [['en', true], ['es', true], ['de', true], ['bn', false], ['ar', false], ['ja', false], ['ru', false]]) {
    // the Bengali reflection makes every report non-Latin; use an English one for this check
    run.reflection = code === 'bn' ? 'ব্যবহারকারী' : 'Watch users.';
    await i18nMod.setLocale(code);
    let blocks;
    try {
      blocks = report.reportBlocks(c, run, { lib });
    } catch (e) {
      assert.fail(`${code}: ${e.message}`);
    }
    assert.ok(blocks.length > 5);
    assert.ok(blocks.some((b) => b.text.includes(c.checkpoints[0].options[0].label)), `${code}: your call is listed`);
    assert.equal(report.canUseBuiltInPdf(blocks), builtIn, code);
  }
  await i18nMod.setLocale('ar');
  const html = await report.renderHtml(report.reportBlocks(c, run, { lib }), { locale: 'ar', title: 'x' });
  assert.match(html, /dir="rtl"/);
  assert.match(html, /lang="ar"/);
  assert.match(html, /Content-Security-Policy/);
  assert.ok(!/<script/i.test(html), 'the report contains no scripts');
  await i18nMod.setLocale('en');
});
