import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, FolderOpen, Search, Play, BarChart3, BookOpen, FileText, Building2, Clock, Settings, Info, Sun, Moon, Menu, X, Building, Bookmark, Bell,
} from 'lucide-react';
import { Logo, Toasts } from './ui.jsx';
import { StopVoiceOnNavigate } from './Listen.jsx';
import { useStore, setTheme } from '../lib/store.js';
import { CASES } from '@shared/cases/index.js';
import { libraryNow } from '../lib/library.js';

export const NAV = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Overview', icon: Home, end: true },
      { to: '/cases', label: 'Explore Cases', icon: FolderOpen },
      { to: '/research', label: 'Live Company Research', icon: Search },
      { to: '/simulations', label: 'Simulations', icon: Play },
      { to: '/learning', label: 'Learning Profile', icon: BarChart3 },
      { to: '/principles', label: 'Principles Library', icon: BookOpen },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/my-cases', label: 'My Cases', icon: FileText },
      { to: '/collections', label: 'Collections', icon: Bookmark },
      { to: '/companies', label: 'Saved Companies', icon: Building2 },
      { to: '/history', label: 'Analysis History', icon: Clock },
    ],
  },
];
const SYSTEM = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/about', label: 'About BIZSIM', icon: Info },
];

const TITLES = {
  '': 'Overview',
  cases: 'Explore Cases',
  research: 'Live Company Research',
  simulations: 'Simulations',
  learning: 'Learning Profile',
  principles: 'Principles Library',
  'my-cases': 'My Cases',
  collections: 'Collections',
  notifications: 'Notifications',
  companies: 'Saved Companies',
  history: 'Analysis History',
  settings: 'Settings',
  about: 'About BIZSIM',
};

