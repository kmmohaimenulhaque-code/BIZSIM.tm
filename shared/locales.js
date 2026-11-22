// The languages BIZSIM supports. One registry used by the app, the server (for
// AI prompts) and the localisation tooling.
//
// 15 languages. English has two variants: US English is the canonical source
// ("en"); UK English ("en-GB") overrides spelling and uses British date order.
// To add a language later: add an entry here, add client/src/i18n/resources/<code>.json,
// then run `npm run i18n:check`.

/**
 * status: 'source' | 'machine' (machine-assisted, not reviewed) | 'review' (review needed)
 *         | 'reviewed' (human reviewed) | 'release' (release ready)
 * Only change a status to 'reviewed' after a fluent speaker has actually reviewed it.
 */
export const LOCALES = [
  { code: 'en', language: 'en', english: 'English (US)', native: 'English (US)', dir: 'ltr', intl: 'en-US', status: 'source' },
  { code: 'en-GB', language: 'en', english: 'English (UK)', native: 'English (UK)', dir: 'ltr', intl: 'en-GB', status: 'machine', variantOf: 'en' },
  { code: 'bn', language: 'bn', english: 'Bengali', native: 'বাংলা', dir: 'ltr', intl: 'bn', status: 'machine', script: 'bengali' },
  { code: 'es', language: 'es', english: 'Spanish', native: 'Español', dir: 'ltr', intl: 'es', status: 'machine' },
  { code: 'pt-BR', language: 'pt', english: 'Brazilian Portuguese', native: 'Português (Brasil)', dir: 'ltr', intl: 'pt-BR', status: 'machine' },
  { code: 'fr', language: 'fr', english: 'French', native: 'Français', dir: 'ltr', intl: 'fr', status: 'machine' },
  { code: 'ar', language: 'ar', english: 'Arabic', native: 'العربية', dir: 'rtl', intl: 'ar', status: 'machine', script: 'arabic' },
  { code: 'hi', language: 'hi', english: 'Hindi', native: 'हिन्दी', dir: 'ltr', intl: 'hi', status: 'machine', script: 'devanagari' },
  { code: 'zh-Hans', language: 'zh', english: 'Simplified Chinese', native: '简体中文', dir: 'ltr', intl: 'zh-Hans', status: 'machine', script: 'cjk' },
  { code: 'ja', language: 'ja', english: 'Japanese', native: '日本語', dir: 'ltr', intl: 'ja', status: 'machine', script: 'cjk' },
  { code: 'de', language: 'de', english: 'German', native: 'Deutsch', dir: 'ltr', intl: 'de', status: 'machine' },
  { code: 'ru', language: 'ru', english: 'Russian', native: 'Русский', dir: 'ltr', intl: 'ru', status: 'machine' },
  { code: 'id', language: 'id', english: 'Indonesian', native: 'Bahasa Indonesia', dir: 'ltr', intl: 'id', status: 'machine' },
  { code: 'tr', language: 'tr', english: 'Turkish', native: 'Türkçe', dir: 'ltr', intl: 'tr', status: 'machine' },
  { code: 'ko', language: 'ko', english: 'Korean', native: '한국어', dir: 'ltr', intl: 'ko', status: 'machine', script: 'cjk' },
  { code: 'ur', language: 'ur', english: 'Urdu', native: 'اردو', dir: 'rtl', intl: 'ur', status: 'machine', script: 'urdu' },
];

export const SOURCE_LOCALE = 'en';
export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const LOCALE_BY_CODE = Object.fromEntries(LOCALES.map((l) => [l.code, l]));
export const LANGUAGE_COUNT = new Set(LOCALES.map((l) => l.language)).size;

export const STATUS_LABEL = {
  source: 'Source language',
  machine: 'Machine-assisted, not yet reviewed',
  review: 'Review needed',
  reviewed: 'Reviewed by a fluent speaker',
  release: 'Release ready',
};

export const isRtl = (code) => LOCALE_BY_CODE[code]?.dir === 'rtl';

// English variants: the UK conventions are used by these regions.
const EN_GB_REGIONS = new Set(['GB', 'UK', 'IE', 'AU', 'NZ', 'IN', 'ZA', 'SG', 'HK', 'PK', 'BD', 'NG', 'KE', 'MY', 'MT']);

/** Map one BCP 47 tag (from the OS or browser) to a supported locale, or null. */
export function matchLocale(tag) {
  if (typeof tag !== 'string' || !tag) return null;
  const parts = tag.replace(/_/g, '-').split('-');
  const lang = parts[0].toLowerCase();
  const region = parts.slice(1).find((p) => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
  if (lang === 'en') return region && EN_GB_REGIONS.has(region) ? 'en-GB' : 'en';
  if (lang === 'pt') return 'pt-BR';
  if (lang === 'zh') return 'zh-Hans';
  const exact = LOCALES.find((l) => l.code.toLowerCase() === tag.toLowerCase());
  if (exact) return exact.code;
  return LOCALES.find((l) => l.language === lang && !l.variantOf)?.code || null;
}

/**
 * Resolve the language to use. Priority: the user's saved choice, then the
 * system languages in order, then English. A saved choice is never overridden.
 */
export function resolveLocale(saved, systemLanguages = []) {
  if (saved && LOCALE_BY_CODE[saved]) return saved;
  for (const tag of systemLanguages || []) {
    const m = matchLocale(tag);
    if (m) return m;
  }
  return SOURCE_LOCALE;
}

/** Language name for AI prompts, e.g. "Bengali (বাংলা)". */
export function promptLanguage(code) {
  const l = LOCALE_BY_CODE[code] || LOCALE_BY_CODE.en;
  if (l.language === 'en') return l.code === 'en-GB' ? 'British English' : 'American English';
  return `${l.english} (${l.native})`;
}

/** Normalise a locale code sent by a client; unknown values become null. */
export const cleanLocale = (code) => (typeof code === 'string' && LOCALE_BY_CODE[code] ? code : null);

/**
 * Instruction appended to AI prompts so generated seasons are written in the
 * user's language while ids, keys, sources and proper nouns stay intact.
 * Empty for US English (the prompts are already in English).
 */
export function languageInstruction(code) {
  const c = cleanLocale(code);
  if (!c || c === 'en') return '';
  if (c === 'en-GB') return '\nLANGUAGE: Write all human-readable text in British English (British spelling and usage).';
  return `\nLANGUAGE: Write every human-readable text value (titles, taglines, situations, context, prompts, option labels and summaries, consequences, trade-offs, risks, outcomes, insights, lessons, replies) in ${promptLanguage(c)}. Keep JSON keys, ids, enum values and source ids exactly as specified, in English. Do not translate source titles, publisher names, URLs, figures, currency amounts or quoted dates; keep personal and company names in their usual form (a well-known local spelling is fine). Never invent a translation of a quotation: paraphrase it instead.`;
}
