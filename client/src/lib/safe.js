// Sanitising helpers for anything that came from the network, an AI model or an
// imported file. React already escapes text; these cover attributes React does
// not police (link targets and image sources).

import { sanitizeImageUrl } from '@shared/imagePolicy.js';

/** Returns the URL if it is an absolute http(s) link, otherwise undefined. */
export function safeUrl(u) {
  if (typeof u !== 'string' || u.length > 2048) return undefined;
  const s = u.trim();
  try {
    const p = new URL(s);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href : undefined;
  } catch {
    return undefined;
  }
}

/** Image sources: validated via centralized imagePolicy (allowlisted remote hosts & safe bundled paths). */
export function safeImageSrc(u, metaText = '') {
  return sanitizeImageUrl(u, metaText) || undefined;
}

/** Plain text from untrusted input: strips control characters and caps length. */
export function cleanText(v, max = 2000) {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, '').slice(0, max);
}
