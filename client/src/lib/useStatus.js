import { useEffect, useState } from 'react';
import { getStatus } from './api.js';

let cached = null;
let pending = null;
const subs = new Set();

export function refreshStatus() {
  pending = getStatus()
    .then((s) => (cached = { ...s, online: true }))
    .catch((e) => (cached = { online: false, error: e.message }))
    .finally(() => {
      pending = null;
      subs.forEach((f) => f(cached));
    });
  return pending;
}

/** Server capabilities (AI, image generation, SEC). null while loading. */
export function useStatus() {
  const [s, setS] = useState(cached);
  useEffect(() => {
    subs.add(setS);
    if (!cached && !pending) refreshStatus();
    return () => subs.delete(setS);
  }, []);
  return s;
}
