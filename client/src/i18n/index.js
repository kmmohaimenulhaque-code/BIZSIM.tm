// BIZSIM localisation: one place for language choice, loading and lookup.
// Components use useTranslation() from react-i18next (or `t` below outside
// React). Resources are JSON bundled with the app and loaded on demand, so
// every language works offline and switching needs no network.
import i18n from 'i18next';
import { initReactI18next, useTranslation, Trans } from 'react-i18next';
import { useSyncExternalStore } from 'react';
import { LOCALES, LOCALE_BY_CODE, SOURCE_LOCALE, resolveLocale, isRtl } from '@shared/locales.js';
import en from './resources/en.json';

export { LOCALES, LOCALE_BY_CODE, isRtl };

const STORAGE_KEY = 'bizsim.locale';

// Every non-source language is a separate chunk, fetched from the app bundle only when chosen.
const loaders = import.meta.glob(['./resources/*.json', '!./resources/en.json']);
const loaderFor = (code) => loaders[`./resources/${code}.json`];

function savedLocale() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function systemLanguages() {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}

async function ensureLoaded(code) {
  if (code === SOURCE_LOCALE || i18n.hasResourceBundle(code, 'translation')) return;
  const load = loaderFor(code);
  if (!load) throw new Error(`No resources for ${code}`); // i18n-ignore: developer error
  const mod = await load();
  i18n.addResourceBundle(code, 'translation', mod.default || mod, true, true);
}

function applyDocument(code) {
  if (typeof document === 'undefined') return;
  const l = LOCALE_BY_CODE[code] || LOCALE_BY_CODE.en;
  const el = document.documentElement;
  el.lang = l.intl;
  el.dir = l.dir;
  el.dataset.script = l.script || 'latin';
}

const listeners = new Set();
let current = SOURCE_LOCALE;

/** Start localisation before the first render. Never throws: falls back to English. */
export async function initI18n() {
  const wanted = resolveLocale(savedLocale(), systemLanguages());
  try {
    await initCore();
  } catch {
    /* i18next failed to start: t() will return keys, but the app still renders */
  }
  try {
    await ensureLoaded(wanted);
    await i18n.changeLanguage(wanted);
    current = wanted;
  } catch {
    current = SOURCE_LOCALE;
  }
  applyDocument(current);
  return current;
}

function initCore() {
  return i18n.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: SOURCE_LOCALE,
    fallbackLng: { 'en-GB': ['en'], default: ['en'] },
    supportedLngs: LOCALES.map((l) => l.code),
    // React escapes everything it renders, so i18next must not escape a second time.
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    load: 'currentOnly',
    react: { useSuspense: false },
    missingKeyHandler: import.meta.env.DEV ? (lngs, ns, key) => console.warn(`[i18n] missing key ${key} for ${lngs.join(',')}`) : undefined,
    saveMissing: Boolean(import.meta.env.DEV),
  });
}

/** Switch language now, without a restart. Saves the choice. Progress is untouched. */
export async function setLocale(code) {
  if (!LOCALE_BY_CODE[code]) throw new Error(`Unsupported language: ${code}`); // i18n-ignore: developer error
  await ensureLoaded(code);
  await i18n.changeLanguage(code);
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* private mode: the choice lasts for this session */
  }
  applyDocument(code);
  listeners.forEach((fn) => fn());
}

/** Forget the saved choice and follow the system language again. */
export async function followSystemLanguage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  const code = resolveLocale(null, systemLanguages());
  await ensureLoaded(code);
  await i18n.changeLanguage(code);
  current = code;
  applyDocument(code);
  listeners.forEach((fn) => fn());
}

/**
 * Fetch every language file in the background so that, in a browser, the
 * service worker caches them and switching works later without a connection.
 * The desktop and phone apps ship all files locally, so this is a no-op there
 * in practice (the files load from the app itself). Called when the language
 * picker opens; failures are ignored.
 */
let prefetched = false;
export function prefetchLanguages() {
  if (prefetched || typeof window === 'undefined') return;
  prefetched = true;
  const run = () => Object.values(loaders).forEach((load) => load().catch(() => {}));
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

export const getLocale = () => current;
/** The language the user saved, or null when following the system. */
export const savedLocaleCode = () => {
  const s = savedLocale();
  return s && LOCALE_BY_CODE[s] ? s : null;
};
export const hasSavedLocale = () => Boolean(savedLocale());
export const intlLocale = (code = current) => (LOCALE_BY_CODE[code] || LOCALE_BY_CODE.en).intl;
export const localeDir = (code = current) => (LOCALE_BY_CODE[code] || LOCALE_BY_CODE.en).dir;

export function useLocale() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
    () => current,
  );
}

/** Translate outside React (toasts from libraries, notifications, reports). */
export const t = (key, opts) => i18n.t(key, opts);

/**
 * The message for an error, in the interface language when the error carries a
 * known `code` (e.g. "package.damaged"); otherwise its own message.
 */
export function errorText(e) {
  if (!e) return '';
  const key = e.code ? `errors.${e.code}` : null;
  if (key && i18n.exists(key)) return i18n.t(key, { ...(e.params || {}), defaultValue: e.message });
  return e.message || String(e);
}

export { useTranslation, Trans, i18n };
