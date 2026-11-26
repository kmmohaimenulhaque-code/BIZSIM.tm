// Universal client update controller for Desktop (Electron), Mobile (Capacitor),
// and Web/PWA. Coordinates:
// 1. Dual-path release checks (/api/update/check -> direct GitHub Releases fallback)
// 2. Gentle auto-dismissing toast ("Update to version x.x.x")
// 3. Daily reminder notifications when an available update is ignored
import { useSyncExternalStore } from 'react';
import { DEFAULT_UPDATE_REPO, detectPlatform, normalizeRelease, selectReleaseAsset, isNewerVersion } from '@shared/updateCheck.js';
import { localDateKey } from '@shared/caseOfDay.js';
import { apiBase, hasServer } from './api.js';
import { addToInbox, notifyEvent, registerUpdateProvider, reschedule } from './notify.js';

const STORAGE_KEY = 'bizsim.updateState';
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60_000; // Check at most every 6 hours automatically
const TOAST_DURATION_MS = 7500; // Gentle toast stays for 7.5s, then disappears

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? String(__APP_VERSION__) : '1.7.3';

const DEFAULT_PERSISTED = {
  autoCheck: true,
  dailyReminder: true,
  skippedVersion: null,
  lastCheckedAt: null,
  lastNotifiedDate: null,
  firstSeenVersion: null,
  firstSeenDate: null,
  release: null,
};

function loadPersisted() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object') return { ...DEFAULT_PERSISTED, ...raw };
  } catch {
    /* storage unavailable */
  }
  return { ...DEFAULT_PERSISTED };
}

function savePersisted(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const platform = detectPlatform();

let state = {
  ...loadPersisted(),
  platform,
  checking: false,
  error: null,
  toast: null, // { version, url, assetName } | null
};

// Recompute updateAvailable against the currently running APP_VERSION
// (clears stale update notice immediately after the user installs the new version).
if (state.release) {
  const stillNewer = isNewerVersion(state.release.latestVersion, APP_VERSION);
  state.release = {
    ...state.release,
    currentVersion: APP_VERSION,
    updateAvailable: stillNewer,
    asset: selectReleaseAsset(state.release.assets || [], platform.id),
  };
  if (!stillNewer) {
    state.firstSeenVersion = null;
    state.firstSeenDate = null;
    state.lastNotifiedDate = null;
  }
}

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function setUpdateState(patch) {
  state = { ...state, ...patch };
  const toPersist = {
    autoCheck: state.autoCheck,
    dailyReminder: state.dailyReminder,
    skippedVersion: state.skippedVersion,
    lastCheckedAt: state.lastCheckedAt,
    lastNotifiedDate: state.lastNotifiedDate,
    firstSeenVersion: state.firstSeenVersion,
    firstSeenDate: state.firstSeenDate,
    release: state.release,
  };
  savePersisted(toPersist);
  emit();
}

export function getUpdateState() {
  return state;
}

export function useUpdateState() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

let toastTimer = null;
let toastPaused = false;

export function showGentleUpdateToast(release) {
  if (!release?.updateAvailable) return;
  if (toastTimer) clearTimeout(toastTimer);
  state = {
    ...state,
    toast: {
      version: release.latestVersion,
      url: release.asset?.url || release.releaseUrl,
      releaseUrl: release.releaseUrl,
      assetName: release.asset?.name || null,
    },
  };
  emit();
  toastTimer = setTimeout(() => {
    if (!toastPaused) dismissUpdateToast();
  }, TOAST_DURATION_MS);
}

export function pauseUpdateToast(paused) {
  toastPaused = Boolean(paused);
  if (!paused && state.toast) {
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(dismissUpdateToast, 3000);
  }
}

export function dismissUpdateToast() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (!state.toast) return;
  state = { ...state, toast: null };
  emit();
}

export function setUpdatePrefs(patch) {
  const clean = {};
  if (typeof patch.autoCheck === 'boolean') clean.autoCheck = patch.autoCheck;
  if (typeof patch.dailyReminder === 'boolean') clean.dailyReminder = patch.dailyReminder;
  if ('skippedVersion' in patch) clean.skippedVersion = patch.skippedVersion || null;
  setUpdateState(clean);
  if (clean.skippedVersion || clean.dailyReminder === false) {
    dismissUpdateToast();
  }
  reschedule();
}

export function skipVersion(version) {
  setUpdatePrefs({ skippedVersion: version || null });
}

/** Pending update descriptor consumed by notifyPlan.js for daily native/desktop reminders. */
export function getPendingUpdateForPlan() {
  const r = state.release;
  if (!r?.updateAvailable) return null;
  if (!state.dailyReminder) return null;
  if (state.skippedVersion && state.skippedVersion === r.latestVersion) return null;
  return {
    version: r.latestVersion,
    currentVersion: APP_VERSION,
    releaseUrl: r.releaseUrl,
  };
}

