import { redactSecrets, redactSecretsDeep } from './lib/http.js';
// Background jobs for long tasks (live research, chat builder).
// A job keeps running on the server even if the app disconnects: the phone can
// switch screens, go to the background or lose the connection, then reconnect
// and replay every event it missed (GET /api/jobs/:id/events?from=N).
import crypto from 'node:crypto';

const jobs = new Map();
const KEEP_MS = 60 * 60 * 1000; // finished jobs stay replayable for an hour
const MAX_JOBS = 50;

function prune() {
  const now = Date.now();
  for (const [id, j] of jobs) if (j.done && now - j.endedAt > KEEP_MS) jobs.delete(id);
  if (jobs.size > MAX_JOBS) {
    const finished = [...jobs.values()].filter((j) => j.done).sort((a, b) => a.endedAt - b.endedAt);
    for (const j of finished.slice(0, jobs.size - MAX_JOBS)) jobs.delete(j.id);
  }
}

/** Start `run(emit)` in the background and return the job. */
export function startJob(kind, meta, run) {
  prune();
  if ([...jobs.values()].filter((j) => !j.done).length >= 20) throw Object.assign(new Error('Too many tasks are running. Try again in a minute.'), { status: 429 });
  const job = { id: crypto.randomBytes(24).toString('base64url'), kind, meta, events: [], listeners: new Set(), done: false, createdAt: Date.now(), endedAt: 0 };
  const emit = (event, data) => {
    const ev = { i: job.events.length, event, data: redactSecretsDeep(data) };
    job.events.push(ev);
    for (const f of job.listeners) f(ev);
  };
  jobs.set(job.id, job);
  Promise.resolve()
    .then(() => run(emit))
    .catch((e) => emit('failure', { message: redactSecrets(e?.message || 'The task failed') }))
    .finally(() => {
      job.done = true;
      job.endedAt = Date.now();
      emit('end', {});
    });
  return job;
}

export const getJob = (id) => jobs.get(String(id)) || null;

const SSE_IDLE_MS = 300_000; // 5 min without events
const SSE_MAX_MS = 600_000;  // 10 min max stream duration

/** Stream a job's events as server-sent events, starting from event number `from`. */
export function streamJob(job, from, req, res, { onClose, idleMs = SSE_IDLE_MS, maxMs = SSE_MAX_MS } = {}) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  let closed = false;
  let idleTimer = null;
  let maxTimer = null;
  const finish = () => {
    if (closed) return;
    closed = true;
    clearInterval(ping);
    if (idleTimer) clearTimeout(idleTimer);
    if (maxTimer) clearTimeout(maxTimer);
    job.listeners.delete(listener);
    onClose?.();
    res.end();
  };
  const closeWithTimeout = (reason) => {
    if (!closed) {
      res.write(`event: failure\ndata: ${JSON.stringify({ message: reason })}\n\n`);
      res.write(`event: end\ndata: {}\n\n`);
    }
    finish();
  };
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => closeWithTimeout('Stream closed due to inactivity.'), idleMs);
  };
  const send = (ev) => {
    if (!closed) {
      res.write(`id: ${ev.i}\nevent: ${ev.event}\ndata: ${JSON.stringify(redactSecretsDeep(ev.data))}\n\n`);
      resetIdle();
    }
  };
  const start = Math.max(0, Number(from) || 0);
  for (const ev of job.events.slice(start)) send(ev);
  if (job.done) {
    onClose?.();
    return res.end();
  }
  const listener = (ev) => {
    send(ev);
    if (ev.event === 'end') finish();
  };
  const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15000);
  resetIdle();
  maxTimer = setTimeout(() => closeWithTimeout('Stream reached maximum duration.'), maxMs);
  job.listeners.add(listener);
  res.on('close', finish);
}
