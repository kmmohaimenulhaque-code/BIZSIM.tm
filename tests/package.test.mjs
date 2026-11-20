import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, CASE_BY_ID } from '../shared/cases/index.js';
import { createPackage, readPackage, packageToText, packageToFrames, FrameCollector, duplicateStatus, digestOf, episodeSlice, parsePackageFrame, MAX_PACKAGE_BYTES } from '../shared/package.js';
import { episodesOf } from '../shared/episodes.js';

const builtInIds = new Set(CASES.map((c) => c.id));
const aiCase = () => {
  const c = structuredClone(CASE_BY_ID['season-c010']);
  c.id = 'gen-nokia-abc123';
  c.source = 'generated';
  c.model = 'gemini-test';
  c.classification = 'LIVE';
  c.checkpoints[c.checkpoints.length - 1].live = true;
  delete c.checkpoints[c.checkpoints.length - 1].outcome;
  c.checkpoints[c.checkpoints.length - 1].options.forEach((o) => delete o.historical);
  return c;
};

test('round trip: season, episode, AI case; no secrets inside', () => {
  for (const c of [CASE_BY_ID['season-c001'], aiCase()]) {
    const pkg = createPackage(c, { appVersion: '1.6.0' });
    const text = packageToText(pkg);
    const keys = new Set();
    const walk = (v) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (keys.add(k), walk(x));
    };
    walk(JSON.parse(text));
    const bad = [...keys].filter((k) => /key|password|token|secret|credential|pairing|session|profile|^runs$|device|email|user/i.test(k));
    assert.deepEqual(bad, [], 'no secret or personal fields');
    assert.ok(!/AIza|sk-ant|nvapi-/.test(text));
    const r = readPackage(text);
    assert.equal(r.case.id, c.id);
    assert.equal(r.case.checkpoints.length, c.checkpoints.length);
    assert.equal(pkg.integrity.digest, digestOf(pkg.content));
    if (c.source === 'generated') {
      assert.equal(pkg.kind, 'ai-case');
      assert.equal(pkg.ai.generated, true);
      assert.equal(r.case.aiGenerated, true);
      assert.equal(pkg.classification, 'live');
    } else assert.equal(pkg.kind, 'season');
  }
  const c = CASE_BY_ID['season-c020'];
  const eps = episodesOf(c);
  const pkg = createPackage(c, { episode: 2 });
  assert.equal(pkg.kind, 'episode');
  const r = readPackage(packageToText(pkg));
  assert.equal(r.case.checkpoints.length, eps[1].decisions.length);
  assert.equal(r.case.episodes.length, 1);
  assert.ok(r.case.checkpoints.every((k) => k.episode === 1));
  assert.equal(r.pkg.origin.caseId, c.id);
  assert.ok(episodeSlice(c, 2).id.endsWith('.ep2'));
});

test('every curated season exports, and every episode of a sample exports', () => {
  for (const c of CASES) readPackage(packageToText(createPackage(c)));
  for (const c of CASES.slice(0, 30)) for (const e of episodesOf(c)) readPackage(packageToText(createPackage(c, { episode: e.n })));
});

test('single and multipart QR, any order, repeats, missing parts, resume', () => {
  const pkg = createPackage(CASE_BY_ID['season-c050']);
  const frames = packageToFrames(pkg);
  assert.ok(frames.length > 3, `multipart (${frames.length} frames)`);
  const col = new FrameCollector();
  const order = frames.map((_, i) => i).reverse();
  for (const i of order.slice(0, -1)) assert.equal(col.add(frames[i]), 'added');
  assert.equal(col.add(frames[order[0]]), 'duplicate');
  assert.deepEqual(col.missing, [order[order.length - 1]]);
  assert.throws(() => col.assemble(), /missing 1/);
  // resume from saved state
  const resumed = new FrameCollector(JSON.parse(JSON.stringify(col.toJSON())));
  assert.equal(resumed.add(frames[order[order.length - 1]]), 'complete');
  const r = readPackage(resumed.assemble());
  assert.equal(r.case.id, 'season-c050');

  const small = createPackage(episodeSlice(CASE_BY_ID['season-c001'], 1));
  const f1 = packageToFrames(small);
  const c1 = new FrameCollector();
  let last;
  for (const f of f1) last = c1.add(f);
  assert.equal(last, 'complete');
  readPackage(c1.assemble());
});

