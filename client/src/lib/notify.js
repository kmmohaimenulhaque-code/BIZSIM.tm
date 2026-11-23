// Notification centre and local reminders. Off until the user turns them on.
// No account, no push service, nothing leaves the device:
// * Android and iPhone: the system schedules local notifications
//   (@capacitor/local-notifications), so they arrive even when BIZSIM is closed.
// * Desktop app and browsers: notifications are shown while BIZSIM is open
//   (the operating system's notification area), and anything missed while it
//   was closed appears in the in-app notification centre on the next start.
import { planNotifications, allowNow, DEFAULT_SETTINGS } from '@shared/notifyPlan.js';
import { CASES } from '@shared/cases/index.js';
import { getState, setState, useStore, subscribe } from './store.js';
import { isNativeApp } from './api.js';
import { t, i18n } from '../i18n/index.js';

const PLAN_KEY = 'bizsim.notifyPlan';
const TZ_KEY = 'bizsim.notifyTz';
const CURATED_IDS = CASES.map((c) => c.id);
const TITLE = Object.fromEntries(CASES.map((c) => [c.id, c.title]));
const MAX_NATIVE = 48; // iOS keeps at most 64 pending local notifications

let updateProvider = null;
export function registerUpdateProvider(fn) {
  updateProvider = typeof fn === 'function' ? fn : null;
}

export const notifySettings = (s = getState()) => ({ ...DEFAULT_SETTINGS, ...(s.notify || {}), categories: { ...DEFAULT_SETTINGS.categories, ...(s.notify?.categories || {}) } });
export const useNotifySettings = () => useStore((s) => s.notify);
export const useInbox = () => useStore((s) => s.inbox || []);

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};
const ls = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null') ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};

// Capacitor plugin objects are proxies: returning one from an async function
// makes the promise call plugin.then(), which throws. Keep it in a holder.
let pluginHolder = null;
async function loadPlugin() {
  if (!isNativeApp()) return { LN: null };
  if (pluginHolder) return pluginHolder;
  try {
    const mod = await import('@capacitor/local-notifications');
    pluginHolder = { LN: mod.LocalNotifications };
  } catch {
    pluginHolder = { LN: null };
  }
  return pluginHolder;
}

/** 'granted' | 'denied' | 'prompt' | 'unsupported' */
export async function permissionState() {
  const { LN } = await loadPlugin();
  if (LN) {
    try {
      const d = (await LN.checkPermissions()).display;
      return d === 'granted' ? 'granted' : d === 'denied' ? 'denied' : 'prompt';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

async function requestPermission() {
  const { LN } = await loadPlugin();
  if (LN) {
    const r = await LN.requestPermissions();
    return r.display === 'granted' ? 'granted' : 'denied';
  }
  if (typeof Notification === 'undefined') return 'unsupported';
  const r = await Notification.requestPermission();
  return r === 'default' ? 'prompt' : r;
}

// ---------- inbox ----------
export function addToInbox(n) {
  setState((s) => {
    const inbox = s.inbox || [];
    if (inbox.some((x) => x.id === n.id)) return s;
    return { ...s, inbox: [{ id: n.id, category: n.category, title: n.title, body: n.body, link: n.link, at: n.at || new Date().toISOString() }, ...inbox].slice(0, 200) };
  });
}
export const markRead = (id) => setState((s) => ({ ...s, inbox: (s.inbox || []).map((x) => (id == null || x.id === id ? { ...x, read: true } : x)) }));
export const clearInbox = () => setState((s) => ({ ...s, inbox: [] }));
export const removeFromInbox = (id) => setState((s) => ({ ...s, inbox: (s.inbox || []).filter((x) => x.id !== id) }));

// ---------- planning ----------
function context(now = new Date()) {
  const s = getState();
  const unfinished = (s.runs || [])
    .filter((r) => !r.finishedAt && !r.abandonedAt && r.choices?.length)
    .map((r) => {
      const c = CASES.find((x) => x.id === r.caseId) || (s.myCases || []).find((x) => x.id === r.caseId);
      return c && { caseId: c.id, title: c.title, lastAt: r.choices.at(-1)?.at || r.startedAt };
    })
    .filter(Boolean);
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const completedThisWeek = (s.runs || []).filter((r) => r.finishedAt && new Date(r.finishedAt) >= monday).length;
  const pendingUpdate = updateProvider ? updateProvider() : null;
  return { now, curatedIds: CURATED_IDS, titleOf: (id) => TITLE[id] || t('notify.newSeason'), unfinished, completedThisWeek, pendingUpdate, t: (key, vars) => t(key, vars) };
}

/** Move planned notifications whose time has passed into the inbox (catch-up after the app was closed). */
function catchUp(now = new Date()) {
  const plan = ls.get(PLAN_KEY, []);
  if (!Array.isArray(plan) || !plan.length) return;
  const due = plan.filter((n) => new Date(n.at) <= now);
  for (const n of due.slice(-10)) addToInbox({ id: n.key, category: n.category, title: n.title, body: n.body, link: n.link, at: n.at });
  ls.set(
    PLAN_KEY,
    plan.filter((n) => new Date(n.at) > now),
  );
}

let timer = null;
let scheduling = Promise.resolve();

/** Recompute and (re)schedule everything. Safe to call often: ids are deterministic. */
export function reschedule() {
  scheduling = scheduling.then(doReschedule).catch(() => {});
  return scheduling;
}

async function doReschedule() {
  const settings = notifySettings();
  const now = new Date();
  catchUp(now);
  ls.set(TZ_KEY, tz());
  const plan = planNotifications(settings, context(now));
  ls.set(
    PLAN_KEY,
    plan.map((n) => ({ ...n, at: n.at.toISOString() })),
  );
  const { LN } = await loadPlugin();
  if (LN) {
    try {
      const pending = await LN.getPending();
      const ours = (pending.notifications || []).filter((n) => n.extra?.bizsim);
      if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
      if (plan.length && (await permissionState()) === 'granted') {
        await LN.schedule({
          notifications: plan.slice(0, MAX_NATIVE).map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            schedule: { at: n.at, allowWhileIdle: true },
            extra: { bizsim: 1, link: n.link, key: n.key },
          })),
        });
      }
    } catch {
      /* scheduling failed: the in-app centre still works */
    }
  }
}

