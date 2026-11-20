import { episodesOf } from '@shared/episodes.js';
// The chat builder conversation, kept outside any screen so it survives
// navigation, plus what happens when the background chat job reports progress.
import { useEffect, useState } from 'react';
import { onJobEvent } from './jobs.js';
import { saveGeneratedCase, setCaseTags, getState } from './store.js';
import { notifyEvent } from './notify.js';

const KEY = 'bizsim.chat.v2';
let items = load();
const subs = new Set();

function load() {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
const slim = (c) => ({ id: c.id, title: c.title, company: c.company, yearLabel: c.yearLabel, episodes: c.checkpoints ? episodesOf(c).map((e) => ({ title: e.title, dateLabel: e.dateLabel, decisions: e.decisions.map((k) => k.id) })) : c.episodes || [], model: c.model });

export function setChatItems(next) {
  items = typeof next === 'function' ? next(items) : next;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items.slice(-40).map((m) => (m.season ? { ...m, season: slim(m.season) } : m))));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f(items));
}
export function useChatItems() {
  const [v, setV] = useState(items);
  useEffect(() => {
    subs.add(setV);
    return () => subs.delete(setV);
  }, []);
  return v;
}

onJobEvent('chat', (event, d) => {
  if (event === 'reply') setChatItems((list) => [...list, { role: 'assistant', text: d.text, plan: d.plan }]);
  if (event === 'season') {
    const c = d.case;
    saveGeneratedCase(c);
    const library = getState().library || {};
    const own = new Set((library.principles || []).map((p) => p.id));
    const linked = (d.userPrinciples || []).filter((id) => own.has(id));
    const current = library.tags?.[c.id]?.principles || [];
    setCaseTags(c.id, { tags: ['chat-built'], principles: [...current, ...linked] });
    setChatItems((list) => [...list, { role: 'assistant', season: c, linked }]);
    notifyEvent('researchDone', { key: `chat|${c.id}`, title: 'Season built', body: `“${c.title}” is ready to play.`, link: `/cases/${c.id}` });
  }
  if (event === 'season-error') setChatItems((list) => [...list, { role: 'assistant', error: `Could not build "${d.subject}": ${d.message}` }]);
  if (event === 'failure') setChatItems((list) => [...list, { role: 'assistant', error: d.message }]);
});
