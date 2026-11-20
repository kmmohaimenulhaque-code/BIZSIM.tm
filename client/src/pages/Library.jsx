// Principles library: BIZSIM's built-in books and principles plus the user's
// own. Users can add books and principles, tag them, and link them to any
// season or case. Everything is stored on this device and moves with QR transfer.
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Search, Plus, Pencil, Trash2, Tag, X, Library as LibraryIcon, Link2 } from 'lucide-react';
import { CASES } from '@shared/cases/index.js';
import { Badge, Button, Callout, Empty, Tabs, TabPanel, toast } from '../components/ui.jsx';
import { useStore, saveBook, removeBook, savePrinciple, removePrinciple, setCaseTags } from '../lib/store.js';
import { useLibrary, allTags } from '../lib/library.js';

const splitTags = (s) =>
  String(s || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

function useAllCases() {
  const mine = useStore((s) => s.myCases);
  return useMemo(() => [...CASES, ...mine], [mine]);
}

/** Search-and-pick seasons (built-in and the user's own). */
export function SeasonPicker({ value, onChange, label = 'Linked seasons' }) {
  const all = useAllCases();
  const [q, setQ] = useState('');
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all]);
  const hits = q.trim().length < 2 ? [] : all.filter((c) => !value.includes(c.id) && `${c.title} ${c.company} ${c.yearLabel}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="field">
      <label htmlFor="season-pick">{label}</label>
      {value.length > 0 && (
        <div className="badges">
          {value.map((id) => (
            <span key={id} className="badge">
              {byId[id]?.company || id}
              <button type="button" className="chip-x" aria-label={`Unlink ${byId[id]?.company || id}`} onClick={() => onChange(value.filter((x) => x !== id))}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input id="season-pick" className="input" type="search" placeholder="Type a company, person or year to link a season" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <ul className="pick-list">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...value, c.id]);
                  setQ('');
                }}
              >
                <strong>{c.company}</strong> <span className="meta">{c.title} · {c.yearLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrincipleForm({ initial, onDone }) {
  const lib = useLibrary();
  const [name, setName] = useState(initial?.name || '');
  const [idea, setIdea] = useState(initial?.idea || '');
  const [apply, setApply] = useState(initial?.apply || '');
  const [book, setBook] = useState(initial?.book ?? '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  // Seasons linked to this principle live on each season's tag record.
  const linkedNow = useMemo(() => (initial?.id ? Object.entries(lib.tags).filter(([, t]) => (t.principles || []).includes(initial.id)).map(([id]) => id) : []), [initial, lib.tags]);
  const [seasons, setSeasons] = useState(linkedNow);
  const save = (e) => {
    e.preventDefault();
    if (!name.trim() || !idea.trim()) return toast('Give the principle a name and the idea in a sentence or two.', 'error');
    const id = savePrinciple({ ...(initial?.custom ? initial : {}), id: initial?.custom ? initial.id : undefined, name: name.trim(), idea: idea.trim(), apply: apply.trim(), book, tags: splitTags(tags) });
    for (const cid of new Set([...linkedNow, ...seasons])) {
      const cur = lib.tags[cid]?.principles || [];
      const want = seasons.includes(cid);
      const has = cur.includes(id);
      if (want && !has) setCaseTags(cid, { principles: [...cur, id] });
      if (!want && has) setCaseTags(cid, { principles: cur.filter((x) => x !== id) });
    }
    toast(initial?.custom ? 'Principle updated' : 'Principle added to your library');
    onDone();
  };
  return (
    <form className="panel panel-pad stack gap-3" onSubmit={save} aria-label={initial ? 'Edit principle' : 'Add a principle'}>
      <h2 className="h3">{initial?.custom ? 'Edit principle' : 'Add a principle'}</h2>
      <div className="field">
        <label htmlFor="pr-name">Name</label>
        <input id="pr-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trust compounds faster than capital" />
      </div>
      <div className="field">
        <label htmlFor="pr-idea">The idea, in your own words</label>
        <textarea id="pr-idea" className="input" rows={3} maxLength={600} value={idea} onChange={(e) => setIdea(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pr-apply">How to apply it (optional)</label>
        <textarea id="pr-apply" className="input" rows={2} maxLength={400} value={apply} onChange={(e) => setApply(e.target.value)} />
      </div>
      <div className="row gap-3 wrap">
        <div className="field grow" style={{ minWidth: 200 }}>
          <label htmlFor="pr-book">Book or source</label>
          <select id="pr-book" className="select" value={book} onChange={(e) => setBook(e.target.value)}>
            <option value="">My own note</option>
            {lib.customBooks.length > 0 && (
              <optgroup label="My books">
                {lib.customBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="BIZSIM library">
              {lib.books
                .filter((b) => !b.custom)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
        <div className="field grow" style={{ minWidth: 200 }}>
          <label htmlFor="pr-tags">Tags (comma separated)</label>
          <input id="pr-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="trust, trade, ethics" />
        </div>
      </div>
      <SeasonPicker value={seasons} onChange={setSeasons} />
      <div className="row gap-2">
        <Button type="submit" variant="primary">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function BookForm({ initial, onDone }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [author, setAuthor] = useState(initial?.author || '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [theme, setTheme] = useState(initial?.theme || '');
  const [note, setNote] = useState(initial?.note || '');
  const save = (e) => {
    e.preventDefault();
    if (!title.trim()) return toast('Give the book a title.', 'error');
    saveBook({ ...(initial || {}), title: title.trim(), author: author.trim() || 'Unknown author', year: Number(year) || 0, theme: theme.trim() || 'My library', note: note.trim() });
    toast(initial ? 'Book updated' : 'Book added. Now add its principles.');
    onDone();
  };
  return (
    <form className="panel panel-pad stack gap-3" onSubmit={save} aria-label={initial ? 'Edit book' : 'Add a book'}>
      <h2 className="h3">{initial ? 'Edit book' : 'Add a book'}</h2>
      <div className="row gap-3 wrap">
        <div className="field grow" style={{ minWidth: 220 }}>
          <label htmlFor="bk-title">Title</label>
          <input id="bk-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="bk-author">Author</label>
          <input id="bk-author" className="input" maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
      </div>
      <div className="row gap-3 wrap">
        <div className="field" style={{ width: 120 }}>
          <label htmlFor="bk-year">Year</label>
          <input id="bk-year" className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/[^\d-]/g, '').slice(0, 5))} />
        </div>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="bk-theme">Theme</label>
          <input id="bk-theme" className="input" maxLength={40} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Islamic economics, Leadership" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="bk-note">Why it matters to you (optional)</label>
        <textarea id="bk-note" className="input" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="row gap-2">
        <Button type="submit" variant="primary">
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function Principles() {
  const lib = useLibrary();
  const all = useAllCases();
  const loc = useLocation();
  const [tab, setTab] = useState('principles');
  const [q, setQ] = useState('');
  const [book, setBook] = useState('');
  const [tag, setTag] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [editing, setEditing] = useState(null); // { kind: 'principle'|'book', item? }

  const usage = useMemo(() => {
    const m = {};
    for (const c of all) {
      const ids = new Set([...(c.concept?.principles || []), ...c.checkpoints.flatMap((k) => k.options.flatMap((o) => o.principles || [])), ...(c.outcome?.lessons || []).flatMap((l) => l.principles || [])]);
      for (const id of lib.tags[c.id]?.principles || []) ids.add(id);
      ids.forEach((id) => (m[id] = [...(m[id] || []), c]));
    }
    return m;
  }, [all, lib.tags]);
  const caseById = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all]);
  const tags = allTags(lib);

  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ block: 'center' });
  }, [loc.hash]);

  const list = lib.principles.filter((p) => {
    const b = lib.bookOf(p);
    if (onlyMine && !p.custom) return false;
    if (book && p.book !== book) return false;
    if (tag && !(p.tags || []).includes(tag)) return false;
    return !q || `${p.name} ${p.idea} ${p.apply || ''} ${(p.tags || []).join(' ')} ${b.title} ${b.author}`.toLowerCase().includes(q.toLowerCase());
  });
  const mineCount = lib.customPrinciples.length + lib.customBooks.length;

  const del = (kind, item) => {
    if (!window.confirm(`Delete "${item.name || item.title}" from your library?`)) return;
    if (kind === 'book') removeBook(item.id);
    else removePrinciple(item.id);
    toast('Deleted');
  };

  return (
    <div className="stack gap-6">
      <header className="row between wrap gap-4" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-3">
          <div className="eyebrow eyebrow-rule">Principles library</div>
          <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
            The ideas behind the decisions.
          </h1>
          <p className="lead">
            {lib.principles.length} principles from {lib.books.length} books{mineCount ? `, ${mineCount} of them yours` : ''}. Add your own books and principles, tag them, and link them to any season.
          </p>
        </div>
        <div className="row gap-2 wrap">
          <Button icon={Plus} variant="primary" onClick={() => setEditing({ kind: 'principle' })}>
            Add principle
          </Button>
          <Button icon={BookOpen} onClick={() => setEditing({ kind: 'book' })}>
            Add book
          </Button>
        </div>
      </header>

      {editing?.kind === 'principle' && <PrincipleForm initial={editing.item} onDone={() => setEditing(null)} />}
      {editing?.kind === 'book' && <BookForm initial={editing.item} onDone={() => setEditing(null)} />}

      <Tabs
        label="Library sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'principles', label: 'Principles', count: lib.principles.length },
          { id: 'books', label: 'Books', count: lib.books.length },
          { id: 'tags', label: 'My tags', count: Object.keys(lib.tags).length },
        ]}
      />

      <TabPanel id="principles" active={tab === 'principles'}>
        <div className="stack gap-4">
          <div className="row wrap gap-3">
            <div className="search-field grow" style={{ maxWidth: 420 }}>
              <Search aria-hidden="true" />
              <input className="input" type="search" placeholder="Search principles, tags, books" aria-label="Search principles" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="select" aria-label="Filter by book" value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">All books</option>
              {lib.books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.custom ? `${b.title} (mine)` : b.title}
                </option>
              ))}
            </select>
            {tags.length > 0 && (
              <select className="select" aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <label className="row gap-2 meta" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> Only mine
            </label>
          </div>
          <Callout icon={BookOpen}>Every built-in principle is summarised in BIZSIM's own words with attribution; no passages are reproduced. Your own principles stay on this device and travel with QR transfer.</Callout>
          <div className="case-grid">
            {list.map((p) => {
              const b = lib.bookOf(p);
              const used = usage[p.id] || [];
              return (
                <article key={p.id} id={p.id} className={`panel panel-pad stack gap-3${p.custom ? ' mine-card' : ''}`} style={loc.hash === `#${p.id}` ? { borderColor: 'var(--accent)' } : undefined}>
                  <div className="row between gap-2">
                    <span className="meta-caps">{b.theme}</span>
                    {p.custom && <Badge tone="accent">Mine</Badge>}
                  </div>
                  <h2 className="h3">{p.name}</h2>
                  <p className="muted">{p.idea}</p>
                  {p.apply && <p className="meta">How to apply: {p.apply}</p>}
                  <p className="meta">
                    {b.title}, {b.author}
                    {b.year > 0 ? `, ${b.year}` : ''}
                  </p>
                  {(p.tags || []).length > 0 && (
                    <div className="badges">
                      {p.tags.map((t) => (
                        <button key={t} type="button" className="badge tag-badge" onClick={() => setTag(t)}>
                          <Tag size={11} aria-hidden="true" /> {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {used.length > 0 && (
                    <div className="badges">
                      {used.slice(0, 12).map((c) => (
                        <Link key={c.id} to={`/cases/${c.id}`} className="badge">
                          {c.company}
                        </Link>
                      ))}
                      {used.length > 12 && <span className="meta">+{used.length - 12} more</span>}
                    </div>
                  )}
                  <div className="row gap-2" style={{ marginTop: 'auto' }}>
                    {p.custom ? (
                      <>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing({ kind: 'principle', item: p })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${p.name}`} onClick={() => del('principle', p)} />
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" icon={Link2} onClick={() => setEditing({ kind: 'principle', item: { ...p, custom: false } })} title="Make your own version linked to seasons">
                        Adapt as mine
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!list.length && <Empty icon={Search}>No principles match.</Empty>}
        </div>
      </TabPanel>

      <TabPanel id="books" active={tab === 'books'}>
        <div className="case-grid">
          {lib.books.map((b) => {
            const n = lib.principles.filter((p) => p.book === b.id).length;
            return (
              <article key={b.id} className={`panel panel-pad stack gap-2${b.custom ? ' mine-card' : ''}`}>
                <div className="row between gap-2">
                  <span className="meta-caps">{b.theme}</span>
                  {b.custom && <Badge tone="accent">Mine</Badge>}
                </div>
                <h2 className="h3">{b.title}</h2>
                <p className="meta">
                  {b.author}
                  {b.year > 0 ? `, ${b.year}` : b.year < 0 ? `, c. ${-b.year} BCE` : ''}
                </p>
                {b.note && <p className="muted">{b.note}</p>}
                <div className="row between gap-2" style={{ marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="link meta"
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    onClick={() => {
                      setBook(b.id);
                      setTab('principles');
                    }}
                  >
                    {n} principle{n === 1 ? '' : 's'}
                  </button>
                  {b.custom && (
                    <span className="row gap-1">
                      <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Edit ${b.title}`} onClick={() => setEditing({ kind: 'book', item: b })} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${b.title}`} onClick={() => del('book', b)} />
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </TabPanel>

      <TabPanel id="tags" active={tab === 'tags'}>
        {Object.keys(lib.tags).length === 0 ? (
          <Empty icon={LibraryIcon} title="No tagged seasons yet">
            Open any season and use "Your tags and principles" to tag it or link principles from your library. Tagged seasons appear here and in the season search.
          </Empty>
        ) : (
          <div className="stack gap-4">
            {tags.map((t) => {
              const ids = Object.entries(lib.tags)
                .filter(([, x]) => (x.tags || []).includes(t))
                .map(([id]) => id)
                .filter((id) => caseById[id]);
              if (!ids.length) return null;
              return (
                <section key={t} className="panel panel-pad stack gap-2">
                  <h2 className="h3 row gap-2">
                    <Tag size={16} aria-hidden="true" /> {t}
                  </h2>
                  <div className="badges">
                    {ids.map((id) => (
                      <Link key={id} to={`/cases/${id}`} className="badge">
                        {caseById[id].company} · {caseById[id].title}
                      </Link>
                    ))}
                  </div>
                  <Link to={`/cases?tag=${encodeURIComponent(t)}`} className="link meta">
                    Show in seasons
                  </Link>
                </section>
              );
            })}
          </div>
        )}
      </TabPanel>
    </div>
  );
}

/** "Your tags and principles" box shown on every season. */
export function CaseTagEditor({ c }) {
  const lib = useLibrary();
  const mine = lib.tags[c.id] || { tags: [], principles: [] };
  const [text, setText] = useState('');
  const [pq, setPq] = useState('');
  const known = allTags(lib).filter((t) => !mine.tags.includes(t));
  const addTag = (t) => {
    const list = splitTags(t);
    if (list.length) setCaseTags(c.id, { tags: [...mine.tags, ...list] });
    setText('');
  };
  const hits = pq.trim().length < 2 ? [] : lib.principles.filter((p) => !mine.principles.includes(p.id) && `${p.name} ${p.idea} ${(p.tags || []).join(' ')}`.toLowerCase().includes(pq.toLowerCase())).slice(0, 6);
  return (
    <section className="panel panel-pad stack gap-3" aria-labelledby={`tags-${c.id}`}>
      <h2 id={`tags-${c.id}`} className="section-title row gap-2">
        <Tag size={16} aria-hidden="true" /> Your tags and principles
      </h2>
      <div className="badges">
        {mine.tags.map((t) => (
          <span key={t} className="badge tag-badge">
            {t}
            <button type="button" className="chip-x" aria-label={`Remove tag ${t}`} onClick={() => setCaseTags(c.id, { tags: mine.tags.filter((x) => x !== t) })}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        {!mine.tags.length && <span className="meta">No tags yet.</span>}
      </div>
      <form
        className="row gap-2 wrap"
        onSubmit={(e) => {
          e.preventDefault();
          addTag(text);
        }}
      >
        <input className="input grow" style={{ minWidth: 160 }} aria-label="Add a tag" placeholder="Add tags, comma separated" value={text} onChange={(e) => setText(e.target.value)} list={`tag-list-${c.id}`} />
        <datalist id={`tag-list-${c.id}`}>
          {known.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <Button type="submit" size="sm" icon={Plus} disabled={!text.trim()}>
          Tag
        </Button>
      </form>
      <div className="stack gap-2">
        <span className="meta">Principles you linked to this season</span>
        <div className="badges">
          {mine.principles.map((id) => {
            const p = lib.principleById[id];
            if (!p) return null;
            return (
              <span key={id} className="badge">
                <Link to={`/principles#${id}`}>{p.name}</Link>
                <button type="button" className="chip-x" aria-label={`Unlink ${p.name}`} onClick={() => setCaseTags(c.id, { principles: mine.principles.filter((x) => x !== id) })}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            );
          })}
          {!mine.principles.length && <span className="meta">None yet.</span>}
        </div>
        <input className="input" type="search" aria-label="Link a principle" placeholder="Search your library to link a principle" value={pq} onChange={(e) => setPq(e.target.value)} />
        {hits.length > 0 && (
          <ul className="pick-list">
            {hits.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCaseTags(c.id, { principles: [...mine.principles, p.id] });
                    setPq('');
                  }}
                >
                  <strong>{p.name}</strong> <span className="meta">{lib.bookOf(p).title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link to="/principles" className="link meta">
          Add your own principle or book
        </Link>
      </div>
    </section>
  );
}
