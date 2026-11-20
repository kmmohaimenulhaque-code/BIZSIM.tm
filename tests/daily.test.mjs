import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, CASE_BY_ID } from '../shared/cases/index.js';
import { caseOfDay, localDateKey, upcomingCases } from '../shared/caseOfDay.js';
import { planNotifications, respectQuiet, inQuiet, allowNow, DEFAULT_SETTINGS } from '../shared/notifyPlan.js';
import { sanitizeCollections, sanitizeNotifySettings } from '../shared/stateSchema.js';

const ids = CASES.map((c) => c.id);

test('Case of the Day is deterministic per local date and offline', () => {
  assert.deepEqual(Object.keys(CASE_BY_ID), ids, 'dashboard and notifications use the same order');
  const a = caseOfDay(ids, '2026-11-18');
  assert.equal(caseOfDay(ids, '2026-11-18'), a);
  assert.ok(ids.includes(a));
  const week = new Set(Array.from({ length: 30 }, (_, i) => caseOfDay(ids, `2026-12-${String(i + 1).padStart(2, '0')}`)));
  assert.ok(week.size > 20, 'varies from day to day');
  const others = new Set(Array.from({ length: 200 }, (_, i) => caseOfDay(ids, '2026-11-18', i)));
  assert.equal(others.size, 200, '"explore another" visits every season once before repeating');
  assert.equal(caseOfDay([], '2026-11-18'), null);
});

test('local date follows the time zone', () => {
  const t = new Date('2026-11-18T23:30:00Z');
  assert.equal(localDateKey(t, 'UTC'), '2026-11-18');
  assert.equal(localDateKey(t, 'Asia/Dhaka'), '2026-11-19');
  assert.equal(localDateKey(t, 'America/Los_Angeles'), '2026-11-18');
  assert.equal(upcomingCases(ids, new Date(2026, 10, 18), 7).length, 7);
});

const ctx = (now, extra = {}) => ({ now, curatedIds: ids, titleOf: (id) => CASE_BY_ID[id].title, unfinished: [], completedThisWeek: 1, ...extra });

test('notifications: off by default, disabled categories, frequency', () => {
  const now = new Date(2026, 10, 18, 8, 0);
  assert.deepEqual(planNotifications(undefined, ctx(now)), []);
  assert.deepEqual(planNotifications(DEFAULT_SETTINGS, ctx(now)), [], 'DEFAULT is off');
  const on = { ...DEFAULT_SETTINGS, enabled: true };
  const plan = planNotifications(on, ctx(now));
  assert.equal(plan.filter((n) => n.category === 'caseOfDay').length, 14);
  assert.ok(plan.every((n) => n.at > now));
  const noCotd = planNotifications({ ...on, categories: { ...on.categories, caseOfDay: false } }, ctx(now));
  assert.equal(noCotd.filter((n) => n.category === 'caseOfDay').length, 0);
  const weekdays = planNotifications({ ...on, frequency: 'weekdays' }, ctx(now)).filter((n) => n.category === 'caseOfDay');
  assert.ok(weekdays.every((n) => n.at.getDay() !== 0 && n.at.getDay() !== 6));
  const weekly = planNotifications({ ...on, frequency: 'weekly' }, ctx(now)).filter((n) => n.category === 'caseOfDay');
  assert.ok(weekly.length <= 2 && weekly.every((n) => n.at.getDay() === 1));
});

test('notifications: quiet hours, duplicates, resume, custom, past times', () => {
  const now = new Date(2026, 10, 18, 8, 0);
  const s = { ...DEFAULT_SETTINGS, enabled: true, time: '23:00', quietStart: '22:00', quietEnd: '07:30' };
  const plan = planNotifications(s, ctx(now));
  for (const n of plan) assert.ok(!inQuiet(n.at.getHours() * 60 + n.at.getMinutes(), '22:00', '07:30'), `${n.key} at ${n.at}`);
  const again = planNotifications(s, ctx(now));
  assert.deepEqual(plan.map((n) => n.id), again.map((n) => n.id), 'same ids every time (no duplicates)');
  assert.equal(new Set(plan.map((n) => n.id)).size, plan.length, 'ids unique');
  assert.equal(respectQuiet(new Date(2026, 10, 18, 23, 0), '22:00', '07:00').getHours(), 7);
  assert.equal(respectQuiet(new Date(2026, 10, 18, 12, 0), '22:00', '07:00').getHours(), 12);
  assert.equal(inQuiet(600, '10:00', '10:00'), false);

  const withResume = planNotifications({ ...DEFAULT_SETTINGS, enabled: true }, ctx(now, { unfinished: [{ caseId: ids[3], title: 'X', lastAt: new Date(2026, 10, 10).toISOString() }] }));
  const r = withResume.filter((n) => n.category === 'resume');
  assert.equal(r.length, 1);
  assert.ok(r[0].at > now);

  const custom = planNotifications({ ...DEFAULT_SETTINGS, enabled: true, custom: [{ id: 'r1', text: 'Play', time: '18:00', days: [1, 3] }] }, ctx(now));
  assert.ok(custom.filter((n) => n.category === 'custom').every((n) => [1, 3].includes(n.at.getDay())));
  // 08:00 today already passed for a 07:00 Case of the Day: today's is skipped, not sent late.
  const late = planNotifications({ ...DEFAULT_SETTINGS, enabled: true, time: '07:00' }, ctx(now));
  assert.ok(late.filter((n) => n.category === 'caseOfDay').every((n) => n.at > now));
});

test('immediate events respect switches and quiet hours', () => {
  const on = { ...DEFAULT_SETTINGS, enabled: true };
  assert.equal(allowNow(on, 'seasonDone', new Date(2026, 1, 1, 12)), true);
  assert.equal(allowNow(on, 'seasonDone', new Date(2026, 1, 1, 23)), false);
  assert.equal(allowNow({ ...on, categories: { ...on.categories, seasonDone: false } }, 'seasonDone', new Date(2026, 1, 1, 12)), false);
  assert.equal(allowNow(DEFAULT_SETTINGS, 'seasonDone', new Date(2026, 1, 1, 12)), false);
});

test('settings and collections from backups are validated', () => {
  const n = sanitizeNotifySettings({ enabled: 'yes', time: '25:99', frequency: 'hourly', weeklyGoal: 1e9, custom: [{ id: 'r1', text: 'x', time: '08:00', days: [1, 9] }] });
  assert.equal(n.enabled, false);
  assert.equal(n.time, '09:00');
  assert.equal(n.frequency, 'daily');
  assert.equal(n.weeklyGoal, 50);
  assert.deepEqual(n.custom[0].days, [1]);
  const cols = sanitizeCollections([{ id: 'c', name: '  ', items: [] }, { id: 'ok', name: 'Mine', items: [{ type: 'principle', id: 'p1' }] }]);
  assert.equal(cols.length, 1);
});
