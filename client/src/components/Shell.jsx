import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, FolderOpen, Search, Play, BarChart3, BookOpen, FileText, Building2, Clock, Settings, Info, Sun, Moon, Menu, X, Building, Bookmark, Bell,
} from 'lucide-react';
import { Logo, Toasts } from './ui.jsx';
import { UpdateToast } from './Updates.jsx';
import { useUpdateState } from '../lib/updater.js';
import { StopVoiceOnNavigate } from './Listen.jsx';
import { useStore, setTheme } from '../lib/store.js';
import { CASES } from '@shared/cases/index.js';
import { libraryNow } from '../lib/library.js';
import { useTranslation } from '../i18n/index.js';

// Navigation is defined by translation keys, never by English text.
export const NAV = [
  {
    key: 'overview',
    items: [
      { to: '/', key: 'overview', icon: Home, end: true },
      { to: '/cases', key: 'exploreCases', icon: FolderOpen },
      { to: '/research', key: 'research', icon: Search },
      { to: '/simulations', key: 'simulations', icon: Play },
      { to: '/learning', key: 'learning', icon: BarChart3 },
      { to: '/principles', key: 'principles', icon: BookOpen },
    ],
  },
  {
    key: 'workspace',
    items: [
      { to: '/my-cases', key: 'myCases', icon: FileText },
      { to: '/collections', key: 'collections', icon: Bookmark },
      { to: '/companies', key: 'companies', icon: Building2 },
      { to: '/history', key: 'history', icon: Clock },
    ],
  },
];
const SYSTEM = [
  { to: '/notifications', key: 'notifications', icon: Bell },
  { to: '/settings', key: 'settings', icon: Settings },
  { to: '/about', key: 'about', icon: Info },
];

const TITLES = {
  '': 'overview',
  cases: 'exploreCases',
  research: 'research',
  simulations: 'simulations',
  learning: 'learning',
  principles: 'principles',
  'my-cases': 'myCases',
  collections: 'collections',
  notifications: 'notifications',
  companies: 'companies',
  history: 'history',
  settings: 'settings',
  about: 'about',
};

