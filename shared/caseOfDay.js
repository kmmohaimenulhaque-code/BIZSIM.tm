// Case of the Day: the same season for everyone on the same local date, with no
// network and no account. The pick is a hash of the date in the user's own time
// zone, so it changes at local midnight and works offline.
import { sha256 } from './sha256.js';

/** YYYY-MM-DD for a Date in the device's local time zone (or a given IANA zone). */
export function localDateKey(d = new Date(), timeZone) {
  if (timeZone) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hashIndex(key, n) {
  const h = sha256(`bizsim-cotd|${key}`);
  const v = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  return v % n;
}

/**
 * Pick for a date. ids must be in a stable order (the curated catalogue order).
 * offset > 0 gives "explore another" picks for the same day, never repeating
 * the main pick, without changing the official Case of the Day.
 */
export function caseOfDay(ids, dateKey, offset = 0) {
  if (!ids.length) return null;
  const base = hashIndex(dateKey, ids.length);
  // Step by a number coprime with the list length so every season comes up once per cycle.
  let step = 7;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  while (gcd(step, ids.length) !== 1) step++;
  return ids[(base + offset * step) % ids.length];
}

/** Seasons for the next days, for scheduling local notifications. */
export function upcomingCases(ids, fromDate = new Date(), days = 7) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i, 12);
    const key = localDateKey(d);
    out.push({ date: key, id: caseOfDay(ids, key) });
  }
  return out;
}
