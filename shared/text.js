// House style: BIZSIM never prints em dashes. Use this on any text that came
// from an AI model or from user input before it is shown or saved.
export function noEmDash(s) {
  if (typeof s !== 'string' || !s.includes('\u2014')) return s;
  return s
    .replace(/(\d)\s*\u2014\s*(\d)/g, '$1\u2013$2') // number ranges keep an en dash
    .replace(/\s*\u2014\s*([,.;:!?)])/g, '$1')
    .replace(/(^|[\n(])\s*\u2014\s*/g, '$1')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/,\s*,/g, ',');
}

/** Apply noEmDash to every string inside an object or array (returns a new value). */
export function deepNoEmDash(v, depth = 0) {
  if (depth > 32) return v;
  if (typeof v === 'string') return noEmDash(v);
  if (Array.isArray(v)) return v.map((x) => deepNoEmDash(x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepNoEmDash(x, depth + 1)]));
  return v;
}
