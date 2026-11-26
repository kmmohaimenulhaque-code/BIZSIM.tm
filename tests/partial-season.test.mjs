import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCase } from '../shared/validate.js';
import { sanitizeCase } from '../shared/caseSchema.js';

function makeDecision(id, ep) {
  return {
    id,
    episode: ep,
    title: `Episode ${ep}`,
    dateLabel: `199${ep}`,
    prompt: `What strategic move should leadership make in episode ${ep}?`,
    context: 'Board members face competing capital allocation priorities.',
    complexity: 1,
    options: [
      { id: 'a', label: 'Preserve brand independence', summary: 'Keep luxury positioning.', tradeoffs: 'Higher unit cost.', risks: 'Slow volume growth.', consequence: 'Protects margins.', historical: true, quality: 3, impact: { position: 8, finance: 2, resilience: 6 }, dims: {}, principles: [] },
      { id: 'b', label: 'Share mass-market platforms', summary: 'Cut cost aggressively.', tradeoffs: 'Dilutes brand equity.', risks: 'Customer backlash.', consequence: 'Short-term savings.', historical: false, quality: 2, impact: { position: -4, finance: 8, resilience: -2 }, dims: {}, principles: [] },
      { id: 'c', label: 'Exit segment entirely', summary: 'Divest the brand.', tradeoffs: 'Loses luxury foothold.', risks: 'Write-down loss.', consequence: 'Frees capital.', historical: false, quality: 1, impact: { position: -10, finance: 4, resilience: 0 }, dims: {}, principles: [] },
    ],
    outcome: { text: 'Management pursued a hybrid integration plan.', sourceIds: ['S1'] },
  };
}

function makePartialCandidate(epCount = 3) {
  const checkpoints = [];
  const episodes = [];
  for (let n = 1; n <= epCount; n++) {
    checkpoints.push(makeDecision(`e${n}`, n), makeDecision(`e${n}b`, n));
    episodes.push({ n, title: `Turning Point ${n}`, dateLabel: `199${n}`, insight: { text: `Lesson from episode ${n}.`, principles: [] } });
  }
  return {
    id: 'chat-jaguar-cars-test',
    title: 'Jaguar Under Ford',
    company: 'Jaguar Cars',
    tagline: 'Integrating a luxury marque into a volume automaker.',
    yearLabel: '1989-2008',
    yearSort: 1989,
    era: 'MODERN',
    domain: 'STRATEGY',
    pillar: 'STRATEGY',
    scale: 'ENTERPRISE',
    difficulty: 2,
    minutes: 20,
    classification: 'HISTORICAL',
    source: 'chat',
    sources: [{ id: 'S1', title: 'Wikipedia: Jaguar Cars', publisher: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Jaguar_Cars', type: 'Reference' }],
    situation: { headline: 'Ford acquires Jaguar in 1989.', context: ['Jaguar struggled with quality and capital needs.'], role: 'CEO', stakes: 'Brand survival' },
    concept: { framework: 'Post-merger integration', explanation: 'Balancing scale economies with brand heritage.', principles: [] },
    evidence: [{ label: 'Acquisition price', value: '$2.5B', note: '1989 purchase', sourceId: 'S1' }],
    checkpoints,
    episodes,
    outcome: { summary: 'Ford sold Jaguar to Tata Motors in 2008.', secondOrder: [], baseRate: 'AI-built from Wikipedia.', lessons: [] },
    partial: {
      completedEpisodes: epCount,
      plannedEpisodes: 4,
      failedEpisodes: [{ episode: 4, roman: 'IV', title: 'Divestiture to Tata', error: 'All fallback models timed out (429/413).' }],
      message: `Delivered ${epCount} of 4 episodes. Episode IV could not be completed after all AI fallbacks exhausted.`,
    },
  };
}

test('validateCase accepts a 3-episode partial season when episodes matches completedCount, while still rejecting < 4 when episodes: 4', () => {
  const c = makePartialCandidate(3);
  const partialCheck = validateCase(c, { requireHistorical: true, episodes: 3 });
  assert.equal(partialCheck.ok, true, `Expected partial season to pass: ${partialCheck.errors.join('; ')}`);

  const strictFullCheck = validateCase(c, { requireHistorical: true, episodes: 4 });
  assert.equal(strictFullCheck.ok, false);
  assert.ok(strictFullCheck.errors.some((e) => /expected 4 episodes, got 3/.test(e)));
});

test('sanitizeCase preserves partial season metadata cleanly for storage and backup/restore', () => {
  const c = makePartialCandidate(3);
  const res = sanitizeCase(c);
  assert.equal(res.ok, true, `Expected sanitizeCase to pass: ${res.errors.join('; ')}`);
  assert.equal(res.value.partial.completedEpisodes, 3);
  assert.equal(res.value.partial.plannedEpisodes, 4);
  assert.equal(res.value.partial.failedEpisodes.length, 1);
  assert.equal(res.value.partial.failedEpisodes[0].roman, 'IV');
  assert.match(res.value.partial.message, /Delivered 3 of 4 episodes/);
});
