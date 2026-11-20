// What kind of account a season is. Shown on every season so learners never
// mistake a scriptural narrative, a live scenario or a counterfactual for
// documented history. Classification is metadata only: the stories themselves
// are not rewritten.

export const CONTENT_CLASSES = {
  documented: {
    label: 'Documented history',
    short: 'Documented',
    help: 'Events recorded in historical sources. Outcomes come from the cited references; check them for detail and scholarly debate.',
  },
  scriptural: {
    label: 'Scriptural narrative',
    short: 'Scriptural',
    help: 'A narrative from religious scripture (for example the Bible and the Quran), presented as told in those texts. It is used for its decision lessons; it is not presented as independently verified history.',
  },
  live: {
    label: 'Live business scenario',
    short: 'Live',
    help: 'Built from current, public information. The final episode is unresolved: its assessments are analysis, not known results.',
  },
  counterfactual: {
    label: 'Counterfactual analysis',
    short: 'Counterfactual',
    help: 'Explores what might have happened under different choices. Consequences of non-historical options are reasoned estimates, not records.',
  },
};

// Seasons whose source narrative is scripture. Their text already says so; this
// makes the classification explicit and visible.
const SCRIPTURAL = new Set(['season-c155', 'season-c156']);

// Seasons where the documented record is thin or rests on tradition: shown as a
// caution next to the classification.
export const EVIDENCE_NOTES = {
  'season-c161': 'Much of what is known about Queen Amina of Zazzau comes from oral tradition and chronicles written down centuries later. Historians differ on dates and details.',
};

export function contentClassOf(c) {
  if (!c) return 'documented';
  if (c.contentClass && CONTENT_CLASSES[c.contentClass]) return c.contentClass;
  if (SCRIPTURAL.has(c.id)) return 'scriptural';
  if (c.classification === 'HYPOTHETICAL') return 'counterfactual';
  if (c.classification === 'LIVE' || (c.episodes || []).some((e) => e.live)) return 'live';
  return 'documented';
}

/** True when the season text was written by an AI model (live research or chat builder). */
export const isAiGenerated = (c) => Boolean(c && (c.aiGenerated || c.source === 'generated' || c.source === 'chat' || c.model));

export const evidenceNoteOf = (c) => (c && (c.evidenceNote || EVIDENCE_NOTES[c.id])) || null;

/**
 * Label for an option's consequence. Only the option that happened has a
 * recorded outcome; every other consequence is a counterfactual estimate.
 */
export function consequenceKind(c, checkpoint, option) {
  if (checkpoint?.live || !checkpoint?.outcome) return 'analysis';
  if (contentClassOf(c) === 'scriptural') return option?.historical ? 'narrative' : 'counterfactual';
  return option?.historical ? 'recorded' : 'counterfactual';
}

export const CONSEQUENCE_LABEL = {
  recorded: 'Consequence on the path history took',
  narrative: 'As the narrative tells it',
  counterfactual: 'Counterfactual estimate',
  analysis: 'Analysis of an open decision',
};
