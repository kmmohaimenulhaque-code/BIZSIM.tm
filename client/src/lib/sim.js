// Simulation engine: runs, decisions, company meters and the learner profile.
// Pure functions + thin store actions, independent of presentation.
import { setState, getState, uid } from './store.js';
import { CASES, CASE_BY_ID } from '@shared/cases/index.js';
import { episodesOf, currentEpisodeIndex, episodeOfDecision, episodeCount, decisionCount } from '@shared/episodes.js';
import { t } from '../i18n/index.js';

// Labels come from the localisation resources (simulation.meters.*).
export const METERS = [{ id: 'position' }, { id: 'finance' }, { id: 'resilience' }];
export const meterLabel = (id) => t(`simulation.meters.${id}`);

/** "4 episodes · 8 decisions" in the current language. */
export function seasonShapeLabel(c) {
  const e = episodeCount(c);
  const d = decisionCount(c);
  const eps = t('simulation.episodes', { count: e });
  return e === d ? eps : t('simulation.shape', { episodes: eps, decisions: t('simulation.decisions', { count: d }) });
}
const START = 50;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function findCase(id) {
  return CASE_BY_ID[id] || getState().myCases.find((c) => c.id === id) || null;
}
export function allCases() {
  return [...CASES, ...getState().myCases];
}

export function metersFor(run) {
  const m = { position: START, finance: START, resilience: START };
  for (const ch of run?.choices || []) {
    for (const k of Object.keys(m)) m[k] = clamp(m[k] + (ch.impact?.[k] || 0), 0, 100);
  }
  return m;
}

/** EWMA update: alpha = max(0.05, 1/(n+1)); new = (1-alpha)·old + alpha·(complexity·weight). */
export function updateProfile(profile, option, complexity = 1) {
  const n = profile.decisions || 0;
  const alpha = Math.max(0.05, 1 / (n + 1));
  const dims = { ...profile.dims };
  for (const [d, w] of Object.entries(option.dims || {})) {
    const target = clamp(complexity * w, -100, 100);
    dims[d] = Math.round(((1 - alpha) * (dims[d] || 0) + alpha * target) * 10) / 10;
  }
  return { decisions: n + 1, dims };
}

/** A run that is neither finished nor set aside for a replay. */
export const isOpen = (r) => Boolean(r && !r.finishedAt && !r.abandonedAt);

export function activeRun(caseId) {
  return getState().runs.find((r) => r.caseId === caseId && isOpen(r)) || null;
}
export function latestRun(caseId) {
  return getState().runs.find((r) => r.caseId === caseId) || null;
}

export function startRun(caseId) {
  const existing = activeRun(caseId);
  if (existing) return existing;
  const run = { id: uid(), caseId, startedAt: new Date().toISOString(), finishedAt: null, choices: [] };
  setState((s) => ({ ...s, runs: [run, ...s.runs].slice(0, 300) }));
  return run;
}

/**
 * Play a season again. Earlier attempts are kept (an unfinished one is set
 * aside, not deleted) so attempts can be compared.
 */
export function restartRun(caseId) {
  const prev = getState().runs.find((r) => r.caseId === caseId);
  const at = new Date().toISOString();
  const run = { id: uid(), caseId, startedAt: at, finishedAt: null, choices: [], ...(prev ? { replayOf: prev.id, mode: 'replay' } : {}) };
  setState((s) => ({
    ...s,
    runs: [run, ...s.runs.map((r) => (r.caseId === caseId && isOpen(r) ? (r.choices.length ? { ...r, abandonedAt: at } : { ...r, abandonedAt: at, empty: true }) : r)).filter((r) => !r.empty)].slice(0, 300),
  }));
  return run;
}

/** Save the learner's own reflection on a run (shown in the report). */
export function setReflection(runId, text) {
  const clean = String(text || '').slice(0, 2000);
  setState((s) => ({ ...s, runs: s.runs.map((r) => (r.id === runId ? { ...r, reflection: clean || undefined } : r)) }));
}

/** All attempts at one season, oldest first, that contain at least one decision. */
export const attemptsFor = (state, caseId) =>
  state.runs
    .filter((r) => r.caseId === caseId && r.choices.length)
    .slice()
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

// Wilson score interval for a proportion: honest uncertainty for small samples.
export function wilson(k, n, z = 1.96) {
  if (!n) return null;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const m = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}

