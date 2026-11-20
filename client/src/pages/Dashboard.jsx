import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Play, ChevronRight, ArrowRight, Clock, BarChart2, Info, History, CalendarDays, Shuffle, Sparkles } from 'lucide-react';
import { FEATURED_IDS, CASE_BY_ID } from '@shared/cases/index.js';
import { CATALOGUE } from '@shared/catalogue.js';
import { METHOD } from '@shared/dimensions.js';
import { CaseCover } from '../components/content.jsx';
import { Badge, Button, Empty } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { findCase, learningStats, progressLabel, runComplete, isOpen } from '../lib/sim.js';
import { seasonShape } from '@shared/episodes.js';
import { difficultyLabel, domainLabel, relTime } from '../lib/format.js';
import { TrustBadges } from '../components/trust.jsx';
import { BookmarkButton } from '../components/Collections.jsx';
import { caseOfDay, localDateKey } from '@shared/caseOfDay.js';
import { isAiGenerated } from '@shared/contentClass.js';

const caseOfDayIndex = (n, key) => [...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % n;

export function CaseRow({ c }) {
  return (
    <Link to={`/cases/${c.id}`} className="case-row">
      <CaseCover c={c} />
      <div style={{ minWidth: 0 }}>
        <div className="row wrap gap-3">
          <span className="meta-caps num">
            {c.company} · {c.yearLabel}
          </span>
          <span className="badges desktop-only">
            <Badge>{domainLabel(c.domain)}</Badge>
            <TrustBadges c={c} short />
          </span>
        </div>
        <h3 className="case-title mt-2">{c.title}</h3>
        <p className="case-tagline">{c.tagline}</p>
        <div className="case-facts">
          <span className="fact num">
            <Clock aria-hidden="true" /> {c.minutes} min
          </span>
          <span className="bar" aria-hidden="true" />
          <span className="fact">
            <BarChart2 aria-hidden="true" /> {difficultyLabel(c.difficulty)}
          </span>
          <span className="bar" aria-hidden="true" />
          <span className="fact num">{seasonShape(c)}</span>
        </div>
      </div>
    </Link>
  );
}

// Bundled with the app so the homepage looks right offline and on phones.
// "Taipei, architecture" by Taipei1015097, Wikimedia Commons, CC0 (public domain).
const HERO = {
  credit: 'Taipei1015097',
  license: 'CC0',
  landingUrl: 'https://commons.wikimedia.org/wiki/File:Taipei,_architecture_-_Taipei1015097.jpg',
};

function HeroImage() {
  const [loaded, setLoaded] = useState(false);
  const base = import.meta.env.BASE_URL || '/';
  return (
    <>
      <div className={`hero-image${loaded ? ' loaded' : ''}`} aria-hidden="true">
        <img
          src={`${base}hero/hero.webp`}
          srcSet={`${base}hero/hero-800.webp 800w, ${base}hero/hero.webp 1280w`}
          sizes="(max-width: 860px) 100vw, 62vw"
          alt=""
          decoding="async"
          fetchpriority="high"
          onLoad={() => setLoaded(true)}
        />
      </div>
      {loaded && (
        <div className="hero-credit desktop-only">
          Photo: {HERO.credit} ·{' '}
          <a href={HERO.landingUrl} target="_blank" rel="noreferrer">
            {HERO.license}
          </a>
        </div>
      )}
    </>
  );
}

function ResearchMini() {
  const [q, setQ] = useState('');
  const nav = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    if (q.trim().length >= 2) nav(`/research?q=${encodeURIComponent(q.trim())}&run=1`);
  };
  return (
    <section className="panel" aria-labelledby="lcr-title">
      <div className="panel-head flush" style={{ display: 'block' }}>
        <h2 id="lcr-title" className="section-title">
          Live company research
        </h2>
        <div className="eyebrow-rule eyebrow mt-2">Public sources</div>
      </div>
      <form className="panel-body stack gap-3" onSubmit={submit}>
        <label htmlFor="mini-research" className="sr-only">
          Company name
        </label>
        <input id="mini-research" className="input" placeholder="Enter a company name…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        <button className="btn btn-primary btn-block" type="submit" disabled={q.trim().length < 2}>
          Start research <ArrowRight aria-hidden="true" />
        </button>
        <p className="meta row gap-2">
          <Info size={14} aria-hidden="true" /> Sources and evidence accompany every result.
        </p>
      </form>
    </section>
  );
}

