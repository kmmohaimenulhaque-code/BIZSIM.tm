// The principles library as the app sees it: BIZSIM's built-in books and
// principles plus the user's own, and the user's tags on seasons and cases.
import { useMemo } from 'react';
import { BOOKS, PRINCIPLES } from '@shared/books.js';
import { useStore, getState } from './store.js';
import { t } from '../i18n/index.js';

// Placeholder "book" for the user's own principles, in the interface language.
const noBook = () => ({ id: '', title: t('library.myNotes'), author: t('library.you'), year: 0, theme: t('library.myLibrary'), custom: true });

function build(library) {
  const l = library || {};
  const books = [...BOOKS, ...(l.books || [])];
  const principles = [...PRINCIPLES, ...(l.principles || [])];
  const bookById = Object.fromEntries(books.map((b) => [b.id, b]));
  return {
    books,
    principles,
    bookById,
    principleById: Object.fromEntries(principles.map((p) => [p.id, p])),
    bookOf: (p) => bookById[p?.book] || noBook(),
    tags: l.tags || {},
    customBooks: l.books || [],
    customPrinciples: l.principles || [],
  };
}

export function useLibrary() {
  const library = useStore((s) => s.library);
  return useMemo(() => build(library), [library]);
}
export const libraryNow = () => build(getState().library);

/** Every tag the user has used, most used first. */
export function allTags(lib) {
  const count = {};
  for (const t of Object.values(lib.tags)) for (const x of t.tags || []) count[x] = (count[x] || 0) + 1;
  for (const p of lib.customPrinciples) for (const x of p.tags || []) count[x] = (count[x] || 0) + 1;
  return Object.keys(count).sort((a, b) => count[b] - count[a] || a.localeCompare(b));
}

/** Principle ids a case cites itself, plus the ones the user linked to it. */
export function casePrinciples(c, lib) {
  const own = new Set([...(c.concept?.principles || []), ...(c.checkpoints || []).flatMap((k) => k.options.flatMap((o) => o.principles || [])), ...(c.outcome?.lessons || []).flatMap((l) => l.principles || [])]);
  return { builtIn: [...own], linked: (lib.tags[c.id]?.principles || []).filter((id) => !own.has(id)) };
}