function showNow(n) {
  if (isNativeApp()) {
    loadPlugin().then(({ LN }) => LN?.schedule({ notifications: [{ id: (Date.now() % 1_000_000) + 2_000_000, title: n.title, body: n.body, extra: { bizsim: 1, link: n.link } }] })?.catch?.(() => {}));
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const sys = new Notification(n.title, { body: n.body, tag: n.key || n.id, icon: '/icons/icon-192.png' });
    sys.onclick = () => {
      window.focus();
      if (n.link) window.dispatchEvent(new CustomEvent('bizsim:navigate', { detail: n.link }));
      sys.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

/** Desktop and browser: deliver due items every minute while BIZSIM is open. */
function tick() {
  const now = new Date();
  const plan = ls.get(PLAN_KEY, []);
  const due = plan.filter((n) => new Date(n.at) <= now);
  if (due.length && !isNativeApp()) {
    for (const n of due.slice(-3)) {
      showNow(n);
      addToInbox({ id: n.key, category: n.category, title: n.title, body: n.body, link: n.link, at: n.at });
    }
    ls.set(
      PLAN_KEY,
      plan.filter((n) => new Date(n.at) > now),
    );
  }
  if (ls.get(TZ_KEY, '') !== tz()) reschedule(); // time zone changed (travel)
}

/** An event happened now (season finished, research done). */
export function notifyEvent(category, { key, title, body, link }) {
  const s = notifySettings();
  if (!s.enabled || s.categories[category] === false) return;
  addToInbox({ id: key, category, title, body, link });
  if (allowNow(s, category) && (typeof document === 'undefined' || document.hidden)) showNow({ key, title, body, link });
}

// ---------- settings ----------
export function updateNotifySettings(patch) {
  setState((s) => ({ ...s, notify: { ...notifySettings(s), ...patch, categories: { ...notifySettings(s).categories, ...(patch.categories || {}) } } }));
  return reschedule();
}

/** Turn notifications on. Returns the permission result; stays off unless granted. */
export async function enableNotifications() {
  const p = await requestPermission();
  if (p === 'granted') await updateNotifySettings({ enabled: true });
  return p;
}

export async function disableAllNotifications() {
  await updateNotifySettings({ enabled: false });
  ls.set(PLAN_KEY, []);
  const { LN } = await loadPlugin();
  if (LN) {
    try {
      const pending = await LN.getPending();
      const ours = (pending.notifications || []).filter((n) => n.extra?.bizsim);
      if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    } catch {
      /* nothing scheduled */
    }
  }
}

let started = false;
export async function initNotifications() {
  if (started) return;
  started = true;
  catchUp();
  // Seasons finished on this device go to the centre.
  let finished = new Set((getState().runs || []).filter((r) => r.finishedAt).map((r) => r.id));
  let lastRuns = getState().runs;
  let debounce = null;
  const unsub = { fn: null };
  const onChange = () => {
    const s = getState();
    if (s.runs === lastRuns) return;
    lastRuns = s.runs;
    for (const r of s.runs || []) {
      if (r.finishedAt && !finished.has(r.id)) {
        const c = CASES.find((x) => x.id === r.caseId) || (s.myCases || []).find((x) => x.id === r.caseId);
        if (c) notifyEvent('seasonDone', { key: `done|${r.id}`, title: t('notify.seasonDoneTitle'), body: t('notify.seasonDoneBody', { title: c.title }), link: '/learning' });
      }
    }
    finished = new Set((s.runs || []).filter((r) => r.finishedAt).map((r) => r.id));
    clearTimeout(debounce);
    debounce = setTimeout(reschedule, 1500);
  };
  unsub.fn = subscribe(onChange);

  const { LN } = await loadPlugin();
  if (LN) {
    LN.addListener('localNotificationActionPerformed', (a) => {
      const link = a.notification?.extra?.link;
      if (link) window.dispatchEvent(new CustomEvent('bizsim:navigate', { detail: link }));
    }).catch?.(() => {});
    LN.addListener('localNotificationReceived', (n) => {
      if (n.extra?.key) addToInbox({ id: n.extra.key, category: 'caseOfDay', title: n.title, body: n.body, link: n.extra.link });
    }).catch?.(() => {});
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('resume', () => reschedule());
    } catch {
      /* ignore */
    }
  }
  if (notifySettings().enabled) reschedule();
  // Scheduled notifications carry their text, so rewrite them in the new language.
  i18n.on('languageChanged', () => {
    if (notifySettings().enabled) reschedule();
  });
  timer = setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  void timer;
}
