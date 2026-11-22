// Locale-aware formatting with the standard Intl APIs. Formatting changes how
// a value is shown, never the value: amounts keep their own currency, dates
// show in the device's time zone, and nothing is converted.
import { intlLocale, t } from './index.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';

const cache = new Map();
function nf(opts, loc = intlLocale()) {
  const k = `n|${loc}|${JSON.stringify(opts)}`;
  if (!cache.has(k)) cache.set(k, new Intl.NumberFormat(loc, opts));
  return cache.get(k);
}
function df(opts, loc = intlLocale()) {
  const k = `d|${loc}|${JSON.stringify(opts)}`;
  if (!cache.has(k)) cache.set(k, new Intl.DateTimeFormat(loc, opts));
  return cache.get(k);
}

const toDate = (v) => {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatNumber = (n, opts = {}) => (Number.isFinite(n) ? nf(opts).format(n) : '');
export const formatInteger = (n) => formatNumber(n, { maximumFractionDigits: 0 });
export const formatDecimal = (n, digits = 1) => formatNumber(n, { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** 0.42 -> "42%" (or "%42", "42 %", per language). */
export const formatPercent = (fraction, digits = 0) => formatNumber(fraction, { style: 'percent', maximumFractionDigits: digits });
export const formatCompact = (n) => formatNumber(n, { notation: 'compact', maximumFractionDigits: 1 });
/** Signed number: +3, −2, 0. */
export const formatSigned = (n) => formatNumber(n, { signDisplay: 'exceptZero' });

/** Amount in its own currency (never converted). Unknown codes fall back to "amount CODE". */
export function formatCurrency(amount, currency = 'USD', { compact = false } = {}) {
  if (!Number.isFinite(amount)) return '';
  try {
    return nf({ style: 'currency', currency, ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}) }).format(amount);
  } catch {
    return `${formatNumber(amount, compact ? { notation: 'compact', maximumFractionDigits: 1 } : {})} ${currency}`;
  }
}

export function formatDate(v, style = 'medium') {
  const d = toDate(v);
  if (!d) return typeof v === 'string' ? v : '';
  const opts = style === 'long' ? { dateStyle: 'long' } : style === 'short' ? { dateStyle: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return df(opts).format(d);
}
export function formatDateTime(v) {
  const d = toDate(v);
  return d ? df({ dateStyle: 'medium', timeStyle: 'short' }).format(d) : '';
}
export function formatTime(v) {
  const d = toDate(v);
  return d ? df({ timeStyle: 'short' }).format(d) : '';
}
export function formatWeekdayDate(v) {
  const d = toDate(v);
  return d ? df({ weekday: 'long', day: 'numeric', month: 'long' }).format(d) : '';
}
export function formatDateRange(a, b) {
  const x = toDate(a);
  const y = toDate(b);
  if (!x || !y) return '';
  const f = df({ day: 'numeric', month: 'short', year: 'numeric' });
  return typeof f.formatRange === 'function' ? f.formatRange(x, y) : `${f.format(x)} – ${f.format(y)}`;
}

/** "3 minutes ago", "hace 3 minutos", "৩ মিনিট আগে". */
export function formatRelative(v, now = Date.now()) {
  const d = toDate(v);
  if (!d) return '';
  const s = (d.getTime() - now) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return t('common.time.justNow');
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return formatDate(d);
}

/** Localised list: "A, B and C". */
export function formatList(items, type = 'conjunction') {
  try {
    return new Intl.ListFormat(intlLocale(), { style: 'long', type }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** Weekday names, Sunday first, in the current language. */
export function weekdayNames(width = 'short') {
  const f = df({ weekday: width, timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2023, 0, 1 + i))));
}

/** A language's name in the current interface language, e.g. "español", "Bengali". */
export function languageName(code) {
  try {
    const n = new Intl.DisplayNames([intlLocale()], { type: 'language' }).of(code === 'zh-Hans' ? 'zh-Hans' : code);
    if (n && n !== code) return n;
  } catch {
    /* older engines: fall back to the native name */
  }
  return LOCALE_BY_CODE[code]?.native || code;
}
