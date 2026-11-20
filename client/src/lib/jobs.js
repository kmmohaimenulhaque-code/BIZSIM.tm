// Background tasks (live research, chat builder) that survive screen changes.
// The server runs the task; this module keeps the event log, reconnects after
// the app was in the background or the connection dropped, and replays the
// events it missed. Screens just read the log, so leaving and coming back never
// loses progress.
import { useEffect, useState } from 'react';
import { startJobRequest, streamJobEvents } from './api.js';

const STORE = 'bizsim.jobs.v1';
const jobs = {}; // kind -> { id, kind, meta, events, done, error, connected }
const subs = new Set();
const handlers = {}; // kind -> (event, data, job) => void, run once per new event

function save() {
  try {
    const plain = Object.fromEntries(Object.entries(jobs).map(([k, j]) => [k, { id: j.id, kind: j.kind, meta: j.meta, events: j.events, done: j.done, error: j.error }]));
    sessionStorage.setItem(STORE, JSON.stringify(plain));
  } catch {
    /* storage full: the server can still replay */
  }
}
function notify() {
  save();
  subs.forEach((f) => f({ ...jobs }));
}

function connect(job) {
  if (job.done || job.connected) return;
  job.connected = true;
  job.cancel = streamJobEvents(job.id, job.events.length, {
    onEvent: (ev) => {
      if (ev.i !== job.events.length) return; // already have it
      job.events.push(ev);
      if (ev.event === 'end') job.done = true;
      try {
        handlers[job.kind]?.(ev.event, ev.data, job);
      } catch (e) {
        console.error(e);
      }
      notify();
    },
    onClose: (err) => {
      job.connected = false;
      if (job.cancelled || jobs[job.kind] !== job) return;
      if (err?.gone) {
        job.done = true;
        job.error = err.message;
        notify();
        return;
      }
      if (!job.done) {
        // Dropped (app in background, network change): try again shortly.
        job.retries = (job.retries || 0) + 1;
        const wait = Math.min(15000, 1000 * job.retries);
        setTimeout(() => !job.done && document.visibilityState !== 'hidden' && connect(job), wait);
      }
    },
  });
}

// Restore after a reload, and reconnect when the app comes back to the foreground.
(function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || '{}');
    for (const [k, j] of Object.entries(saved)) jobs[k] = { ...j, connected: false };
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') Object.values(jobs).forEach((j) => !j.done && !j.connected && connect(j));
    });
    window.addEventListener('online', () => Object.values(jobs).forEach((j) => !j.done && !j.connected && connect(j)));
  }
})();

/** Register what happens when a new event of this kind arrives (saving cases etc.). */
export function onJobEvent(kind, fn) {
  handlers[kind] = fn;
  const j = jobs[kind];
  if (j && !j.done && !j.connected) connect(j);
}

/** Start a new job of this kind (replacing any previous one). */
export async function startJob(kind, path, body, meta = {}) {
  const old = jobs[kind];
  if (old) {
    old.cancelled = true;
    old.cancel?.();
  }
  jobs[kind] = { id: null, kind, meta, events: [], done: false, error: null, connected: false, starting: true };
  notify();
  try {
    const { id } = await startJobRequest(path, body);
    jobs[kind] = { id, kind, meta, events: [], done: false, error: null, connected: false };
    notify();
    connect(jobs[kind]);
  } catch (e) {
    jobs[kind] = { id: null, kind, meta, events: [], done: true, error: e.message, connected: false };
    notify();
  }
}

/** Stop following a job (the server finishes it anyway). */
export function stopJob(kind) {
  const j = jobs[kind];
  if (!j) return;
  j.cancelled = true;
  j.cancel?.();
  j.done = true;
  j.stopped = true;
  notify();
}

export function clearJob(kind) {
  if (jobs[kind]) jobs[kind].cancelled = true;
  jobs[kind]?.cancel?.();
  delete jobs[kind];
  notify();
}

export function useJob(kind) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    subs.add(f);
    const j = jobs[kind];
    if (j && !j.done && !j.connected && j.id) connect(j);
    return () => subs.delete(f);
  }, [kind]);
  return jobs[kind] || null;
}
