// Writes a season in two phases so every model, including ones with short
// output limits, can produce it reliably:
//   1. Frame: title, situation, concept, evidence, lessons and the four
//      episodes (title, date, turning point).
//   2. Episodes: for each episode, 2 or 3 linked decisions, each with its own
//      outcome, plus the episode's insight. Two episodes are written at a time.
// Every part goes through deterministic checks; a part that fails is retried
// down the AI key chain by completeJson.
import { completeJson } from './llm.js';
import { PRINCIPLES } from '../../../shared/books.js';
import { DIMENSIONS } from '../../../shared/dimensions.js';
import { scaleImpact } from '../../../shared/seasons/compile.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

export function principlesText() {
  return PRINCIPLES.map((p) => `${p.id}: ${p.name}: ${p.idea}`).join('\n');
}

const dimsText = () => `Dimension ids: ${DIMENSIONS.map((d) => `${d.id} (${d.left} vs ${d.right})`).join('; ')}.`;

export function frameSchemaText({ liveLast }) {
  return `JSON shape (the season frame; the decisions are written later, episode by episode):
{
  "title": string (max 6 words),
  "tagline": string (one sentence),
  "situation": { "role": string, "headline": string, "context": [string, string, string], "stakes": string },
  "concept": { "framework": string, "explanation": string (neutral, no spoilers), "principles": [principleId] },
  "evidence": [ { "label": string, "value": string, "note": string, "sourceId": "S#" } ]  (3-6 items, verbatim from the dossier),
  "episodes": [ (exactly 4, chronological; each builds on the previous)
    { "title": string (max 6 words), "dateLabel": string, "focus": string (the turning point in one or two sentences, facts from the dossier), "live": boolean } ],
  "analysis": { "summary": string, "strengths": [string], "risks": [string], "uncertainties": [string] },
  "scenarios": [ { "name": string, "description": string, "signals": [string] } ] (2-3 possible futures${liveLast ? '' : ', may be empty'}),
  "lessons": [ { "text": string, "principles": [principleId] } ] (3-4)
}`;
}

export function episodeSchemaText() {
  return `JSON shape (one episode):
{
  "decisions": [ (2 or 3 linked decisions inside this episode, in the order they were faced; a later decision may follow on from the historical choice of an earlier one)
    { "prompt": string (the question, one sentence), "context": string (2-3 sentences of what was known then, no spoilers), "complexity": 0.5-1.5,
      "outcome": { "text": string (what actually happened after this decision, 1-3 sentences), "sourceIds": ["S#"] } (omit in a live episode),
      "options": [ (exactly 3, distinct realistic choices)
        { "label": string, "summary": string, "tradeoffs": string, "risks": string, "consequence": string (likely consequence, hedged),
          "historical": boolean, "quality": 1-3 (process quality given what was known), "impact": { "position": -20..20, "finance": -20..20, "resilience": -20..20 },
          "dims": { DIMENSION_ID: -100..100 } (2-4 dimensions), "principles": [principleId] (0-3) } ] } ],
  "insight": { "text": string (the episode's lesson in 1-2 sentences, specific to what happened), "principles": [principleId] (1-2) }
}
${dimsText()}`;
}

const EPISODE_RULES = `Rules for an episode:
- Write 2 or 3 DIFFERENT decisions that belong to this turning point (for example: the strategic choice, then how to fund, staff, price or communicate it). Never repeat the same question.
- In a past episode, exactly one option per decision has "historical": true and the decision's "outcome" says what happened, citing dossier source ids.
- In a live episode, no option is historical and there is no outcome: the decisions are open questions the organisation faces now.
- Context and prompts must not reveal what happened or which option is best.
- The insight is the episode's own lesson, drawn from what happened (or, for a live episode, what to watch).`;

const asArr = (v) => (Array.isArray(v) ? v : []);

/** Check and normalise one written episode. Throws with a short reason when unusable. */
export function checkEpisode(raw, { live, sourceIds }) {
  const decisions = asArr(raw?.decisions).slice(0, 4);
  if (decisions.length < 2) throw new Error(`episode has ${decisions.length} decision(s), needs 2 or 3`);
  const out = decisions.map((k, i) => {
    const options = asArr(k?.options).slice(0, 3);
    if (options.length < 3) throw new Error(`decision ${i + 1} has ${options.length} options`);
    if (!k.prompt) throw new Error(`decision ${i + 1} has no prompt`);
    const opts = options.map((o, j) => ({ ...o, id: 'abc'[j], historical: !live && o?.historical === true }));
    const hist = opts.filter((o) => o.historical).length;
    if (!live && hist !== 1) throw new Error(`decision ${i + 1} has ${hist} historical options`);
    const src = asArr(k.outcome?.sourceIds).filter((id) => sourceIds.includes(id));
    if (!live && !(k.outcome?.text && src.length)) throw new Error(`decision ${i + 1} has no cited outcome`);
    return { prompt: k.prompt, context: k.context || '', complexity: k.complexity, options: opts, outcome: live ? null : { text: k.outcome.text, sourceIds: src } };
  });
  if (!raw?.insight?.text) throw new Error('episode has no insight');
  return { decisions: out, insight: { text: raw.insight.text, principles: asArr(raw.insight.principles) } };
}

