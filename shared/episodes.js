// Seasons are made of episodes; each episode holds 2 to 4 decisions and ends
// with its own outcome and insight. Decisions are stored flat in
// case.checkpoints (each tagged with its episode number) so saved runs, which
// record choices by checkpoint id, keep working. Older cases without
// case.episodes are read as one decision per episode.

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Group a case's decisions into episodes. */
export function episodesOf(c) {
  const ks = c?.checkpoints || [];
  if (!Array.isArray(c?.episodes) || !c.episodes.length) {
    return ks.map((k, i) => ({
      n: i + 1,
      roman: ROMAN[i] || String(i + 1),
      title: k.title,
      dateLabel: k.dateLabel,
      live: Boolean(k.live),
      insight: null,
      decisions: [k],
      legacy: true,
    }));
  }
  return c.episodes
    .map((e, i) => {
      const n = e.n || i + 1;
      return {
        ...e,
        n,
        roman: ROMAN[n - 1] || String(n),
        live: Boolean(e.live) || ks.some((k) => k.episode === n && k.live),
        decisions: ks.filter((k) => (k.episode || 1) === n),
      };
    })
    .filter((e) => e.decisions.length);
}

/** The episode a decision belongs to. */
export function episodeOfDecision(c, checkpointId) {
  return episodesOf(c).find((e) => e.decisions.some((k) => k.id === checkpointId)) || null;
}

export const episodeCount = (c) => episodesOf(c).length;
export const decisionCount = (c) => (c?.checkpoints || []).length;

/** "4 episodes · 9 decisions" style summary. */
export function seasonShape(c) {
  const e = episodeCount(c);
  const d = decisionCount(c);
  return e === d ? `${e} episode${e === 1 ? '' : 's'}` : `${e} episodes · ${d} decisions`;
}

/** Episode-level outcome: the outcomes of its decisions, in order. */
export function episodeOutcome(ep) {
  const parts = ep.decisions.filter((k) => k.outcome?.text);
  return {
    text: parts.map((k) => k.outcome.text).join(' '),
    sourceIds: [...new Set(parts.flatMap((k) => k.outcome.sourceIds || []))],
    parts: parts.map((k) => ({ id: k.id, text: k.outcome.text, sourceIds: k.outcome.sourceIds || [] })),
  };
}

/** The episode a run is currently on (1-based index into episodesOf). */
export function currentEpisodeIndex(c, run) {
  const eps = episodesOf(c);
  const made = new Set((run?.choices || []).map((ch) => ch.checkpointId));
  const i = eps.findIndex((e) => e.decisions.some((k) => !made.has(k.id)));
  return i === -1 ? eps.length - 1 : i;
}
