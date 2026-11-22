// Localised season content. Seasons are written in English; a translation is
// an overlay file that replaces text fields by stable id (decision ids, option
// ids, episode numbers). Ids, numbers, scores, sources and URLs are never
// taken from an overlay, so progress and imports are unaffected by language.
//
// Overlays live in client/src/i18n/content/<locale>/<caseId>.json and load on
// demand. If the English text changed after a translation was made, the
// overlay is still used but the season says the translation may be outdated.
import { useEffect, useState } from 'react';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import { digestOf } from '@shared/package.js';

const loaders = import.meta.glob('../i18n/content/*/*.json');
const cache = new Map(); // `${locale}/${id}` -> overlay | null

const keyOf = (locale, id) => `${locale}/${id}`;
const loaderFor = (locale, id) => loaders[`../i18n/content/${locale}/${id}.json`];

export const hasOverlay = (locale, id) => Boolean(loaderFor(locale, id));
/** Ids of seasons translated into a locale (for the "translated" filter and the docs). */
export function translatedIds(locale) {
  const out = [];
  for (const p of Object.keys(loaders)) {
    const m = /content\/([^/]+)\/(.+)\.json$/.exec(p);
    if (m && m[1] === locale) out.push(m[2]);
  }
  return out;
}

/** Fingerprint of the English text an overlay was translated from. */
export function sourceRevision(c) {
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k]]));
  return digestOf({
    t: pick(c, ['title', 'tagline', 'reading']),
    s: c.situation,
    c: pick(c.concept || {}, ['framework', 'explanation']),
    e: (c.evidence || []).map((e) => pick(e, ['label', 'value', 'note'])),
    k: c.checkpoints.map((k) => [k.id, pick(k, ['title', 'dateLabel', 'prompt', 'context']), k.outcome?.text, k.options.map((o) => [o.id, pick(o, ['label', 'summary', 'consequence', 'tradeoffs', 'risks'])])]),
    p: (c.episodes || []).map((e) => [e.n, e.title, e.dateLabel, e.insight?.text]),
    o: [c.outcome?.summary, c.outcome?.secondOrder, c.outcome?.baseRate, (c.outcome?.lessons || []).map((l) => l.text)],
  }).slice(0, 16);
}

const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v : fallback);
const list = (v, fallback) => (Array.isArray(fallback) ? fallback.map((x, i) => str(v?.[i], x)) : fallback);

/** Apply an overlay to a case. Pure: returns a new object, the original is untouched. */
export function applyOverlay(c, ov, locale) {
  if (!c || !ov?.fields) return c;
  const f = ov.fields;
  const out = {
    ...c,
    title: str(f.title, c.title),
    tagline: str(f.tagline, c.tagline),
    reading: str(f.reading, c.reading),
    situation: { ...c.situation, headline: str(f.situation?.headline, c.situation?.headline), role: str(f.situation?.role, c.situation?.role), stakes: str(f.situation?.stakes, c.situation?.stakes), context: list(f.situation?.context, c.situation?.context) },
    concept: c.concept && { ...c.concept, framework: str(f.concept?.framework, c.concept.framework), explanation: str(f.concept?.explanation, c.concept.explanation) },
    evidence: (c.evidence || []).map((e, i) => ({ ...e, label: str(f.evidence?.[i]?.label, e.label), value: str(f.evidence?.[i]?.value, e.value), note: str(f.evidence?.[i]?.note, e.note) })),
    episodes: c.episodes?.map((e) => {
      const x = f.episodes?.[e.n] || {};
      return { ...e, title: str(x.title, e.title), dateLabel: str(x.dateLabel, e.dateLabel), insight: e.insight && { ...e.insight, text: str(x.insight, e.insight.text) } };
    }),
    checkpoints: c.checkpoints.map((k) => {
      const x = f.checkpoints?.[k.id] || {};
      return {
        ...k,
        title: str(x.title, k.title),
        dateLabel: str(x.dateLabel, k.dateLabel),
        prompt: str(x.prompt, k.prompt),
        context: str(x.context, k.context),
        outcome: k.outcome && { ...k.outcome, text: str(x.outcome, k.outcome.text) },
        options: k.options.map((o) => {
          const y = x.options?.[o.id] || {};
          return { ...o, label: str(y.label, o.label), summary: str(y.summary, o.summary), consequence: str(y.consequence, o.consequence), tradeoffs: str(y.tradeoffs, o.tradeoffs), risks: str(y.risks, o.risks) };
        }),
      };
    }),
    outcome: c.outcome && {
      ...c.outcome,
      summary: str(f.outcome?.summary, c.outcome.summary),
      secondOrder: list(f.outcome?.secondOrder, c.outcome.secondOrder || []),
      baseRate: str(f.outcome?.baseRate, c.outcome.baseRate),
      lessons: (c.outcome.lessons || []).map((l, i) => ({ ...l, text: str(f.outcome?.lessons?.[i], l.text) })),
    },
    contentLocale: locale,
    contentTranslation: { status: ov.status || 'machine', stale: Boolean(ov.sourceRevision && ov.sourceRevision !== sourceRevision(c)) },
  };
  return out;
}

/** Synchronous: uses an overlay only if it is already loaded. */
export function localizeCase(c, locale) {
  if (!c || !locale) return c;
  const ov = cache.get(keyOf(locale, c.id));
  return ov ? applyOverlay(c, ov, locale) : c;
}

export async function loadOverlay(locale, id) {
  const k = keyOf(locale, id);
  if (cache.has(k)) return cache.get(k);
  const load = loaderFor(locale, id);
  if (!load) {
    cache.set(k, null);
    return null;
  }
  try {
    const mod = await load();
    const ov = mod.default || mod;
    cache.set(k, ov && ov.caseId === id ? ov : null);
  } catch {
    cache.set(k, null);
  }
  return cache.get(k);
}

/** Hook: the case in the current language once its overlay (if any) has loaded. */
export function useLocalizedCase(c, locale) {
  const [, bump] = useState(0);
  const id = c?.id;
  useEffect(() => {
    if (!id || !locale || cache.has(keyOf(locale, id))) return undefined;
    let alive = true;
    loadOverlay(locale, id).then(() => alive && bump((n) => n + 1));
    return () => {
      alive = false;
    };
  }, [id, locale]);
  return localizeCase(c, locale);
}

/** BCP 47 tag for the language a case's text is written in (for lang=""). */
export function contentLangOf(c) {
  const code = c?.contentLocale;
  return (code && LOCALE_BY_CODE[code]?.intl) || 'en';
}