function handleDailyReminderAndToast(release, { manual = false } = {}) {
  if (!release?.updateAvailable) {
    reschedule();
    return;
  }
  if (!manual && state.skippedVersion === release.latestVersion) return;

  const today = localDateKey();
  const isNewDiscovery = state.firstSeenVersion !== release.latestVersion;
  const firstSeenDate = isNewDiscovery ? today : state.firstSeenDate || today;

  // Always show the gentle auto-dismissing toast on new discovery or once per day when ignored
  const shouldNotifyToday = isNewDiscovery || (state.dailyReminder && state.lastNotifiedDate !== today);

  if (shouldNotifyToday || manual) {
    showGentleUpdateToast(release);
  }

  if (shouldNotifyToday) {
    const key = `update|${release.latestVersion}|${today}`;
    const title = `Update to version ${release.latestVersion}`;
    const body = isNewDiscovery
      ? `BIZSIM ${release.latestVersion} is ready to download for ${state.platform.label}.`
      : `Reminder: BIZSIM ${release.latestVersion} is available (you are on ${APP_VERSION}).`;

    // Add to in-app notification centre so it's never lost even if system notifications are off
    addToInbox({ id: key, category: 'appUpdate', title, body, link: '/settings' });
    // Also trigger OS/native notification if user enabled notifications (respects quiet hours)
    notifyEvent('appUpdate', { key, title, body, link: '/settings' });

    setUpdateState({
      firstSeenVersion: release.latestVersion,
      firstSeenDate,
      lastNotifiedDate: today,
    });
  } else if (isNewDiscovery) {
    setUpdateState({
      firstSeenVersion: release.latestVersion,
      firstSeenDate,
    });
  }

  // Keep native/desktop scheduled daily reminders in sync
  reschedule();
}

async function fetchLatestRelease() {
  // Path A: Use the BIZSIM backend proxy when available (cached + SSRF-hardened)
  if (hasServer()) {
    try {
      const res = await fetch(`${apiBase()}/api/update/check`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok && /json/i.test(res.headers.get('content-type') || '')) {
        const data = await res.json();
        if (data?.ok && data.latestVersion) {
          return {
            currentVersion: APP_VERSION,
            latestVersion: data.latestVersion,
            tagName: data.tagName || `v${data.latestVersion}`,
            updateAvailable: isNewerVersion(data.latestVersion, APP_VERSION),
            releaseUrl: data.releaseUrl,
            publishedAt: data.publishedAt || null,
            summary: data.summary || null,
            checksumUrl: data.checksumUrl || null,
            assets: Array.isArray(data.assets) ? data.assets : [],
            asset: selectReleaseAsset(data.assets || [], platform.id),
          };
        }
      }
    } catch {
      /* Fall through to direct GitHub Releases check */
    }
  }

  // Path B1: Direct latest.json on GitHub Releases CDN (zero API rate limit, works on standalone mobile)
  try {
    const ctrl1 = new AbortController();
    const t1 = setTimeout(() => ctrl1.abort(), 8000);
    try {
      const res = await fetch(`https://github.com/${DEFAULT_UPDATE_REPO}/releases/latest/download/latest.json`, {
        headers: { Accept: 'application/json' },
        signal: ctrl1.signal,
      });
      if (res.ok) {
        const raw = await res.json();
        const norm = normalizeRelease(raw, APP_VERSION, platform.id, DEFAULT_UPDATE_REPO);
        if (norm) return norm;
      }
    } finally {
      clearTimeout(t1);
    }
  } catch {
    /* Fall through to GitHub API */
  }

  // Path B2: Direct GitHub Releases API fallback
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`https://api.github.com/repos/${DEFAULT_UPDATE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: ctrl.signal,
    });
    if (res.status === 403 || res.status === 429) {
      throw new Error('GitHub rate limit reached. Try again in a few minutes.');
    }
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const raw = await res.json();
    const norm = normalizeRelease(raw, APP_VERSION, platform.id, DEFAULT_UPDATE_REPO);
    if (!norm) throw new Error('Could not read latest release information.');
    return norm;
  } finally {
    clearTimeout(timer);
  }
}

let inflight = null;

/**
 * Check for a newer BIZSIM release.
 * @param {{ manual?: boolean }} opts
 */
export async function checkForUpdates({ manual = false } = {}) {
  if (inflight) return inflight;
  if (!manual) {
    if (!state.autoCheck) return state.release;
    const last = state.lastCheckedAt ? new Date(state.lastCheckedAt).getTime() : 0;
    if (last && Date.now() - last < AUTO_CHECK_INTERVAL_MS && state.release) {
      // Still check if a new day rolled over for a previously discovered ignored update
      handleDailyReminderAndToast(state.release, { manual: false });
      return state.release;
    }
  }

  state = { ...state, checking: true, error: null };
  emit();

  inflight = (async () => {
    try {
      const release = await fetchLatestRelease();
      setUpdateState({
        checking: false,
        error: null,
        lastCheckedAt: new Date().toISOString(),
        release,
      });
      handleDailyReminderAndToast(release, { manual });
      return release;
    } catch (e) {
      const msg = e?.name === 'AbortError' ? 'Update check timed out.' : e?.message || 'Could not check for updates.';
      state = { ...state, checking: false, error: manual ? msg : null };
      emit();
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

let initialized = false;

/** Start background update checks (once on boot + daily tick while open). */
export function initUpdater() {
  if (initialized) return;
  initialized = true;
  registerUpdateProvider(getPendingUpdateForPlan);

  // Delay initial check slightly so first paint & critical data load stay instant
  setTimeout(() => {
    checkForUpdates({ manual: false }).catch(() => {});
  }, 3500);

  // Re-check every 6 hours if the app stays open across days
  setInterval(() => {
    checkForUpdates({ manual: false }).catch(() => {});
  }, AUTO_CHECK_INTERVAL_MS);

  // When returning to the app on a new calendar day, check for ignored-update daily reminder
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.release?.updateAvailable) {
        handleDailyReminderAndToast(state.release, { manual: false });
      }
    });
  }
}
