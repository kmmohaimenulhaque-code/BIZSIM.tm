// Pure, universal update logic shared by the server, desktop app, mobile apps,
// browsers, and unit tests. Zero platform dependencies.

export const DEFAULT_UPDATE_REPO = 'kmmohaimenulhaque-code/BIZSIM.tm';

const ALLOWED_HOSTS = new Set(['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com']);

/** Parse a SemVer string like "v1.7.3" or "1.8.0-rc.1". Returns null if invalid. */
export function parseSemver(raw) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(raw || '').trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
  };
}

/** Compare two SemVer strings. Returns 1 if a > b, -1 if a < b, 0 if equal (or invalid). */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] !== pb[k]) return pa[k] > pb[k] ? 1 : -1;
  }
  if (!pa.pre.length && !pb.pre.length) return 0;
  if (!pa.pre.length) return 1;
  if (!pb.pre.length) return -1;
  const len = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x > y ? 1 : -1;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return String(x) > String(y) ? 1 : -1;
  }
  return 0;
}

export const isNewerVersion = (latest, current) => compareSemver(latest, current) > 0;

/** Validate that a download/release URL is strictly HTTPS on GitHub's release hosts. */
export function safeReleaseUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:') return null;
    if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Detect the runtime platform across Electron, Capacitor (Android/iOS), and Web.
 * Accepts an optional env object for deterministic unit testing.
 */
export function detectPlatform(env) {
  const e = env || (typeof window !== 'undefined'
    ? {
        capacitorPlatform: window.Capacitor?.isNativePlatform?.() ? window.Capacitor.getPlatform?.() : null,
        desktopPlatform: window.bizsimDesktop?.platform || null,
        desktopArch: window.bizsimDesktop?.arch || null,
        isDesktop: Boolean(window.bizsimDesktop),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        uaDataPlatform: typeof navigator !== 'undefined' ? navigator.userAgentData?.platform || '' : '',
      }
    : {});

  const cap = String(e.capacitorPlatform || '').toLowerCase();
  if (cap === 'android') return { id: 'android', label: 'Android', kind: 'mobile' };
  if (cap === 'ios') return { id: 'ios', label: 'iPhone / iPad', kind: 'mobile' };

  const dp = String(e.desktopPlatform || '').toLowerCase();
  const da = String(e.desktopArch || '').toLowerCase();
  if (dp === 'win32') return { id: 'windows-x64', label: 'Windows', kind: 'desktop' };
  if (dp === 'darwin') {
    return da === 'arm64'
      ? { id: 'mac-arm64', label: 'macOS (Apple Silicon)', kind: 'desktop' }
      : { id: 'mac-x64', label: 'macOS (Intel)', kind: 'desktop' };
  }
  if (dp === 'linux') return { id: 'linux-x64', label: 'Linux', kind: 'desktop' };

  const ua = String(e.userAgent || '');
  const uap = String(e.uaDataPlatform || '');
  if (/Android/i.test(ua)) return { id: 'android', label: 'Android', kind: 'web' };
  if (/iPhone|iPad|iPod/i.test(ua)) return { id: 'ios', label: 'iPhone / iPad', kind: 'web' };
  if (e.isDesktop) {
    if (/Windows/i.test(ua) || /Windows/i.test(uap)) return { id: 'windows-x64', label: 'Windows', kind: 'desktop' };
    if (/Mac/i.test(ua) || /macOS/i.test(uap)) return { id: 'mac-arm64', label: 'macOS', kind: 'desktop' };
    if (/Linux/i.test(ua) || /Linux/i.test(uap)) return { id: 'linux-x64', label: 'Linux', kind: 'desktop' };
  }
  return { id: 'web', label: 'Web', kind: 'web' };
}

const ASSET_PATTERNS = {
  'windows-x64': [/windows-x64\.exe$/i, /\.exe$/i],
  'mac-arm64': [/mac-arm64\.dmg$/i, /mac-arm64\.zip$/i, /mac-arm64\.pkg$/i],
  'mac-x64': [/mac-x64\.dmg$/i, /mac-x64\.zip$/i, /mac-x64\.pkg$/i],
  'linux-x64': [/linux-x86_64\.AppImage$/i, /\.AppImage$/i, /linux-x64\.tar\.gz$/i],
  android: [/android\.apk$/i, /\.apk$/i],
  ios: [/ios-unsigned\.ipa$/i, /\.ipa$/i],
};

/** Select the best matching installer/package asset for a given platform id. */
export function selectReleaseAsset(assets, platformId) {
  const list = Array.isArray(assets) ? assets : [];
  const patterns = ASSET_PATTERNS[platformId];
  if (!patterns) return null;
  for (const re of patterns) {
    const found = list.find((a) => typeof a?.name === 'string' && re.test(a.name) && safeReleaseUrl(a.url));
    if (found) return found;
  }
  return null;
}

/**
 * Normalize a raw GitHub Releases API payload into a safe, compact update descriptor.
 */
export function normalizeRelease(raw, currentVersion, platformId = 'web', repo = DEFAULT_UPDATE_REPO) {
  if (!raw || typeof raw !== 'object') return null;
  const tag = String(raw.tag_name || raw.name || '').trim();
  const parsed = parseSemver(tag);
  if (!parsed) return null;
  const latestVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}${parsed.pre.length ? `-${parsed.pre.join('.')}` : ''}`;
  const fallbackReleaseUrl = `https://github.com/${repo}/releases/latest`;
  const releaseUrl = safeReleaseUrl(raw.html_url) || fallbackReleaseUrl;

  const rawAssets = Array.isArray(raw.assets) ? raw.assets : [];
  const assets = rawAssets
    .map((a) => {
      const name = typeof a?.name === 'string' ? a.name.trim().slice(0, 160) : '';
      const url = safeReleaseUrl(a?.browser_download_url || a?.url);
      if (!name || !url) return null;
      return { name, url, size: Number.isFinite(Number(a?.size)) ? Number(a.size) : 0 };
    })
    .filter(Boolean);

  const checksum = assets.find((a) => /SHA256SUMS\.txt$/i.test(a.name)) || null;
  const matchedAsset = selectReleaseAsset(assets, platformId);

  // Extract a clean 1-line summary (strip markdown images/HTML tags)
  const cleanBody = String(raw.body || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#*_`>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);

  return {
    currentVersion: String(currentVersion || '0.0.0').replace(/^v/, ''),
    latestVersion,
    tagName: tag,
    updateAvailable: isNewerVersion(latestVersion, currentVersion),
    releaseUrl,
    publishedAt: typeof raw.published_at === 'string' ? raw.published_at : null,
    summary: cleanBody || null,
    asset: matchedAsset,
    checksumUrl: checksum?.url || null,
    assets,
  };
}
