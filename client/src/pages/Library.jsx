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
import { useTranslation, t as tr, useLocale } from '../i18n/index.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import { formatInteger } from '../i18n/format.js';

// Tags are separated by commas in any script (Latin, Arabic, Chinese/Japanese).
const splitTags = (s) =>
  String(s || '')
    .split(/[,،，、]/)
    .map((x) => x.trim())
    .filter(Boolean);

// The theme of the user's own books is stored as "My library"; show it in the interface language.
const themeLabel = (theme) => (theme === 'My library' ? tr('library.myLibrary') : theme);

function useAllCases() {
  const mine = useStore((s) => s.myCases);
  return useMemo(() => [...CASES, ...mine], [mine]);
}

/** Search-and-pick seasons (built-in and the user's own). */
export function SeasonPicker({ value, onChange, label }) {
  const { t } = useTranslation();
  const all = useAllCases();
  const [q, setQ] = useState('');
  const byId = useMemo(() => Object.fromEntries(all.map((c) => [c.id, c])), [all]);
  const hits = q.trim().length < 2 ? [] : all.filter((c) => !value.includes(c.id) && `${c.title} ${c.company} ${c.yearLabel}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <div className="field">
      <label htmlFor="season-pick">{label || t('principles.picker.label')}</label>
      {value.length > 0 && (
        <div className="badges">
          {value.map((id) => (
            <span key={id} className="badge">
              {byId[id]?.company || id}
              <button type="button" className="chip-x" aria-label={t('principles.picker.unlink', { name: byId[id]?.company || id })} onClick={() => onChange(value.filter((x) => x !== id))}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input id="season-pick" className="input" type="search" placeholder={t('principles.picker.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
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
  const { t } = useTranslation();
  const lib = useLibrary();
  const [name, setName] = useState(initial?.name || '');
  const [idea, setIdea] = useState(initial?.idea || '');
  const [apply, setApply] = useState(initial?.apply || '');
  const [book, setBook] = useState(initial?.book ?? '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  // Seasons linked to this principle live on each season's tag record.
  const linkedNow = useMemo(() => (initial?.id ? Object.entries(lib.tags).filter(([, x]) => (x.principles || []).includes(initial.id)).map(([id]) => id) : []), [initial, lib.tags]);
  const [seasons, setSeasons] = useState(linkedNow);
  const save = (e) => {
    e.preventDefault();
    if (!name.trim() || !idea.trim()) return toast(t('principles.form.needNameIdea'), 'error');
    const id = savePrinciple({ ...(initial?.custom ? initial : {}), id: initial?.custom ? initial.id : undefined, name: name.trim(), idea: idea.trim(), apply: apply.trim(), book, tags: splitTags(tags) });
    for (const cid of new Set([...linkedNow, ...seasons])) {
      const cur = lib.tags[cid]?.principles || [];
      const want = seasons.includes(cid);
      const has = cur.includes(id);
      if (want && !has) setCaseTags(cid, { principles: [...cur, id] });
      if (!want && has) setCaseTags(cid, { principles: cur.filter((x) => x !== id) });
    }
    toast(initial?.custom ? t('principles.form.updated') : t('principles.form.added'));
    onDone();
  };
  return (
    <form className="panel panel-pad stack gap-3" onSubmit={save} aria-label={initial ? t('principles.form.edit') : t('principles.form.add')}>
      <h2 className="h3">{initial?.custom ? t('principles.form.edit') : t('principles.form.add')}</h2>
      <div className="field">
        <label htmlFor="pr-name">{t('principles.form.name')}</label>
        <input id="pr-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('principles.form.namePlaceholder')} dir="auto" />
      </div>
      <div className="field">
        <label htmlFor="pr-idea">{t('principles.form.idea')}</label>
        <textarea id="pr-idea" className="input" rows={3} maxLength={600} value={idea} onChange={(e) => setIdea(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pr-apply">{t('principles.form.apply')}</label>
        <textarea id="pr-apply" className="input" rows={2} maxLength={400} value={apply} onChange={(e) => setApply(e.target.value)} />
      </div>
      <div className="row gap-3 wrap">
        <div className="field grow" style={{ minWidth: 200 }}>
          <label htmlFor="pr-book">{t('principles.form.book')}</label>
          <select id="pr-book" className="select" value={book} onChange={(e) => setBook(e.target.value)}>
            <option value="">{t('principles.form.ownNote')}</option>
            {lib.customBooks.length > 0 && (
              <optgroup label={t('principles.form.myBooks')}>
                {lib.customBooks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={t('principles.form.bizsimLibrary')}>
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
          <label htmlFor="pr-tags">{t('principles.form.tags')}</label>
          <input id="pr-tags" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('principles.form.tagsPlaceholder')} />
        </div>
      </div>
      <SeasonPicker value={seasons} onChange={setSeasons} />
      <div className="row gap-2">
        <Button type="submit" variant="primary">
          {t('common.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

function BookForm({ initial, onDone }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title || '');
  const [author, setAuthor] = useState(initial?.author || '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [theme, setTheme] = useState(initial?.theme || '');
  const [note, setNote] = useState(initial?.note || '');
  const save = (e) => {
    e.preventDefault();
    if (!title.trim()) return toast(t('principles.bookForm.needTitle'), 'error');
    saveBook({ ...(initial || {}), title: title.trim(), author: author.trim() || t('principles.bookForm.unknownAuthor'), year: Number(year) || 0, theme: theme.trim() || 'My library', note: note.trim() });
    toast(initial ? t('principles.bookForm.updated') : t('principles.bookForm.added'));
    onDone();
  };
  return (
    <form className="panel panel-pad stack gap-3" onSubmit={save} aria-label={initial ? t('principles.bookForm.edit') : t('principles.bookForm.add')}>
      <h2 className="h3">{initial ? t('principles.bookForm.edit') : t('principles.bookForm.add')}</h2>
      <div className="row gap-3 wrap">
        <div className="field grow" style={{ minWidth: 220 }}>
          <label htmlFor="bk-title">{t('principles.bookForm.title')}</label>
          <input id="bk-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="bk-author">{t('principles.bookForm.author')}</label>
          <input id="bk-author" className="input" maxLength={80} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
      </div>
      <div className="row gap-3 wrap">
        <div className="field" style={{ width: 120 }}>
          <label htmlFor="bk-year">{t('principles.bookForm.year')}</label>
          <input id="bk-year" className="input" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/[^\d-]/g, '').slice(0, 5))} />
        </div>
        <div className="field grow" style={{ minWidth: 180 }}>
          <label htmlFor="bk-theme">{t('principles.bookForm.theme')}</label>
          <input id="bk-theme" className="input" maxLength={40} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder={t('principles.bookForm.themePlaceholder')} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="bk-note">{t('principles.bookForm.note')}</label>
        <textarea id="bk-note" className="input" rows={2} maxLength={400} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="row gap-2">
        <Button type="submit" variant="primary">
          {t('common.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}

export default function Principles() {
  const { t } = useTranslation();
  const locale = useLocale();
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
    if (!window.confirm(t('principles.confirmDelete', { name: item.name || item.title }))) return;
    if (kind === 'book') removeBook(item.id);
    else removePrinciple(item.id);
    toast(t('principles.deleted'));
  };

  return (
    <div className="stack gap-6">
      <header className="row between wrap gap-4" style={{ alignItems: 'flex-end' }}>
        <div className="stack gap-3">
          <div className="eyebrow eyebrow-rule">{t('principles.eyebrow')}</div>
          <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
            {t('principles.title')}
          </h1>
          <p className="lead">{t(mineCount ? 'principles.leadMine' : 'principles.lead', { principles: formatInteger(lib.principles.length), books: formatInteger(lib.books.length), mine: formatInteger(mineCount) })}</p>
        </div>
        <div className="row gap-2 wrap">
          <Button icon={Plus} variant="primary" onClick={() => setEditing({ kind: 'principle' })}>
            {t('principles.addPrinciple')}
          </Button>
          <Button icon={BookOpen} onClick={() => setEditing({ kind: 'book' })}>
            {t('principles.addBook')}
          </Button>
        </div>
      </header>

      {editing?.kind === 'principle' && <PrincipleForm initial={editing.item} onDone={() => setEditing(null)} />}
      {editing?.kind === 'book' && <BookForm initial={editing.item} onDone={() => setEditing(null)} />}

      <Tabs
        label={t('principles.sections')}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'principles', label: t('principles.tabPrinciples'), count: formatInteger(lib.principles.length) },
          { id: 'books', label: t('principles.tabBooks'), count: formatInteger(lib.books.length) },
          { id: 'tags', label: t('principles.tabTags'), count: formatInteger(Object.keys(lib.tags).length) },
        ]}
      />

      <TabPanel id="principles" active={tab === 'principles'}>
        <div className="stack gap-4">
          <div className="row wrap gap-3">
            <div className="search-field grow" style={{ maxWidth: 420 }}>
              <Search aria-hidden="true" />
              <input className="input" type="search" placeholder={t('principles.searchPlaceholder')} aria-label={t('principles.searchLabel')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="select" aria-label={t('principles.filterBook')} value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">{t('principles.allBooks')}</option>
              {lib.books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.custom ? t('principles.mineSuffix', { title: b.title }) : b.title}
                </option>
              ))}
            </select>
            {tags.length > 0 && (
              <select className="select" aria-label={t('principles.filterTag')} value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">{t('principles.allTags')}</option>
                {tags.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            )}
            <label className="row gap-2 meta" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /> {t('principles.onlyMine')}
            </label>
          </div>
          <Callout icon={BookOpen}>
            {t('principles.builtInNote')}
            {LOCALE_BY_CODE[locale]?.language !== 'en' ? ` ${t('principles.contentNote')}` : ''}
          </Callout>
          <div className="case-grid">
            {list.map((p) => {
              const b = lib.bookOf(p);
              const used = usage[p.id] || [];
              return (
                <article key={p.id} id={p.id} className={`panel panel-pad stack gap-3${p.custom ? ' mine-card' : ''}`} style={loc.hash === `#${p.id}` ? { borderColor: 'var(--accent)' } : undefined}>
                  <div className="row between gap-2">
                    <span className="meta-caps" lang={p.custom ? undefined : 'en'}>
                      {themeLabel(b.theme)}
                    </span>
                    {p.custom && <Badge tone="accent">{t('principles.mine')}</Badge>}
                  </div>
                  <h2 className="h3" lang={p.custom ? undefined : 'en'} dir="auto">
                    {p.name}
                  </h2>
                  <p className="muted" lang={p.custom ? undefined : 'en'} dir="auto">
                    {p.idea}
                  </p>
                  {p.apply && <p className="meta">{t('principles.howToApply', { text: p.apply })}</p>}
                  <p className="meta" lang={p.custom ? undefined : 'en'} dir="auto">
                    {b.title}, {b.author}
                    {b.year > 0 ? `, ${b.year}` : ''}
                  </p>
                  {(p.tags || []).length > 0 && (
                    <div className="badges">
                      {p.tags.map((x) => (
                        <button key={x} type="button" className="badge tag-badge" onClick={() => setTag(x)}>
                          <Tag size={11} aria-hidden="true" /> {x}
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
                      {used.length > 12 && <span className="meta">{t('principles.more', { count: used.length - 12 })}</span>}
                    </div>
                  )}
                  <div className="row gap-2" style={{ marginTop: 'auto' }}>
                    {p.custom ? (
                      <>
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing({ kind: 'principle', item: p })}>
                          {t('principles.edit')}
                        </Button>
                        <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('principles.deleteItem', { name: p.name })} onClick={() => del('principle', p)} />
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" icon={Link2} onClick={() => setEditing({ kind: 'principle', item: { ...p, custom: false } })} title={t('principles.adaptHint')}>
                        {t('principles.adapt')}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!list.length && <Empty icon={Search}>{t('principles.noneMatch')}</Empty>}
        </div>
      </TabPanel>

      <TabPanel id="books" active={tab === 'books'}>
        <div className="case-grid">
          {lib.books.map((b) => {
            const n = lib.principles.filter((p) => p.book === b.id).length;
            return (
              <article key={b.id} className={`panel panel-pad stack gap-2${b.custom ? ' mine-card' : ''}`}>
                <div className="row between gap-2">
                  <span className="meta-caps">{themeLabel(b.theme)}</span>
                  {b.custom && <Badge tone="accent">{t('principles.mine')}</Badge>}
                </div>
                <h2 className="h3" lang={b.custom ? undefined : 'en'} dir="auto">
                  {b.title}
                </h2>
                <p className="meta">
                  {b.author}
                  {b.year > 0 ? `, ${b.year}` : b.year < 0 ? `, ${t('principles.bce', { year: -b.year })}` : ''}
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
                    {t('principles.count', { count: n })}
                  </button>
                  {b.custom && (
                    <span className="row gap-1">
                      <Button size="sm" variant="ghost" icon={Pencil} aria-label={t('principles.editItem', { name: b.title })} onClick={() => setEditing({ kind: 'book', item: b })} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('principles.deleteItem', { name: b.title })} onClick={() => del('book', b)} />
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
          <Empty icon={LibraryIcon} title={t('principles.noTagsTitle')}>
            {t('principles.noTagsBody')}
          </Empty>
        ) : (
          <div className="stack gap-4">
            {tags.map((tg) => {
              const ids = Object.entries(lib.tags)
                .filter(([, x]) => (x.tags || []).includes(tg))
                .map(([id]) => id)
                .filter((id) => caseById[id]);
              if (!ids.length) return null;
              return (
                <section key={tg} className="panel panel-pad stack gap-2">
                  <h2 className="h3 row gap-2">
                    <Tag size={16} aria-hidden="true" /> {tg}
                  </h2>
                  <div className="badges">
                    {ids.map((id) => (
                      <Link key={id} to={`/cases/${id}`} className="badge">
                        {caseById[id].company} · {caseById[id].title}
                      </Link>
                    ))}
                  </div>
                  <Link to={`/cases?tag=${encodeURIComponent(tg)}`} className="link meta">
                    {t('principles.showInSeasons')}
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
  const { t } = useTranslation();
  const lib = useLibrary();
  const mine = lib.tags[c.id] || { tags: [], principles: [] };
  const [text, setText] = useState('');
  const [pq, setPq] = useState('');
  const known = allTags(lib).filter((x) => !mine.tags.includes(x));
  const addTag = (value) => {
    const list = splitTags(value);
    if (list.length) setCaseTags(c.id, { tags: [...mine.tags, ...list] });
    setText('');
  };
  const hits = pq.trim().length < 2 ? [] : lib.principles.filter((p) => !mine.principles.includes(p.id) && `${p.name} ${p.idea} ${(p.tags || []).join(' ')}`.toLowerCase().includes(pq.toLowerCase())).slice(0, 6);
  return (
    <section className="panel panel-pad stack gap-3" aria-labelledby={`tags-${c.id}`}>
      <h2 id={`tags-${c.id}`} className="section-title row gap-2">
        <Tag size={16} aria-hidden="true" /> {t('principles.tagEditor.title')}
      </h2>
      <div className="badges">
        {mine.tags.map((tg) => (
          <span key={tg} className="badge tag-badge">
            {tg}
            <button type="button" className="chip-x" aria-label={t('principles.tagEditor.removeTag', { tag: tg })} onClick={() => setCaseTags(c.id, { tags: mine.tags.filter((x) => x !== tg) })}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        {!mine.tags.length && <span className="meta">{t('principles.tagEditor.noTags')}</span>}
      </div>
      <form
        className="row gap-2 wrap"
        onSubmit={(e) => {
          e.preventDefault();
          addTag(text);
        }}
      >
        <input className="input grow" style={{ minWidth: 160 }} aria-label={t('principles.tagEditor.addTag')} placeholder={t('principles.tagEditor.placeholder')} value={text} onChange={(e) => setText(e.target.value)} list={`tag-list-${c.id}`} />
        <datalist id={`tag-list-${c.id}`}>
          {known.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <Button type="submit" size="sm" icon={Plus} disabled={!text.trim()}>
          {t('principles.tagEditor.tag')}
        </Button>
      </form>
      <div className="stack gap-2">
        <span className="meta">{t('principles.tagEditor.linked')}</span>
        <div className="badges">
          {mine.principles.map((id) => {
            const p = lib.principleById[id];
            if (!p) return null;
            return (
              <span key={id} className="badge">
                <Link to={`/principles#${id}`}>{p.name}</Link>
                <button type="button" className="chip-x" aria-label={t('principles.picker.unlink', { name: p.name })} onClick={() => setCaseTags(c.id, { principles: mine.principles.filter((x) => x !== id) })}>
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            );
          })}
          {!mine.principles.length && <span className="meta">{t('principles.tagEditor.none')}</span>}
        </div>
        <input className="input" type="search" aria-label={t('principles.tagEditor.link')} placeholder={t('principles.tagEditor.linkPlaceholder')} value={pq} onChange={(e) => setPq(e.target.value)} />
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
          {t('principles.tagEditor.addOwn')}
        </Link>
      </div>
    </section>
  );
}
