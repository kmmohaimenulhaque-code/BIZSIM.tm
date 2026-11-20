// Bookmarks and collections: save seasons, episodes, decisions, principles and
// companies into named collections. Only references are stored.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Button, Dialog, Empty, toast } from './ui.jsx';
import { useStore, collectionsOf, toggleInCollection, createCollection, renameCollection, removeCollection, removeFromCollection, isSaved } from '../lib/store.js';
import { findCase } from '../lib/sim.js';
import { useLibrary } from '../lib/library.js';
import { episodesOf } from '@shared/episodes.js';
import { CASES } from '@shared/cases/index.js';

export const REF_LABEL = { season: 'Season', episode: 'Episode', decision: 'Decision', principle: 'Principle', company: 'Company' };

/** Save button: opens a small dialog to choose collections. */
export function BookmarkButton({ item, size = 'sm', variant = 'ghost', compact = false }) {
  const saved = useStore((s) => isSaved(s, item));
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} icon={saved ? BookmarkCheck : Bookmark} aria-pressed={saved} aria-label={compact ? `${saved ? 'Saved' : 'Save'}: ${item.label || REF_LABEL[item.type]}` : undefined} onClick={() => setOpen(true)}>
        {compact ? null : saved ? 'Saved' : 'Save'}
      </Button>
      {open && <SaveDialog item={item} onClose={() => setOpen(false)} />}
    </>
  );
}