export function recordDecision(runId, checkpoint, option) {
  setState((s) => {
    const runs = s.runs.map((r) => {
      if (r.id !== runId || r.choices.some((c) => c.checkpointId === checkpoint.id)) return r;
      return {
        ...r,
        choices: [
          ...r.choices,
          {
            checkpointId: checkpoint.id,
            optionId: option.id,
            historical: Boolean(option.historical),
            live: Boolean(checkpoint.live),
            quality: option.quality,
            impact: option.impact,
            principles: option.principles || [],
            at: new Date().toISOString(),
          },
        ],
      };
    });
    return { ...s, runs, profile: updateProfile(s.profile, option, checkpoint.complexity) };
  });
}

export function finishRun(runId) {
  setState((s) => ({ ...s, runs: s.runs.map((r) => (r.id === runId && !r.finishedAt ? { ...r, finishedAt: new Date().toISOString() } : r)) }));
}

/** Learning statistics, computed only from recorded decisions. */
export function learningStats(state) {
  const choices = state.runs.flatMap((r) => r.choices.map((c) => ({ ...c, caseId: r.caseId })));
  const completed = state.runs.filter((r) => r.finishedAt);
  const histChoices = choices.filter((c) => {
    const cs = findCase(c.caseId);
    return !c.live && cs && cs.classification !== 'HYPOTHETICAL' && !cs.checkpoints.find((k) => k.id === c.checkpointId)?.live;
  });
  const principleCounts = {};
  choices.forEach((c) => (c.principles || []).forEach((p) => (principleCounts[p] = (principleCounts[p] || 0) + 1)));
  const matched = histChoices.filter((c) => c.historical).length;
  const qualities = choices.map((c) => c.quality || 2);
  const mean = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : null;
  const sd = qualities.length > 1 ? Math.sqrt(qualities.reduce((a, q) => a + (q - mean) ** 2, 0) / (qualities.length - 1)) : null;
  const inAi = choices.filter((c) => {
    const cs = findCase(c.caseId);
    return cs && (cs.aiGenerated || cs.source === 'generated' || cs.source === 'chat');
  }).length;
  return {
    decisions: choices.length,
    casesCompleted: new Set(completed.map((r) => r.caseId)).size,
    alignment: histChoices.length ? Math.round((100 * matched) / histChoices.length) : null,
    alignmentN: histChoices.length,
    alignmentMatched: matched,
    alignmentCI: wilson(matched, histChoices.length),
    avgQuality: mean,
    qualityCI: mean != null && sd != null ? [Math.max(1, mean - (1.96 * sd) / Math.sqrt(qualities.length)), Math.min(3, mean + (1.96 * sd) / Math.sqrt(qualities.length))] : null,
    qualityCounts: { 1: qualities.filter((q) => q === 1).length, 2: qualities.filter((q) => q === 2).length, 3: qualities.filter((q) => q === 3).length },
    liveDecisions: choices.length - histChoices.length,
    aiSeasonDecisions: inAi,
    replays: state.runs.filter((r) => r.replayOf).length,
    principleCounts,
  };
}

/** "Episode II of IV · Decision 1 of 2" for the run's current position. */
export function progressLabel(c, run) {
  const eps = episodesOf(c);
  const ep = eps[currentEpisodeIndex(c, run)];
  if (!ep) return '';
  const made = new Set(run.choices.map((ch) => ch.checkpointId));
  const d = ep.decisions.findIndex((k) => !made.has(k.id));
  const last = eps[eps.length - 1].roman;
  const episode = t('simulation.episodeOf', { roman: ep.roman, n: ep.n, last, total: eps.length });
  return ep.decisions.length > 1 && d >= 0 ? t('simulation.progress', { episode, decision: t('simulation.decisionOf', { n: d + 1, total: ep.decisions.length }) }) : episode;
}


/** True once every decision of the case has been made. */
export const runComplete = (c, run) => Boolean(c && run && c.checkpoints.every((k) => run.choices.some((ch) => ch.checkpointId === k.id)));

/** "Episode II, decision 1" label for one recorded choice. */
export function decisionLabel(c, checkpointId) {
  const ep = episodeOfDecision(c, checkpointId);
  if (!ep) return '';
  const j = ep.decisions.findIndex((k) => k.id === checkpointId);
  return ep.decisions.length > 1 ? t('simulation.decisionLabel', { title: ep.title, n: j + 1 }) : ep.title;
}