function NavItem({ item, onClick, hasDot = false }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = t(`navigation.${item.key}`);
  return (
    <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={onClick} title={label}>
      <Icon aria-hidden="true" strokeWidth={1.6} />
      <span className="grow">{label}</span>
      {hasDot && <i className="update-dot" aria-label="Update available" />}
    </NavLink>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const upd = useUpdateState();
  const hasUpdate = Boolean(upd.release?.updateAvailable && upd.skippedVersion !== upd.release.latestVersion);
  return (
    <aside className="sidebar" aria-label={t('navigation.primary')}>
      <Link to="/" className="brand" aria-label={t('navigation.home')}>
        <Logo />
        <span lang="en">BIZSIM</span>
      </Link>
      <nav>
        {NAV.map((g) => (
          <div className="nav-group" key={g.key}>
            {g.key !== 'overview' && <div className="nav-label eyebrow">{t(`navigation.${g.key}`)}</div>}
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
            <NavItem key={i.to} item={i} hasDot={i.key === 'settings' && hasUpdate} />
          ))}
        </div>
        <div className="local-badge" title={t('navigation.localBadgeHint')}>
          <i className="dot" aria-hidden="true" />
          <span>{t('navigation.localBadge')}</span>
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
  const { t } = useTranslation();
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
      .map((c) => ({ group: 'cases', icon: FolderOpen, label: `${c.title}`, sub: `${c.company} · ${c.yearLabel}`, to: `/cases/${c.id}`, content: true }));
    const lib = libraryNow();
    const principles = lib.principles
      .filter((p) => match(p.name, p.idea, lib.bookOf(p).title, (p.tags || []).join(' ')))
      .slice(0, 4)
      .map((p) => ({ group: 'principles', icon: BookOpen, label: p.name, sub: lib.bookOf(p).title, to: `/principles#${p.id}`, content: true }));
    const comps = companies
      .filter((c) => match(c.name))
      .slice(0, 3)
      .map((c) => ({ group: 'companies', icon: Building, label: c.name, sub: c.description, to: `/research?q=${encodeURIComponent(c.name)}`, content: true }));
    return [...cases, ...principles, ...comps, { group: 'research', icon: Search, label: t('search.researchQuery', { query: q.trim() }), sub: t('search.researchHint'), to: `/research?q=${encodeURIComponent(q.trim())}&run=1` }];
  }, [q, myCases, companies, t]);

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
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
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
        {!q && (
          <span className="kbd desktop-only" dir="ltr">
            ⌘K
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="search-results" id="global-search-results" role="listbox" aria-label={t('search.results')}>
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? (lastGroup = r.group) : null;
            const Icon = r.icon;
            return (
              <div key={`${r.group}-${r.to}-${i}`}>
                {head && <div className="search-group eyebrow">{t(`search.groups.${head}`)}</div>}
                <button id={`sr-${i}`} role="option" aria-selected={i === active} className="search-item" onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                  <Icon aria-hidden="true" />
                  <span className="grow" lang={r.content ? 'en' : undefined}>
                    <div style={{ fontWeight: 500 }}>{r.label}</div>
                    {r.sub && <div className="meta truncate">{r.sub}</div>}
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
  const { t } = useTranslation();
  const unread = useStore((s) => (s.inbox || []).filter((n) => !n.read).length);
  return (
    <Link to="/notifications" className="btn btn-ghost btn-icon bell-link" aria-label={unread ? t('navigation.notificationsUnread', { count: unread }) : t('navigation.notifications')} title={t('navigation.notifications')}>
      <Bell aria-hidden="true" />
      {unread > 0 && (
        <span className="bell-count num" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

function Topbar({ theme }) {
  const { t } = useTranslation();
  const upd = useUpdateState();
  const hasUpdate = Boolean(upd.release?.updateAvailable && upd.skippedVersion !== upd.release.latestVersion);
  const loc = useLocation();
  const seg = loc.pathname.split('/')[1] || '';
  const isCase = seg === 'cases' && loc.pathname.split('/')[2];
  return (
    <header className="topbar">
      <Link to="/" className="brand mobile-only" style={{ padding: 0 }} aria-label={t('navigation.home')}>
        <Logo size={26} />
      </Link>
      <nav className="crumbs eyebrow desktop-only" aria-label={t('navigation.breadcrumb')}>
        <span>{t('navigation.workspace')}</span>
        <span className="sep" aria-hidden="true">
          /
        </span>
        {isCase ? (
          <>
            <Link to="/cases">{t('navigation.cases')}</Link>
            <span className="sep" aria-hidden="true">
              /
            </span>
            <span className="current" aria-current="page">
              {t('navigation.briefing')}
            </span>
          </>
        ) : (
          <span className="current" aria-current="page">
            {TITLES[seg] ? t(`navigation.${TITLES[seg]}`) : 'BIZSIM'}
          </span>
        )}
      </nav>
      <GlobalSearch />
      <div className="topbar-actions">
        <BellLink />
        <button className="btn btn-ghost btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? t('navigation.switchToLight') : t('navigation.switchToDark')} title={t('navigation.toggleTheme')}>
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <span className="vr desktop-only" aria-hidden="true" />
        <Link to="/settings" className="btn btn-ghost btn-icon desktop-only bell-link" aria-label={t('navigation.settings')} title={hasUpdate ? `Update to version ${upd.release.latestVersion}` : t('navigation.settings')}>
          <Settings aria-hidden="true" />
          {hasUpdate && <span className="update-dot-badge" aria-hidden="true" />}
        </Link>
      </div>
    </header>
  );
}

function MobileNav() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  const tabs = [
    { to: '/', key: 'home', icon: Home, end: true },
    { to: '/cases', key: 'cases', icon: FolderOpen },
    { to: '/research', key: 'research', icon: Search },
    { to: '/learning', key: 'profile', icon: BarChart3 },
  ];
  return (
    <>
      <nav className="mobile-nav" aria-label={t('navigation.primary')}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <tab.icon aria-hidden="true" strokeWidth={1.7} />
            <span className="tab-label">{t(`navigation.tabs.${tab.key}`)}</span>
          </NavLink>
        ))}
        <button onClick={() => setOpen(true)} aria-expanded={open} aria-controls="more-drawer">
          <Menu aria-hidden="true" strokeWidth={1.7} />
          <span className="tab-label">{t('navigation.tabs.more')}</span>
        </button>
      </nav>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="drawer" id="more-drawer" role="dialog" aria-modal="true" aria-label={t('navigation.moreNavigation')}>
            <div className="row between" style={{ marginBottom: 'var(--s4)' }}>
              <span className="eyebrow">{t('navigation.navigate')}</span>
              <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label={t('navigation.closeMenu')}>
                <X aria-hidden="true" />
              </button>
            </div>
            {[...NAV, { key: 'system', items: SYSTEM }].map((g) => (
              <div className="nav-group" key={g.key}>
                <div className="nav-label eyebrow">{t(`navigation.${g.key}`)}</div>
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
  const { t } = useTranslation();
  const theme = useResolvedTheme();
  const loc = useLocation();
  const mainRef = useRef(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    const seg = loc.pathname.split('/')[1] || '';
    document.title = seg ? t('navigation.pageTitle', { title: TITLES[seg] ? t(`navigation.${TITLES[seg]}`) : 'BIZSIM' }) : t('navigation.appTitle');
  }, [loc.pathname, t]);
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        {t('navigation.skipToContent')}
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
      <UpdateToast />
      <Toasts />
      <StopVoiceOnNavigate />
    </div>
  );
}