test('frames from another package, corrupted frames, junk', () => {
  const a = packageToFrames(createPackage(CASE_BY_ID['season-c001']));
  const b = packageToFrames(createPackage(CASE_BY_ID['season-c002']));
  const col = new FrameCollector();
  col.add(a[0]);
  assert.equal(col.add(b[1]), 'other-package');
  const bad = a[1].slice(0, -3) + (a[1].endsWith('AAA') ? 'BBB' : 'AAA');
  assert.equal(col.add(bad), 'corrupt');
  assert.equal(col.add('BZS1|abc|0|1|xyz'), 'invalid');
  assert.equal(col.add('hello'), 'invalid');
  assert.equal(parsePackageFrame('BZP1|abcdef12|5|3|000000|AAAA'), null, 'index beyond total');
});

test('corrupted, tampered, oversized, unsupported and malformed packages are rejected', () => {
  const pkg = createPackage(CASE_BY_ID['season-c001']);
  const tampered = structuredClone(pkg);
  tampered.content.case.checkpoints[0].outcome.text = 'Something else happened.';
  assert.throws(() => readPackage(JSON.stringify(tampered)), /damaged/);
  assert.throws(() => readPackage(packageToText(pkg).slice(0, 500)), /not valid JSON/);
  assert.throws(() => readPackage(JSON.stringify({ ...pkg, schemaVersion: 9 })), /newer BIZSIM/);
  assert.throws(() => readPackage(JSON.stringify({ ...pkg, format: 'x' })), /not a BIZSIM package/);
  assert.throws(() => readPackage(JSON.stringify({ ...pkg, kind: 'malware' })), /unsupported kind/);
  assert.throws(() => readPackage(JSON.stringify({ ...pkg, id: '../../x' })), /invalid id/);
  const { integrity, ...noIntegrity } = pkg;
  void integrity;
  assert.throws(() => readPackage(JSON.stringify(noIntegrity)), /missing its integrity/);
  assert.throws(() => readPackage('x'.repeat(MAX_PACKAGE_BYTES + 1)), /too large/);
  // a valid digest over hostile content still goes through the sanitiser
  const hostile = structuredClone(pkg);
  hostile.content.case.sources[0].url = 'javascript:alert(1)';
  hostile.content.case.title = '<img src=x onerror=alert(1)>';
  hostile.integrity.digest = digestOf(hostile.content);
  hostile.extra = 1;
  const r = readPackage(JSON.stringify(hostile));
  assert.ok(r.case.sources.every((s) => /^https?:/.test(s.url)));
  assert.equal(r.case.title, '<img src=x onerror=alert(1)>', 'kept as plain text; React renders it as text');
  assert.ok(r.warnings.some((w) => /unsupported fields/.test(w)));
});

test('duplicate detection and progress preservation', () => {
  const c = aiCase();
  const r = readPackage(packageToText(createPackage(c)));
  assert.equal(duplicateStatus(r.case, { builtInIds, myCases: [] }).status, 'new');
  assert.equal(duplicateStatus(r.case, { builtInIds, myCases: [{ ...c, importedAt: 'x' }] }).status, 'identical');
  const changed = structuredClone(c);
  changed.title = 'Different';
  assert.equal(duplicateStatus(r.case, { builtInIds, myCases: [changed] }).status, 'conflict');
  const builtin = readPackage(packageToText(createPackage(CASE_BY_ID['season-c001']))).case;
  assert.equal(duplicateStatus(builtin, { builtInIds, myCases: [] }).status, 'builtin');
});