function RecentActivity() {
  const runs = useStore((s) => s.runs);
  const research = useStore((s) => s.researchHistory);
  const items = [
    ...runs.slice(0, 6).map((r) => {
      const c = findCase(r.caseId);
      return c && { at: r.finishedAt || r.choices.at(-1)?.at || r.startedAt, label: c.title, sub: r.finishedAt && runComplete(c, r) ? 'Season completed' : progressLabel(c, r), to: `/cases/${c.id}`, icon: Play };
    }),
    ...research.slice(0, 6).map((h) => ({ at: h.at, label: h.name || h.query, sub: `Researched · ${h.sourcesCount} sources`, to: `/research?q=${encodeURIComponent(h.query)}`, icon: Search })),
  ]
    .filter(Boolean)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <section className="panel" aria-labelledby="ra-title">
      <div className="panel-head flush">
        <h2 id="ra-title" className="section-title">
          Recent activity
        </h2>
        {items.length > 0 && (
          <Link to="/history" className="link meta">
            All
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <Empty icon={History}>Your recent cases and decisions will appear here.</Empty>
      ) : (
        <ul className="stack panel-body gap-3" style={{ listStyle: 'none', margin: 0 }}>
          {items.map((i, k) => (
            <li key={k}>
              <Link to={i.to} className="row gap-3">
                <i.icon size={16} aria-hidden="true" className="faint" />
                <span className="grow">
                  <div style={{ fontWeight: 500 }}>{i.label}</div>
                  <div className="meta">
                    {i.sub} · {relTime(i.at)}
                  </div>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const TOTAL_DECISIONS = Object.values(CASE_BY_ID).reduce((n, c) => n + c.checkpoints.length, 0);
const CURATED_IDS = Object.keys(CASE_BY_ID);

function CaseOfDay() {
  const [offset, setOffset] = useState(0);
  const [key, setKey] = useState(() => localDateKey());
  const mine = useStore((s) => s.myCases);
  // Roll over at local midnight if the app stays open.
  useEffect(() => {
    const t = setInterval(() => setKey((k) => (k === localDateKey() ? k : localDateKey())), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setOffset(0), [key]);
  const c = CASE_BY_ID[caseOfDay(CURATED_IDS, key, offset)];
  const ai = mine.filter(isAiGenerated);
  const aiPick = ai.length ? ai[caseOfDayIndex(ai.length, key)] : null;
  if (!c) return null;
  return (
    <section className="panel cotd" aria-labelledby="cotd-title">
      <div className="panel-head">
        <h2 id="cotd-title" className="section-title row gap-2">
          <CalendarDays size={16} aria-hidden="true" /> {offset ? 'Another case to try' : 'Case of the Day'}
        </h2>
        <span className="meta num">{new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <div style={{ padding: '0 var(--s5)' }}>
        <CaseRow c={c} />
      </div>
      <div className="panel-body row wrap gap-2 between">
        <span className="meta">From the curated library. The same case for everyone today; it changes at midnight.</span>
        <div className="row gap-2">
          <BookmarkButton item={{ type: 'season', id: c.id, label: c.title }} />
          <Button size="sm" variant="ghost" icon={Shuffle} onClick={() => setOffset((o) => o + 1)}>
            Explore another
          </Button>
        </div>
      </div>
      {aiPick && (
        <div className="panel-body stack gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="meta-caps row gap-2">
            <Sparkles size={13} aria-hidden="true" /> From your AI-written seasons
          </span>
          <Link to={`/cases/${encodeURIComponent(aiPick.id)}`} className="collection-title">
            {aiPick.title}
          </Link>
        </div>
      )}
    </section>
  );
}

export default function Dashboard() {
  const state = useStore((s) => s);
  const stats = learningStats(state);
  const featured = FEATURED_IDS.map((id) => CASE_BY_ID[id]).filter(Boolean).slice(0, 2);
  const current = state.runs.find((r) => isOpen(r) && r.choices.length);
  const currentCase = current && findCase(current.caseId);

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <HeroImage />
        <div className="eyebrow eyebrow-rule">Your strategy workspace</div>
        <h1 id="hero-title" className="display">
          <span style={{ display: 'block' }}>Understand business.</span>
          <span style={{ display: 'block' }}>Think like a decision-maker.</span>
        </h1>
        <p className="lead">Investigate real companies, weigh strategic trade-offs, and learn from the decisions that shaped them, from Hammurabi’s Babylon to the AI era.</p>

        <div className="quick-actions">
          <Link to="/cases" className="panel quick-action interactive">
            <BookOpen className="qa-icon" aria-hidden="true" />
            <span className="grow">
              <div className="qa-title">Explore business cases</div>
              <div className="qa-sub">
                {CATALOGUE.length} seasons · {TOTAL_DECISIONS.toLocaleString('en-US')} decisions
              </div>
            </span>
            <ChevronRight className="chev" aria-hidden="true" />
          </Link>
          <Link to="/research" className="panel quick-action interactive primary">
            <Search className="qa-icon" aria-hidden="true" />
            <span className="grow">
              <div className="qa-title">Research a company</div>
              <div className="qa-sub">Build a source-backed case</div>
            </span>
            <ChevronRight className="chev" aria-hidden="true" />
          </Link>
          <Link to={currentCase ? `/cases/${currentCase.id}` : '/simulations'} className="panel quick-action interactive">
            <Play className="qa-icon" aria-hidden="true" />
            <span className="grow">
              <div className="qa-title">{currentCase ? 'Resume simulation' : 'Start a simulation'}</div>
              <div className="qa-sub">{currentCase ? currentCase.title : 'Make the call, test your reasoning'}</div>
            </span>
            <ChevronRight className="chev" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="grid-12 mt-5">
        <div className="span-8 stack gap-5">
        <CaseOfDay />
        <section className="panel" aria-labelledby="fc-title">
          <div className="panel-head">
            <h2 id="fc-title" className="section-title">
              Featured cases
            </h2>
            <Link to="/cases" className="link">
              View library <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <div style={{ padding: '0 var(--s5) var(--s2)' }}>
            {featured.map((c) => (
              <CaseRow key={c.id} c={c} />
            ))}
          </div>
        </section>
        </div>
        <div className="span-4 stack gap-5">
          <ResearchMini />
          <RecentActivity />
        </div>

        {stats.decisions > 0 && (
          <section className="panel span-12" aria-labelledby="li-title">
            <div className="panel-head">
              <h2 id="li-title" className="section-title">
                Learning insights
              </h2>
              <Link to="/learning" className="link">
                Full profile <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <div className="kpis" style={{ border: 0, borderRadius: 0 }}>
              <div className="kpi">
                <span className="meta-caps">Decisions made</span>
                <span className="kpi-value num">{stats.decisions}</span>
              </div>
              <div className="kpi">
                <span className="meta-caps">Cases completed</span>
                <span className="kpi-value num">{stats.casesCompleted}</span>
              </div>
              <div className="kpi">
                <span className="meta-caps">Matched history</span>
                <span className="kpi-value num">{stats.alignment == null ? '' : `${stats.alignment}%`}</span>
              </div>
              <div className="kpi">
                <span className="meta-caps">Avg. decision quality</span>
                <span className="kpi-value num">{stats.avgQuality == null ? '' : `${stats.avgQuality.toFixed(1)}/3`}</span>
              </div>
            </div>
          </section>
        )}

        <section className="panel panel-pad span-12" aria-labelledby="method-title">
          <div className="method">
            <h2 id="method-title" className="section-title">
              The BIZSIM method
            </h2>
            <ol className="method-steps">
              {METHOD.map((m, i) => (
                <li key={m}>
                  <span className={`step-num num${i === 0 ? ' active' : ''}`}>{i + 1}</span>
                  {m}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}