/** Run tasks with a small concurrency limit, keeping order. */
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Write a whole season.
 * @param {object} p
 * @param {string} p.system      system prompt (sourcing rules)
 * @param {string} p.brief       subject brief and dossier text, shared by every call
 * @param {string[]} p.sourceIds dossier source ids
 * @param {(i:number,total:number)=>boolean} p.isLive which episodes are live
 * @param {(frame:object)=>void} [p.checkFrame] extra frame checks (throw to reject)
 * @param {(text:string)=>void} [p.onProgress]
 */
export async function writeSeasonParts({ system, brief, sourceIds, isLive, liveLast = false, checkFrame, onProgress }) {
  onProgress?.('Planning the four episodes');
  const frame = await completeJson({
    system,
    user: `${brief}\n\nPRINCIPLES LIBRARY (cite by id only):\n${principlesText()}\n\n${frameSchemaText({ liveLast })}`,
    maxTokens: 6000,
    validate: (v) => {
      const eps = asArr(v?.episodes).slice(0, 4);
      if (eps.length !== 4) throw new Error(`frame has ${eps.length} episodes, needs 4`);
      if (eps.some((e) => !e?.title)) throw new Error('an episode has no title');
      if (!v.situation?.headline) throw new Error('frame has no situation');
      checkFrame?.(v);
      return v;
    },
    onAttempt: ({ model, attempt, reason }) => onProgress?.(attempt === 1 ? `Planning the episodes with ${model}` : `Planning, fallback ${attempt}: ${model} (previous: ${reason})`),
  });
  const eps = frame.episodes.slice(0, 4).map((e, i) => ({ ...e, live: isLive(i, 4, e) }));
  const outline = eps.map((e, i) => `Episode ${ROMAN[i]} (${e.dateLabel || 'date as documented'}): ${e.title}. ${e.focus || ''}${e.live ? ' [LIVE: happening now]' : ''}`).join('\n');

  let done = 0;
  const models = new Set([frame.__model].filter(Boolean));
  const written = await pool(eps, 2, async (e, i) => {
    onProgress?.(`Writing episode ${ROMAN[i]} of IV: ${e.title}`);
    const value = await completeJson({
      system: `${system}\n${EPISODE_RULES}`,
      user: `${brief}\n\nSEASON: ${frame.title}\nSituation: ${frame.situation.headline}\nAll episodes:\n${outline}\n\nWRITE EPISODE ${ROMAN[i]} ONLY: "${e.title}" (${e.dateLabel || ''}). Turning point: ${e.focus || e.title}.\nThis episode is ${e.live ? 'LIVE (an open decision happening now: no historical options, no outcomes)' : 'documented history (one historical option per decision, cited outcomes)'}.\n\nPRINCIPLES LIBRARY (cite by id only):\n${principlesText()}\n\n${episodeSchemaText()}`,
      maxTokens: 6000,
      validate: (v) => checkEpisode(v, { live: e.live, sourceIds }),
      onAttempt: ({ model, attempt, reason }) => {
        if (attempt > 1) onProgress?.(`Episode ${ROMAN[i]}, fallback ${attempt}: ${model} (previous: ${reason})`);
      },
    });
    if (value.__model) models.add(value.__model);
    done++;
    onProgress?.(`Episode ${ROMAN[i]} ready (${value.decisions.length} decisions, ${done} of 4 episodes done)`);
    return value;
  });

  const checkpoints = [];
  const episodes = [];
  written.forEach((w, i) => {
    const n = i + 1;
    const e = eps[i];
    w.decisions.forEach((k, j) => {
      checkpoints.push({
        ...k,
        options: k.options.map((o) => scaleImpact({ ...o, impact: o.impact || {} })),
        id: j === 0 ? `e${n}` : `e${n}${'bcd'[j - 1]}`,
        episode: n,
        title: e.title,
        dateLabel: e.dateLabel || '',
        ...(e.live ? { live: true } : {}),
      });
    });
    episodes.push({ n, title: e.title, dateLabel: e.dateLabel || '', ...(e.live ? { live: true } : {}), insight: w.insight });
  });
  return { frame, checkpoints, episodes, model: [...models].join(' + ') };
}
