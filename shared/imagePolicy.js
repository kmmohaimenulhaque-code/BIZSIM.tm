// bizsim/shared/imagePolicy.js
// Unified content-safety policy for built-in covers, Live Research, Chat Builder, and imported cases.

export const PROHIBITED_CONTENT_PATTERNS = [
  /\b(nude|nudity|naked|nsfw|porn|pornography|erotic|erotica|xxx|hentai|fetish|bdsm)\b/i,
  /\b(sex|sexual|sexually|seductive|sensual|boudoir|pin[\s-]?up|playboy|glamour\s*model)\b/i,
  /\b(bikini|swimsuit|swimwear|lingerie|underwear|bra|panties|cleavage|topless|bottomless)\b/i,
  /\b(stripper|burlesque|escort|prostitut|vulgar|obscene|lewd|explicit|provocative)\b/i,
  /\b(haute[\s-]?couture\s*model|fashion\s*model|runway\s*model|beauty\s*pageant|miss\s+universe)\b/i,
];

// Seasons explicitly removed from built-in cover photography (rendered via geometric fallback)
export const BLOCKED_SEASON_COVERS = new Set([
  'season-c056',
  'season-c058',
  'season-c190',
  'season-c047',
]);

// Allowlisted remote image hosts for imported/shared/live cases
export const ALLOWED_IMAGE_HOSTS = new Set([
  'upload.wikimedia.org',
  'commons.wikimedia.org',
  'thumb.wikimedia.org',
]);

// Local relative path prefixes allowed inside the app
export const ALLOWED_LOCAL_PREFIXES = ['/covers/', '/hero/', '/generated/', '/icons/'];

export const SAFE_GENERATION_STYLE =
  'Editorial architectural, industrial, documentary object, map, or abstract geometric composition. ' +
  'No human figures, no portraits of people, no nudity, no suggestive content, no text, no watermarks, no logos.';

/**
 * Check free text (filename, title, caption, Wikimedia categories, or AI image prompt)
 * against prohibited content patterns.
 */
export function isSafeImageText(text) {
  if (!text) return true;
  const normalized = String(text).replace(/[_\-]+/g, ' ');
  return !PROHIBITED_CONTENT_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Validate a cover/media URL for built-in, Live Research, Chat Builder, and imported cases.
 * Returns normalized URL string if permitted, or null to trigger the safe geometric placeholder.
 */
export function sanitizeImageUrl(rawUrl, metaText = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  // Reject control chars, script schemes, and raw data URIs
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  if (/^(javascript|vbscript|data|file|blob):/i.test(trimmed)) return null;

  // Check URL path + associated metadata against content policy
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return null;
  }
  if (!isSafeImageText(decoded) || !isSafeImageText(metaText)) return null;

  // Local bundled asset path
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//') || trimmed.includes('..')) return null;
    if (!ALLOWED_LOCAL_PREFIXES.some((p) => trimmed.startsWith(p))) return null;
    for (const id of BLOCKED_SEASON_COVERS) {
      if (trimmed.includes(`/${id}.`)) return null;
    }
    return trimmed;
  }

  // Parse absolute URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;

  const host = parsed.hostname.toLowerCase();

  // Local app server asset (e.g. http://localhost:8787/generated/<hash>.png)
  if (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (host === 'localhost' || host === '127.0.0.1' || host === '::1')
  ) {
    if (parsed.pathname.includes('..')) return null;
    if (!ALLOWED_LOCAL_PREFIXES.some((p) => parsed.pathname.startsWith(p))) return null;
    for (const id of BLOCKED_SEASON_COVERS) {
      if (parsed.pathname.includes(`/${id}.`)) return null;
    }
    return parsed.toString();
  }

  // Remote HTTPS asset must be on an allowlisted host
  if (parsed.protocol !== 'https:') return null;
  if (!ALLOWED_IMAGE_HOSTS.has(host)) return null;

  return parsed.toString();
}

/**
 * Validate an image metadata object ({ url, src, file, title, caption, categories }).
 * Returns null if rejected so callers fall back to the safe placeholder.
 */
export function validateImageAsset(asset) {
  if (!asset) return null;
  if (typeof asset === 'string') return sanitizeImageUrl(asset);
  if (typeof asset !== 'object') return null;

  const meta = [
    asset.file,
    asset.title,
    asset.alt,
    asset.caption,
    asset.description,
    Array.isArray(asset.categories) ? asset.categories.join(' ') : asset.categories,
  ]
    .filter(Boolean)
    .join(' ');

  const candidate = asset.url || asset.src || asset.thumb || '';
  const cleanUrl = sanitizeImageUrl(candidate, meta);
  if (!cleanUrl) return null;

  return {
    ...asset,
    ...(asset.url ? { url: cleanUrl } : {}),
    ...(asset.src ? { src: cleanUrl } : {}),
  };
}

/**
 * Enforce safety rules on AI image-generation prompts before sending to Gemini/OpenAI.
 */
export function buildSafeImagePrompt(userPrompt) {
  const clean = String(userPrompt || '').trim();
  if (!clean || !isSafeImageText(clean)) {
    return null;
  }
  return `${clean}\n\nStyle & Safety Requirements: ${SAFE_GENERATION_STYLE}`;
}

/**
 * Build descriptive, ADA/WCAG-compliant alt text for any season cover
 * (all 200 built-in seasons, Live Research cases, and Chat Builder cases).
 */
export function buildCoverAlt(c, img = null) {
  const title = String(c?.title || '').trim();
  const company = String(c?.company || '').trim();
  const subject = title && company && !title.toLowerCase().includes(company.toLowerCase())
    ? `${title} (${company})`
    : title || company || 'Business case';

  if (!img) {
    return `Geometric cover placeholder for ${subject}`;
  }
  if (img.aiGenerated) {
    return `AI-generated editorial illustration for ${subject}`;
  }
  const imgTitle = String(img.title || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (imgTitle && imgTitle.toLowerCase() !== subject.toLowerCase()) {
    return `${imgTitle} — cover image for ${subject}`;
  }
  return `Cover image for ${subject}`;
}