function SaveDialog({ item, onClose }) {
  const cols = useStore((s) => collectionsOf(s));
  const [name, setName] = useState('');
  const has = (c) => c.items.some((i) => i.type === item.type && i.id === String(item.id));
  const add = (e) => {
    e.preventDefault();
    try {
      const id = createCollection(name);
      toggleInCollection(id, item);
      setName('');
      toast(`Saved to ${name.trim()}`);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <Dialog title={`Save ${REF_LABEL[item.type].toLowerCase()}`} onClose={onClose}>
      <p className="muted">{item.label}</p>
      <fieldset className="stack gap-2" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Collections</legend>
        {cols.map((c) => (
          <label key={c.id} className="row gap-2 collection-check">
            <input type="checkbox" checked={has(c)} onChange={() => toggleInCollection(c.id, item)} />
            <span className="grow">{c.name}</span>
            <span className="meta num">{c.items.length}</span>
          </label>
        ))}
      </fieldset>
      <form className="row gap-2" onSubmit={add}>
        <label htmlFor="new-col" className="sr-only">
          New collection name
        </label>
        <input id="new-col" className="input grow" placeholder="New collection" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" icon={Plus} disabled={!name.trim()}>
          Add
        </Button>
      </form>
      <div>
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}

/** Turn a stored reference into something displayable, or null if it no longer exists. */
function useResolver() {
  const lib = useLibrary();
  const companies = useStore((s) => s.savedCompanies);
  useStore((s) => s.myCases);
  return (r) => {
    if (r.type === 'season') {
      const c = findCase(r.id);
      return c && { title: c.title, sub: `${c.company} · ${c.yearLabel}`, to: `/cases/${encodeURIComponent(c.id)}` };
    }
    if (r.type === 'episode' || r.type === 'decision') {
      const c = findCase(r.caseId);
      if (!c) return null;
      if (r.type === 'episode') {
        const ep = episodesOf(c).find((e) => String(e.n) === String(r.id).split(':').pop());
        return ep && { title: `Episode ${ep.roman}: ${ep.title}`, sub: c.title, to: `/cases/${encodeURIComponent(c.id)}` };
      }
      const k = c.checkpoints.find((x) => x.id === String(r.id).split(':').pop());
      return k && { title: k.prompt, sub: c.title, to: `/cases/${encodeURIComponent(c.id)}` };
    }
    if (r.type === 'principle') {
      const p = lib.principleById[r.id];
      return p && { title: p.name, sub: lib.bookOf(p).title, to: '/principles' };
    }
    if (r.type === 'company') {
      const co = companies.find((x) => x.id === r.id);
      return { title: co?.name || r.label || r.id, sub: co ? 'Saved company' : 'Company', to: `/research?q=${encodeURIComponent(co?.name || r.label || r.id)}` };
    }
    return null;
  };
}

/** Seasons that fit a default collection, offered as suggestions. */
const SUGGEST = {
  'startup-strategy': (c) => c.pillar === 'STRATEGY' && ['CONTEMPORARY', 'MODERN'].includes(c.era),
  'crisis-management': (c) => c.pillar === 'TURNAROUND',
  leadership: (c) => c.pillar === 'LEADERSHIP',
  finance: (c) => c.pillar === 'FINANCE',
  marketing: (c) => c.pillar === 'BRAND',
  'historical-business-cases': (c) => ['ANCIENT', 'MEDIEVAL', 'EARLY_MODERN', 'INDUSTRIAL'].includes(c.era),
};

export function CollectionsPage() {
  const cols = useStore((s) => collectionsOf(s));
  const resolve = useResolver();
  const [activeId, setActiveId] = useState(null);
  const [q, setQ] = useState('');
  const [renaming, setRenaming] = useState(null);
  const active = cols.find((c) => c.id === activeId) || null;

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return null;
    const out = [];
    for (const c of cols)
      for (const r of c.items) {
        const v = resolve(r);
        const hay = `${v?.title || ''} ${v?.sub || ''} ${r.label || ''}`.toLowerCase();
        if (hay.includes(term)) out.push({ c, r, v });
      }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cols]);

  const Item = ({ c, r }) => {
    const v = resolve(r);
    return (
      <li className="collection-item row gap-3 between">
        <div style={{ minWidth: 0 }} className="grow">
          <span className="meta-caps">{REF_LABEL[r.type]}</span>
          {v ? (
            <Link to={v.to} className="collection-title">
              {v.title}
            </Link>
          ) : (
            <span className="collection-title muted">{r.label || r.id} (no longer on this device)</span>
          )}
          {v?.sub && <div className="meta">{v.sub}</div>}
        </div>
        <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${v?.title || r.label || r.id} from ${c.name}`} onClick={() => removeFromCollection(c.id, r)} />
      </li>
    );
  };

  return (
    <div className="stack gap-6" style={{ maxWidth: 980 }}>
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">Workspace</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          Collections
        </h1>
        <p className="lead">Save seasons, episodes, decisions, principles and companies into collections. They are stored on this device and included in backups.</p>
      </header>
      <div className="field">
        <label htmlFor="col-search" className="sr-only">
          Search collections
        </label>
        <input id="col-search" className="input" type="search" placeholder="Search your collections" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {results ? (
        <section className="panel panel-pad stack gap-3" aria-live="polite">
          <h2 className="section-title">
            {results.length} result{results.length === 1 ? '' : 's'}
          </h2>
          <ul className="collection-items">
            {results.map(({ c, r }) => (
              <Item key={`${c.id}|${r.type}|${r.id}`} c={c} r={r} />
            ))}
          </ul>
        </section>
      ) : active ? (
        <section className="panel panel-pad stack gap-4">
          <div className="row between wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
              ← All collections
            </Button>
            <div className="row gap-2">
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setRenaming(active)}>
                Rename
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => {
                  if (window.confirm(`Remove the collection “${active.name}”? The seasons themselves are not deleted.`)) {
                    removeCollection(active.id);
                    setActiveId(null);
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </div>
          <h2 className="h2">{active.name}</h2>
          {active.items.length ? (
            <ul className="collection-items">
              {active.items.map((r) => (
                <Item key={`${r.type}|${r.id}`} c={active} r={r} />
              ))}
            </ul>
          ) : (
            <Empty icon={Bookmark} title="Nothing here yet">
              Use Save on a season, episode, decision, principle or company to add it.
            </Empty>
          )}
          {SUGGEST[active.id] && <Suggestions col={active} />}
        </section>
      ) : (
        <div className="collection-grid">
          {cols.map((c) => (
            <button key={c.id} className="panel panel-pad collection-card" onClick={() => setActiveId(c.id)}>
              <FolderOpen aria-hidden="true" />
              <span className="h3">{c.name}</span>
              <span className="meta num">
                {c.items.length} item{c.items.length === 1 ? '' : 's'}
              </span>
            </button>
          ))}
          <NewCollectionCard />
        </div>
      )}
      {renaming && <RenameDialog col={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

function Suggestions({ col }) {
  const list = useMemo(() => CASES.filter(SUGGEST[col.id]).filter((c) => !col.items.some((i) => i.type === 'season' && i.id === c.id)).slice(0, 8), [col]);
  if (!list.length) return null;
  return (
    <div className="stack gap-2">
      <h3 className="section-title">Suggested seasons</h3>
      <ul className="collection-items">
        {list.map((c) => (
          <li key={c.id} className="collection-item row gap-3 between">
            <div className="grow" style={{ minWidth: 0 }}>
              <Link to={`/cases/${c.id}`} className="collection-title">
                {c.title}
              </Link>
              <div className="meta">
                {c.company} · {c.yearLabel}
              </div>
            </div>
            <Button size="sm" icon={Plus} onClick={() => toggleInCollection(col.id, { type: 'season', id: c.id, label: c.title })} aria-label={`Add ${c.title}`}>
              Add
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewCollectionCard() {
  const [name, setName] = useState('');
  return (
    <form
      className="panel panel-pad collection-card stack gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          createCollection(name);
          setName('');
          toast('Collection created');
        } catch (err) {
          toast(err.message, 'error');
        }
      }}
    >
      <label htmlFor="nc" className="h3">
        New collection
      </label>
      <input id="nc" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <Button type="submit" icon={Plus} disabled={!name.trim()}>
        Create
      </Button>
    </form>
  );
}

function RenameDialog({ col, onClose }) {
  const [name, setName] = useState(col.name);
  return (
    <Dialog title="Rename collection" onClose={onClose}>
      <form
        className="stack gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            renameCollection(col.id, name);
            onClose();
          } catch (err) {
            toast(err.message, 'error');
          }
        }}
      >
        <label htmlFor="rn" className="sr-only">
          Name
        </label>
        <input id="rn" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <div className="row gap-2">
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Save
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
