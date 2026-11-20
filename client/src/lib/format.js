import { DOMAINS, ERAS, DIFFICULTY } from '@shared/dimensions.js';

export const domainLabel = (d) => DOMAINS[d] || d;
export const eraLabel = (e) => ERAS[e] || e;
export const difficultyLabel = (n) => DIFFICULTY[n] || 'Operator';

export function relTime(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDate(iso) {
  if (!iso) return 'Undated';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function compactMoney(v, unit = 'USD') {
  const sym = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }[unit];
  const abs = Math.abs(v);
  let s;
  if (abs >= 1e12) s = `${(v / 1e12).toFixed(2)}T`;
  else if (abs >= 1e9) s = `${(v / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) s = `${(v / 1e6).toFixed(1)}M`;
  else s = v.toLocaleString();
  return sym ? `${v < 0 ? '−' : ''}${sym}${s.replace('-', '')}` : `${s} ${unit}`;
}

export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