function NavItem({ item, onClick }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={onClick} title={item.label}>
      <Icon aria-hidden="true" strokeWidth={1.6} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Primary">
      <Link to="/" className="brand" aria-label="BIZSIM home">
        <Logo />
        <span>BIZSIM</span>
      </Link>
      <nav>
        {NAV.map((g) => (
          <div className="nav-group" key={g.label}>
            {g.label !== 'Overview' && <div className="nav-label eyebrow">{g.label}</div>}
            <div className="stack gap-1">
              {g.items.map((i) => (
                <NavItem key={i.to} item={i} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="stack gap-1">
          {SYSTEM.map((i) => (
            <NavItem key={i.to} item={i} />
          ))}
        </div>
        <div className="local-badge" title="Your progress is stored only on this device. No account required.">
          <i className="dot" aria-hidden="true" />
          <span>Local · No account</span>
        </div>
      </div>
    </aside>
  );
}

function useResolvedTheme() {
  const theme = useStore((s) => s.theme);
  const [system, setSystem] = useState(() => (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const h = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  const resolved = theme || system;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f6f7f9' : '#080b10');
  }, [resolved]);
  return resolved;
}

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const myCases = useStore((s) => s.myCases);
  const companies = useStore((s) => s.savedCompanies);
  const nav = useNavigate();
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const match = (...fields) => fields.some((f) => f && f.toLowerCase().includes(s));
    const cases = [...CASES, ...myCases]
      .filter((c) => match(c.title, c.company, c.tagline, c.yearLabel))
      .slice(0, 5)
      .map((c) => ({ group: 'Cases', icon: FolderOpen, label: `${c.title}`, sub: `${c.company} · ${c.yearLabel}`, to: `/cases/${c.id}` }));
    const lib = libraryNow();
    const principles = lib.principles.filter((p) => match(p.name, p.idea, lib.bookOf(p).title, (p.tags || []).join(' ')))
      .slice(0, 4)
      .map((p) => ({ group: 'Principles', icon: BookOpen, label: p.name, sub: lib.bookOf(p).title, to: `/principles#${p.id}` }));
    const comps = companies.filter((c) => match(c.name)).slice(0, 3).map((c) => ({ group: 'Saved companies', icon: Building, label: c.name, sub: c.description, to: `/research?q=${encodeURIComponent(c.name)}` }));
    return [...cases, ...principles, ...comps, { group: 'Live research', icon: Search, label: `Research “${q.trim()}”`, sub: 'Start a live, source-backed investigation', to: `/research?q=${encodeURIComponent(q.trim())}&run=1` }];
  }, [q, myCases, companies]);

  const go = (r) => {
    nav(r.to);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) go(results[active]);
    else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  let lastGroup = null;
  return (
    <div className="topbar-search" ref={boxRef}>
      <div className="search-field">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          className="input"
          type="search"
          placeholder="Search cases, companies, concepts…"
          aria-label="Search BIZSIM"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="global-search-results"
          aria-activedescendant={open && results[active] ? `sr-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {!q && <span className="kbd desktop-only">⌘K</span>}
      </div>
      {open && results.length > 0 && (
        <div className="search-results" id="global-search-results" role="listbox" aria-label="Search results">
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
            const Icon = r.icon;
            return (
              <div key={`${r.group}-${r.to}-${i}`}>
                {head && <div className="search-group eyebrow">{head}</div>}
                <button id={`sr-${i}`} role="option" aria-selected={i === active} className="search-item" onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                  <Icon aria-hidden="true" />
                  <span className="grow">
                    <div style={{ fontWeight: 500 }}>{r.label}</div>
                    {r.sub && <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</div>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BellLink() {
  const unread = useStore((s) => (s.inbox || []).filter((n) => !n.read).length);
  return (
    <Link to="/notifications" className="btn btn-ghost btn-icon bell-link" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications">
      <Bell aria-hidden="true" />
      {unread > 0 && (
        <span className="bell-count num" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function Topbar({ theme, onMenu }) {
  const loc = useLocation();
  const seg = loc.pathname.split('/')[1] || '';
  const isCase = seg === 'cases' && loc.pathname.split('/')[2];
  return (
    <header className="topbar">
      <Link to="/" className="brand mobile-only" style={{ padding: 0 }} aria-label="BIZSIM home">
        <Logo size={26} />
      </Link>
      <nav className="crumbs eyebrow desktop-only" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span className="sep" aria-hidden="true">/</span>
        {isCase ? (
          <>
            <Link to="/cases">Cases</Link>
            <span className="sep" aria-hidden="true">/</span>
            <span className="current" aria-current="page">Briefing</span>
          </>
        ) : (
          <span className="current" aria-current="page">{TITLES[seg] || 'BIZSIM'}</span>
        )}
      </nav>
      <GlobalSearch />
      <div className="topbar-actions">
        <BellLink />
        <button className="btn btn-ghost btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme">
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <span className="vr desktop-only" aria-hidden="true" />
        <Link to="/settings" className="btn btn-ghost btn-icon desktop-only" aria-label="Settings" title="Settings">
          <Settings aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const tabs = [
    { to: '/', label: 'Home', icon: Home, end: true },
    { to: '/cases', label: 'Cases', icon: FolderOpen },
    { to: '/research', label: 'Research', icon: Search },
    { to: '/learning', label: 'Profile', icon: BarChart3 },
  ];
  return (
    <>
      <nav className="mobile-nav" aria-label="Primary">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <t.icon aria-hidden="true" strokeWidth={1.7} />
            {t.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="more-drawer">
          <Menu aria-hidden="true" strokeWidth={1.7} />
          More
        </button>
      </nav>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="drawer" id="more-drawer" role="dialog" aria-modal="true" aria-label="More navigation">
            <div className="row between" style={{ marginBottom: 'var(--s4)' }}>
              <span className="eyebrow">Navigate</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Close menu">
                <X aria-hidden="true" />
              </button>
            </div>
            {[...NAV, { label: 'System', items: SYSTEM }].map((g) => (
              <div className="nav-group" key={g.label}>
                <div className="nav-label eyebrow">{g.label}</div>
                {g.items.map((i) => (
                  <NavItem key={i.to} item={i} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function Shell({ children }) {
  const theme = useResolvedTheme();
  const loc = useLocation();
  const mainRef = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    const seg = loc.pathname.split('/')[1] || '';
    document.title = seg ? `${TITLES[seg] || 'BIZSIM'} · BIZSIM` : 'BIZSIM: Business case simulation';
  }, [loc.pathname]);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar />
      <div className="main">
        <Topbar theme={theme} />
        <main id="main" ref={mainRef} tabIndex={-1} className="content">
          <div key={loc.pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <Toasts />
      <StopVoiceOnNavigate />
    </div>
  );
}

