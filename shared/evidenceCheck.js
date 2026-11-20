// Evidence checks: how well a claim is supported by the text of the sources it cites.
//
// This is deliberately modest. It checks whether the claim's specific details
// (years, figures and proper names) appear in the cited source text. A pass
// means "the source says these things too", not "this is historically true".
// It never upgrades a claim on the strength of a source merely existing.

export const EVIDENCE = {
  verified: {
    label: 'Verified against source',
    short: 'Checked',
    help: 'An automated check found the claim’s key dates, figures and names in the cited source text. This shows the source supports these details; it does not prove the history.',
  },
  available: {
    label: 'Source available, claim not independently verified',
    short: 'Not verified',
    help: 'The cited source was reachable, but not enough of the claim’s specific details were found in it to call it verified. Read the source before relying on the claim.',
  },
  inaccessible: {
    label: 'Reference inaccessible',
    short: 'Source unreachable',
    help: 'The cited source could not be retrieved when it was last checked.',
  },
  insufficient: {
    label: 'Insufficient evidence',
    short: 'No source',
    help: 'This claim cites no source, so it has no supporting evidence in BIZSIM.',
  },
  unchecked: {
    label: 'Not yet checked',
    short: 'Unchecked',
    help: 'This claim has not been compared with its sources yet.',
  },
};

const STOP = new Set(
  'the a an and or but of in on at to for from by with as after before during when while then this that these those his her their its our your he she they it we you was were is are be been being has have had which who whom whose what where why how than into over under about between against through without within upon also only more most less least many much some such both each other another any all no not nor so very can could would should may might must will shall did does do done one two three four five six seven eight nine ten first second third last next new old great early late later earlier year years century centuries king queen emperor company bank war battle empire city state government people army fleet trade market prices price business'
    .split(' '),
);

/** Lower-case, strip accents and punctuation, normalise digits so "1,600" == "1600". */
export function normalise(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d),(\d{3})/g, '$1$2')
    .toLowerCase()
    .replace(/[‘’′']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Specific details worth checking: numbers (years, figures) and capitalised names. */
export function keyTerms(claim) {
  const raw = String(claim || '');
  const terms = new Set();
  for (const m of raw.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/\b\d{2,}(?:\.\d+)?\b/g)) terms.add(m[0].replace(/\.0+$/, ''));
  const words = raw.split(/\s+/);
  words.forEach((w, i) => {
    const clean = w.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
    if (clean.length < 3 || !/^[A-ZÀ-Ý]/.test(clean)) return;
    const n = normalise(clean);
    if (!n || STOP.has(n)) return;
    // A capitalised word right after a full stop is often just the start of a sentence.
    const prev = words[i - 1] || '';
    if (i === 0 || /[.!?:]$/.test(prev)) {
      if (STOP.has(n)) return;
    }
    terms.add(n);
  });
  return [...terms].slice(0, 24);
}

/**
 * Compare one claim with the texts of its cited sources.
 * @param {string} claim
 * @param {Array<{ok:boolean,text?:string}>} sources  one entry per cited source
 * @returns {{status:string, matched:number, total:number, missing:string[]}}
 */
export function checkClaim(claim, sources) {
  if (!sources || !sources.length) return { status: 'insufficient', matched: 0, total: 0, missing: [] };
  const reachable = sources.filter((s) => s && s.ok && s.text);
  if (!reachable.length) return { status: 'inaccessible', matched: 0, total: 0, missing: [] };
  const terms = keyTerms(claim);
  if (!terms.length) return { status: 'available', matched: 0, total: 0, missing: [] };
  const hay = ` ${reachable.map((s) => normalise(s.text)).join(' ')} `;
  const missing = terms.filter((t) => !hay.includes(` ${t} `));
  const matched = terms.length - missing.length;
  const ratio = matched / terms.length;
  const status = matched >= 2 && ratio >= 0.75 ? 'verified' : 'available';
  return { status, matched, total: terms.length, missing };
}

/** Kind of source: primary record, secondary scholarship, or tertiary reference. */
export function sourceKind(s) {
  const t = `${s?.type || ''} ${s?.publisher || ''}`.toLowerCase();
  if (/primary|filing|regulatory|company|official|structured data/.test(t)) return 'primary';
  if (/scholarly|book|journal|press|paper/.test(t)) return 'secondary';
  if (/wikipedia|reference|encyclop|wikidata/.test(t)) return 'tertiary';
  if (/news|website|filing|official/.test(t)) return 'secondary';
  return 'secondary';
}
export const KIND_LABEL = { primary: 'Primary source', secondary: 'Secondary source', tertiary: 'Reference work' };
export const KIND_HELP = {
  primary: 'A record made by the people or organisation involved, or an official filing or dataset.',
  secondary: 'Analysis or reporting written after the events, such as scholarship or news.',
  tertiary: 'A general reference work (such as an encyclopedia) that summarises other sources.',
};

/**
 * Check every outcome and evidence item of a case against source texts.
 * textById maps a case source id (e.g. "S2") to the text that source provided.
 * Returns { [checkpointId | 'ev<i>']: [status, matched, total] }.
 */
export function checkCaseClaims(c, textById) {
  const out = {};
  const docs = (ids) => (ids || []).map((id) => (textById[id] ? { ok: true, text: textById[id] } : { ok: false }));
  for (const k of c.checkpoints || []) {
    if (!k.outcome?.text) continue;
    const r = checkClaim(k.outcome.text, docs(k.outcome.sourceIds));
    out[k.id] = [r.status, r.matched, r.total];
  }
  (c.evidence || []).forEach((e, i) => {
    const r = checkClaim(`${e.label} ${e.value || ''} ${e.note || ''}`, docs(e.sourceId ? [e.sourceId] : []));
    out[`ev${i}`] = [r.status, r.matched, r.total];
  });
  return out;
}
