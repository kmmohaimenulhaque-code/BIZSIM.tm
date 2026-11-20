import { athens, augustus, medici, voc } from './early.js';
import { ford, intel, apple, kodak, nokia, netflix } from './modern.js';

// Ordered chronologically, from antiquity to the present.
const PILLAR = {
  'athens-silver-fleet': 'FINANCE',
  'rome-military-treasury': 'FINANCE',
  'medici-bank': 'FINANCE',
  'voc-permanent-capital': 'STRATEGY',
  'ford-model-t': 'OPERATIONS',
  'intel-exit-memory': 'STRATEGY',
  'apple-1997-turnaround': 'TURNAROUND',
  'kodak-digital': 'TURNAROUND',
  'nokia-smartphone': 'TURNAROUND',
  'netflix-streaming': 'STRATEGY',
};

import { CATALOGUE } from '../catalogue.js';
import { withEpisodes } from '../seasons/compile.js';
import { SIGNATURE_EXTRAS } from './extras.js';
import { SEASONS } from '../seasons/index.js';

const READING = Object.fromEntries(CATALOGUE.filter((e) => e.caseId).map((e) => [e.caseId, e.reading]));

const SIGNATURE = [athens, augustus, medici, voc, ford, intel, apple, kodak, nokia, netflix].map((c) => withEpisodes({
  ...c,
  pillar: PILLAR[c.id],
  reading: c.reading || READING[c.id],
  classification: c.classification || 'HISTORICAL',
  source: c.source || 'curated',
}, SIGNATURE_EXTRAS[c.id], c.id));

// All 200 built-in seasons, in catalogue order. Every season has four episodes of two decisions.
const BY_ID = Object.fromEntries([...SIGNATURE, ...SEASONS].map((c) => [c.id, c]));
export const CASES = CATALOGUE.slice()
  .sort((a, b) => a.n - b.n)
  .map((e) => BY_ID[e.caseId])
  .filter(Boolean);

export const CASE_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));

export const FEATURED_IDS = ['netflix-streaming', 'nokia-smartphone', 'athens-silver-fleet'];
