// Plans BIZSIM's local notifications. Pure functions (no platform APIs), so the
// same plan drives Android and iPhone scheduling, the desktop app and the
// in-app notification centre, and can be tested.
//
// Rules:
// * Nothing is planned unless the user has turned notifications on.
// * Each category can be switched off on its own.
// * Quiet hours move a notification to the end of the quiet period.
// * Ids are deterministic, so planning twice never creates duplicates.
import { caseOfDay, localDateKey } from './caseOfDay.js';

// English text, used when the caller passes no translator (tests, server).
// The app passes ctx.t so notifications are written in the interface language.
const EN = {
  'notify.plan.cotdTitle': () => 'Case of the Day',
  'notify.plan.cotdBody': (v) => `${v.title}. What would you decide?`,
  'notify.plan.resumeTitle': () => 'Your season is waiting',
  'notify.plan.resumeBody': (v) => `Pick up “${v.title}” where you left off.`,
  'notify.plan.weeklyTitle': () => 'Your week in BIZSIM',
  'notify.plan.weeklyDone': (v) => `Goal reached: ${v.count} seasons this week.`,
  'notify.plan.weeklyProgress': (v) => `${v.done} of ${v.goal} seasons this week. One more episode keeps the habit going.`,
  'notify.plan.customTitle': () => 'BIZSIM reminder',
  'notify.plan.updateTitle': (v) => `Update to version ${v.version}`,
  'notify.plan.updateBody': (v) => `BIZSIM ${v.version} is available (you are on ${v.currentVersion}).`,
};
const english = (key, vars) => EN[key](vars || {});

export const CATEGORY = {
  caseOfDay: { label: 'Case of the Day', help: 'One season a day to try, chosen at random by date.' },
  resume: { label: 'Resume an episode', help: 'A reminder when a season you started has been waiting a day or more.' },
  weeklyGoal: { label: 'Weekly goal', help: 'A weekly nudge with your progress toward the number of seasons you set.' },
  seasonDone: { label: 'Season completed', help: 'A note in the notification centre when you finish a season.' },
  researchDone: { label: 'Research finished', help: 'Tells you when live research or the chat builder finishes in the background.' },
  custom: { label: 'Your reminders', help: 'Reminders you set yourself.' },
  appUpdate: { label: 'App updates', help: 'Daily reminder when a newer version of BIZSIM is available.' },
};

export const DEFAULT_SETTINGS = {
  enabled: false,
  categories: { caseOfDay: true, resume: true, weeklyGoal: true, seasonDone: true, researchDone: true, custom: true, appUpdate: true },
  time: '09:00',
  frequency: 'daily',
  quietStart: '22:00',
  quietEnd: '07:00',
  weeklyGoal: 3,
  custom: [],
};

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** True if a local time (minutes after midnight) falls inside quiet hours. */
export function inQuiet(min, start, end) {
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  return s < e ? min >= s && min < e : min >= s || min < e;
}

/** Move a Date out of quiet hours (to the end of the quiet period). */
export function respectQuiet(date, start, end) {
  const min = date.getHours() * 60 + date.getMinutes();
  if (!inQuiet(min, start, end)) return date;
  const e = toMin(end);
  const d = new Date(date);
  d.setHours(Math.floor(e / 60), e % 60, 0, 0);
  if (d <= date) d.setDate(d.getDate() + 1);
  return d;
}

function at(day, hhmm) {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const m = toMin(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

// Stable small integer from a string, for platform notification ids.
function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1_000_000;
}

/**
 * @param settings  notification settings (see DEFAULT_SETTINGS)
 * @param ctx { now: Date, curatedIds: string[], titleOf(id): string,
 *              unfinished: [{ caseId, title, lastAt }], completedThisWeek: number, days?: number }
 * @returns [{ key, id, category, title, body, at: Date, link }]
 */
export function planNotifications(settings, ctx) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}), categories: { ...DEFAULT_SETTINGS.categories, ...(settings?.categories || {}) } };
  if (!s.enabled) return [];
  const now = ctx.now || new Date();
  const days = ctx.days || 14;
  const tr = typeof ctx.t === 'function' ? ctx.t : english;
  const out = [];
  const push = (n) => {
    const when = respectQuiet(n.at, s.quietStart, s.quietEnd);
    if (when <= now) return;
    out.push({ ...n, at: when, id: hash32(n.key) + 1 });
  };

  if (s.categories.caseOfDay && ctx.curatedIds?.length) {
    for (let i = 0; i < days; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12);
      const dow = day.getDay();
      if (s.frequency === 'weekdays' && (dow === 0 || dow === 6)) continue;
      if (s.frequency === 'weekly' && dow !== 1) continue;
      const key = localDateKey(day);
      const id = caseOfDay(ctx.curatedIds, key);
      push({ key: `cotd|${key}`, category: 'caseOfDay', title: tr('notify.plan.cotdTitle'), body: tr('notify.plan.cotdBody', { title: ctx.titleOf(id) }), at: at(day, s.time), link: `/cases/${id}` });
    }
  }

  if (s.categories.resume && ctx.unfinished?.length) {
    const r = [...ctx.unfinished].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))[0];
    const last = new Date(r.lastAt);
    const due = at(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), s.time);
    // Remind once, the day after the last decision (or tomorrow if that has passed).
    const when = due > now ? due : at(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s.time);
    push({ key: `resume|${r.caseId}|${localDateKey(when)}`, category: 'resume', title: tr('notify.plan.resumeTitle'), body: tr('notify.plan.resumeBody', { title: r.title }), at: new Date(when.getTime() + 30 * 60_000), link: `/cases/${r.caseId}` });
  }

  if (s.categories.weeklyGoal && s.weeklyGoal > 0) {
    // Next Sunday at the chosen time.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7));
    let when = at(d, s.time);
    if (when <= now) when = at(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7), s.time);
    const done = ctx.completedThisWeek || 0;
    const body = done >= s.weeklyGoal ? tr('notify.plan.weeklyDone', { count: done }) : tr('notify.plan.weeklyProgress', { done, goal: s.weeklyGoal });
    push({ key: `weekly|${localDateKey(when)}`, category: 'weeklyGoal', title: tr('notify.plan.weeklyTitle'), body, at: when, link: '/learning' });
  }

  if (s.categories.custom) {
    for (const r of s.custom || []) {
      for (let i = 0; i < Math.min(days, 7); i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        if (r.days?.length && !r.days.includes(day.getDay())) continue;
        push({ key: `custom|${r.id}|${localDateKey(day)}`, category: 'custom', title: tr('notify.plan.customTitle'), body: r.text, at: at(day, r.time), link: '/' });
      }
    }
  }
  if (s.categories.appUpdate && ctx.pendingUpdate?.version) {
    for (let i = 0; i < Math.min(days, 7); i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = localDateKey(day);
      push({
        key: `update|${ctx.pendingUpdate.version}|${key}`,
        category: 'appUpdate',
        title: tr('notify.plan.updateTitle', { version: ctx.pendingUpdate.version }),
        body: tr('notify.plan.updateBody', { version: ctx.pendingUpdate.version, currentVersion: ctx.pendingUpdate.currentVersion || '' }),
        at: at(day, s.time),
        link: '/settings',
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Should an immediate event (season completed, research finished) notify now? */
export function allowNow(settings, category, now = new Date()) {
  if (!settings?.enabled || settings.categories?.[category] === false) return false;
  return !inQuiet(now.getHours() * 60 + now.getMinutes(), settings.quietStart || '22:00', settings.quietEnd || '07:00');
}
