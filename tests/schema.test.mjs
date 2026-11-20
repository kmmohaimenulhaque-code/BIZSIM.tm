import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from '../shared/cases/index.js';
import { sanitizeCase, sanitizeRun } from '../shared/caseSchema.js';
import { sanitizeState } from '../shared/stateSchema.js';
import { contentClassOf, consequenceKind, evidenceNoteOf } from '../shared/contentClass.js';

test('content counts and unique ids', () => {
  assert.equal(CASES.length, 200);
  assert.equal(new Set(CASES.map((c) => c.id)).size, 200);
  for (const c of CASES) {
    const ids = c.checkpoints.map((k) => k.id);
    assert.equal(new Set(ids).size, ids.length, `${c.id} decision ids unique`);
    const eps = new Set(c.checkpoints.map((k) => k.episode));
    for (const e of eps) {
      const n = c.checkpoints.filter((k) => k.episode === e).length;
      assert.ok(n >= 2 && n <= 4, `${c.id} episode ${e} has ${n} decisions`);
    }
  }
});

test('every curated season survives the import sanitiser unchanged in substance', () => {
  for (const c of CASES) {
    const r = sanitizeCase(c);
    assert.ok(r.ok, `${c.id}: ${r.errors.join('; ')}`);
    assert.equal(r.value.checkpoints.length, c.checkpoints.length, c.id);
    assert.equal(r.value.sources.length, c.sources.length, c.id);
    for (const [i, k] of c.checkpoints.entries()) {
      assert.equal(r.value.checkpoints[i].options.length, k.options.length);
      assert.equal(r.value.checkpoints[i].outcome?.text, k.outcome?.text);
      assert.equal(r.value.checkpoints[i].options.find((o) => o.historical)?.id, k.options.find((o) => o.historical)?.id);
    }
  }
});

test('sanitiser rejects or neutralises hostile input', () => {
  const base = structuredClone(CASES[0]);
  base.id = 'imp-1';
  base.sources[0].url = 'javascript:alert(1)';
  base.sources.push({ id: 'S9', url: 'https://ok.example/x', title: 'ok' });
  base.title = 'Hello\u0000<script>alert(1)</script>‮';
  base.checkpoints[0].options[0].quality = 99;
  base.checkpoints[0].options[0].impact = { position: 1e9 };
  base.checkpoints[0].options[0].onclick = 'evil()';
  base.__proto__polluted = { a: 1 };
  const r = sanitizeCase(base);
  assert.ok(r.ok, r.errors.join(';'));
  assert.ok(!r.value.sources.some((s) => s.url.startsWith('javascript')));
  assert.ok(!/[\u0000‮]/.test(r.value.title));
  assert.equal(r.value.checkpoints[0].options[0].quality, 3);
  assert.equal(r.value.checkpoints[0].options[0].impact.position, 20);
  assert.equal(r.value.checkpoints[0].options[0].onclick, undefined);
  assert.equal(r.value.__proto__polluted, undefined);

  assert.equal(sanitizeCase(null).ok, false);
  assert.equal(sanitizeCase([]).ok, false);
  assert.equal(sanitizeCase({ id: '../../etc', title: 'x', company: 'y' }).ok, false);
  const huge = structuredClone(CASES[0]);
  huge.situation.context = Array(5000).fill('x'.repeat(200));
  assert.equal(sanitizeCase(huge).ok, false, 'oversized');
  const dup = structuredClone(CASES[0]);
  dup.checkpoints[1].id = dup.checkpoints[0].id;
  assert.equal(sanitizeCase(dup).ok, false, 'duplicate decision ids');
  const twoHist = structuredClone(CASES[0]);
  twoHist.checkpoints[0].options.forEach((o) => (o.historical = true));
  assert.equal(sanitizeCase(twoHist).ok, false);
});

test('backup validation: version, junk and partial damage', () => {
  assert.equal(sanitizeState({ app: 'X', version: 1 }).ok, false);
  assert.equal(sanitizeState({ app: 'BIZSIM', version: 2 }).ok, false);
  assert.equal(sanitizeState('x').ok, false);
  const good = structuredClone(CASES[1]);
  good.id = 'gen-ok';
  good.source = 'generated';
  const r = sanitizeState({
    app: 'BIZSIM',
    version: 1,
    theme: 'neon',
    profile: { decisions: 5, dims: { RISK: 500 } },
    runs: [{ id: 'r1', caseId: 'season-c001', choices: [{ checkpointId: 'e1', optionId: 'a', quality: 3, principles: ['x'] }] }, { id: 'bad' }, 42],
    myCases: [good, { title: 'Broken' }],
    savedCompanies: [{ id: 'n', name: 'Nokia', website: 'javascript:x' }],
    caseImages: { 'season-c001': { url: 'javascript:alert(1)' }, 'season-c002': { url: '/generated/a.png' } },
    library: { books: [{ id: 'u-b', title: 'Book' }], principles: [{ id: 'u-p', name: 'P', tags: ['a'] }], tags: { 'season-c001': { tags: ['t'], principles: ['u-p'] } } },
    collections: [{ id: 'c1', name: 'Mine', items: [{ type: 'season', id: 'season-c001' }, { type: 'season', id: 'season-c001' }, { type: 'evil', id: 'x' }] }],
  });
  assert.ok(r.ok);
  assert.equal(r.value.theme, null);
  assert.equal(r.value.runs.length, 1);
  assert.equal(r.value.myCases.length, 1);
  assert.equal(r.value.myCases[0].aiGenerated, true);
  assert.deepEqual(r.report.droppedCases, ['Broken']);
  assert.equal(r.value.savedCompanies[0].website, undefined);
  assert.equal(r.value.caseImages['season-c001'], undefined);
  assert.equal(r.value.caseImages['season-c002'].url, '/generated/a.png');
  assert.equal(r.value.collections[0].items.length, 1, 'duplicates and unknown types removed');
  assert.ok(r.value.profile.dims.RISK === undefined || r.value.profile.dims.RISK <= 100);
});

test('runs keep their decisions', () => {
  const r = sanitizeRun({ id: 'a', caseId: 'season-c010', startedAt: 'x', finishedAt: null, choices: [{ checkpointId: 'e1', optionId: 'b', historical: false, quality: 2, impact: { position: 3, finance: -2, resilience: 1 }, principles: ['p1'], at: 't' }] });
  assert.equal(r.choices.length, 1);
  assert.equal(r.choices[0].historical, false);
  assert.equal(sanitizeRun({ id: 'a', caseId: '<x>' }), null);
});

test('content classes', () => {
  const byId = Object.fromEntries(CASES.map((c) => [c.id, c]));
  assert.equal(contentClassOf(byId['season-c155']), 'scriptural');
  assert.equal(contentClassOf(byId['season-c156']), 'scriptural');
  assert.equal(contentClassOf(byId['season-c001']), 'documented');
  assert.ok(evidenceNoteOf(byId['season-c161']));
  assert.equal(contentClassOf({ classification: 'LIVE' }), 'live');
  assert.equal(contentClassOf({ classification: 'HYPOTHETICAL' }), 'counterfactual');
  const c = byId['season-c001'];
  const k = c.checkpoints[0];
  assert.equal(consequenceKind(c, k, k.options.find((o) => o.historical)), 'recorded');
  assert.equal(consequenceKind(c, k, k.options.find((o) => !o.historical)), 'counterfactual');
  assert.equal(consequenceKind(c, { live: true }, {}), 'analysis');
});
