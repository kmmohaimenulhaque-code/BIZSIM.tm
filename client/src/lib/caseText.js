// Plain-text versions of each case step, for the voice reader.
import { libraryNow } from './library.js';

const join = (...parts) => parts.flat().filter(Boolean).join(' ');
const principle = (id) => {
  const lib = libraryNow();
  const p = lib.principleById[id];
  return p ? `${p.name}, from ${lib.bookOf(p).title}: ${p.idea}` : '';
};

export const situationText = (c) =>
  join(`${c.title}.`, c.tagline, `${c.company}, ${c.yearLabel}.`, c.situation.role, c.situation.headline, c.situation.context, c.situation.stakes);

export const conceptText = (c) => join(`Concept: ${c.concept.framework}.`, c.concept.explanation, (c.concept.principles || []).map(principle));

export const evidenceText = (c) =>
  join('Evidence: what was known at the time.', (c.evidence || []).map((e) => `${e.label}: ${e.value}. ${e.note || ''}`));

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six'];

export function checkpointText(c, k, choice, index = 0, ep = null) {
  const options = k.options.map((o, i) => `Option ${i + 1}: ${o.label}. ${o.summary}`);
  const di = ep ? ep.decisions.findIndex((x) => x.id === k.id) : -1;
  const head = ep && ep.decisions.length > 1
    ? `Episode ${WORDS[ep.n - 1] || ep.n}: ${ep.title}, ${k.dateLabel}. Decision ${WORDS[di] || di + 1} of ${WORDS[ep.decisions.length - 1] || ep.decisions.length}.`
    : `Episode ${WORDS[index] || index + 1}: ${k.title}, ${k.dateLabel}.`;
  const base = join(head, k.context, k.prompt, options);
  if (!choice) return base;
  const o = k.options.find((x) => x.id === choice.optionId);
  const hist = k.options.find((x) => x.historical);
  const after = k.live || c.classification === 'HYPOTHETICAL' ? 'This decision is still unfolding. Analysis.' : choice.historical ? 'You matched history.' : `History chose: ${hist?.label || ''}.`;
  return join(base, `You chose: ${o?.label}.`, after, o ? `Likely consequence: ${o.consequence}` : '');
}

export function episodeOutcomeText(c, ep, outcome) {
  const live = ep.live || c.classification === 'HYPOTHETICAL';
  return join(`Episode ${WORDS[ep.n - 1] || ep.n} outcome.`, live ? 'This episode is still unfolding.' : outcome.text, ep.insight?.text ? `Insight: ${ep.insight.text}` : '');
}

export const outcomeText = (c) => join('Outcome.', c.outcome.summary, c.outcome.secondOrder || [], c.outcome.baseRate);

export const insightText = (c) => join('Lessons.', c.outcome.lessons.map((l) => l.text), c.reading ? `Recommended reading: ${c.reading}.` : '');
