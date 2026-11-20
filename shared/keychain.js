// The AI key chain: an ordered list of keys that BIZSIM tries top to bottom.
// Shared by the server (keys saved on the computer) and the app (keys kept on a phone).
export const PROVIDER_RANK = ['anthropic', 'openai', 'gemini', 'nvidia', 'groq', 'xai', 'openrouter', 'custom'];
const rank = (p) => {
  const i = PROVIDER_RANK.indexOf(p);
  return i < 0 ? PROVIDER_RANK.length : i;
};

/** Insert a new key where it belongs by default: stronger providers first, then the order keys were added. */
export function insertByRank(list, entry) {
  const same = list.findIndex((e) => e.key === entry.key && (e.baseUrl || '') === (entry.baseUrl || ''));
  if (same >= 0) {
    const next = list.slice();
    next[same] = { ...list[same], ...entry, id: list[same].id, enabled: true };
    return next;
  }
  const at = list.findIndex((e) => rank(e.provider) > rank(entry.provider));
  const next = list.slice();
  next.splice(at < 0 ? next.length : at, 0, entry);
  return next;
}

/**
 * Apply one change to the chain.
 * op: { type: 'add', entry } | { type: 'remove', id } | { type: 'move', id, dir: -1|1 }
 *   | { type: 'toggle', id } | { type: 'models', id, models } | { type: 'sort' }
 */
export function applyChainOp(list, op) {
  const i = list.findIndex((e) => e.id === op.id);
  const next = list.slice();
  switch (op.type) {
    case 'add':
      return insertByRank(list, op.entry);
    case 'remove':
      return i < 0 ? list : list.filter((e) => e.id !== op.id);
    case 'move': {
      const j = i + (op.dir < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= list.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }
    case 'toggle':
      if (i >= 0) next[i] = { ...next[i], enabled: next[i].enabled === false };
      return next;
    case 'models':
      if (i >= 0 && Array.isArray(op.models) && op.models.length) next[i] = { ...next[i], models: op.models.slice(0, 6) };
      return next;
    case 'sort':
      return list.slice().sort((a, b) => rank(a.provider) - rank(b.provider));
    default:
      return list;
  }
}
