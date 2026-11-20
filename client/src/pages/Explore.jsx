import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, BarChart2, CheckCircle2, Search, Play, ExternalLink, BookOpen, Radar } from 'lucide-react';
import { CASES } from '@shared/cases/index.js';
import { CATALOGUE, ROMAN } from '@shared/catalogue.js';
import { CASE_BY_ID } from '@shared/cases/index.js';
import { episodesOf, seasonShape } from '@shared/episodes.js';

const TOTAL_DECISIONS = CASES.reduce((n, c) => n + c.checkpoints.length, 0);
import { ERAS, PILLARS } from '@shared/dimensions.js';
import { CaseCover } from '../components/content.jsx';
import { Badge, Empty, Tabs, TabPanel } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { useLibrary, allTags } from '../lib/library.js';
import { eraLabel, difficultyLabel } from '../lib/format.js';

function CaseCard({ c, done }) {
  return (
    <Link to={`/cases/${c.id}`} className="panel case-card interactive">
      <CaseCover c={c} />
      <div className="case-card-body">
        <div className="row between gap-2">
          <span className="meta-caps num">
            {c.company} · {c.yearLabel}
          </span>
          {done && <CheckCircle2 size={16} className="pos" aria-label="Completed" />}
        </div>
        <h3 className="case-title">{c.title}</h3>
        <p className="case-tagline">{c.tagline}</p>
        <div className="badges mt-2">
          <Badge>{eraLabel(c.era)}</Badge>
          {c.pillar && <Badge>{PILLARS[c.pillar]?.name}</Badge>}
          {c.classification === 'LIVE' ? <Badge tone="ai">Live season</Badge> : c.source === 'built' ? <Badge tone="ai">AI-built</Badge> : c.classification === 'HYPOTHETICAL' ? <Badge tone="warning">Hypothetical</Badge> : <Badge tone="success">Curated</Badge>}
        </div>
        <div className="case-facts" style={{ marginTop: 'auto', paddingTop: 'var(--s3)' }}>
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

function CatalogueCard({ e, done }) {
  const c = CASE_BY_ID[e.caseId];
  return (
    <article className="panel cat-card" id={e.id}>
      <div className="row between gap-2">
        <span className="cat-num num">
          #{e.n} · {e.when}
        </span>
        {done ? <CheckCircle2 size={16} className="pos" aria-label="Completed" /> : e.bonus ? <Badge>Bonus</Badge> : e.added ? <Badge>New</Badge> : null}
      </div>
      <h3 className="cat-title">{e.title}</h3>
      <p className="muted" style={{ fontSize: 'var(--t-14)' }}>
        {e.summary}
      </p>
      <ol className="episodes" aria-label="Episodes">
        {(c ? episodesOf(c).map((x) => x.title) : e.episodes).map((t, i) => (
          <li key={i}>
            <span className="ep-num num">Ep {ROMAN[i]}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <div>
        <p className="meta row gap-2" style={{ alignItems: 'flex-start' }}>
          <BookOpen size={13} aria-hidden="true" style={{ marginTop: 2, flex: 'none' }} />
          <span>{e.reading}</span>
        </p>
        <div className="cat-actions">
          <Link className="btn btn-sm btn-primary" to={`/cases/${e.caseId}`}>
            <Play aria-hidden="true" /> {done ? 'Play again' : 'Play season'}
          </Link>
          <a className="btn btn-sm btn-ghost" href={`https://en.wikipedia.org/wiki/${encodeURIComponent(e.wiki.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">
            Source <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="row wrap gap-2" role="group" aria-label={label}>
      <button className="chip" aria-pressed={!value} onClick={() => onChange(null)}>
        All
      </button>
      {Object.entries(options).map(([k, v]) => (
        <button key={k} className="chip" aria-pressed={value === k} onClick={() => onChange(value === k ? null : k)}>
          {v}
        </button>
      ))}
    </div>
  );
}

export default function Explore() {
  const myCases = useStore((s) => s.myCases);
  const runs = useStore((s) => s.runs);
  const [params, setParams] = useSearchParams();
  const tab = params.get('view') === 'mine' ? 'mine' : 'catalogue';
  const [pillar, setPillar] = useState(params.get('pillar'));
  const [era, setEra] = useState(null);
  const [q, setQ] = useState('');
  const [unplayedOnly, setUnplayedOnly] = useState(false);
  const lib = useLibrary();
  const tag = params.get('tag') || '';
  const tagOptions = allTags(lib);
  const userText = (id) => {
    const t = lib.tags[id];
    if (!t) return '';
    return `${(t.tags || []).join(' ')} ${(t.principles || []).map((p) => lib.principleById[p]?.name || '').join(' ')}`;
  };
  const hasTag = (id) => !tag || (lib.tags[id]?.tags || []).includes(tag);
  const done = new Set(runs.filter((r) => r.finishedAt).map((r) => r.caseId));
  const signature = useMemo(() => CASES.filter((c) => !c.catalogueId).sort((a, b) => a.yearSort - b.yearSort), []);
  const usedEras = Object.fromEntries(Object.entries(ERAS).filter(([k]) => CATALOGUE.some((c) => c.era === k)));
  const pillarNames = Object.fromEntries(Object.entries(PILLARS).map(([k, v]) => [k, v.name]));
  const ql = q.toLowerCase();
  const list = CATALOGUE.filter(
    (e) =>
      (!pillar || e.pillar === pillar) &&
      (!era || e.era === era) &&
      (!unplayedOnly || !done.has(e.caseId)) &&
      hasTag(e.caseId) &&
      (!q || `${e.n} ${e.title} ${e.summary} ${e.reading} ${e.when} ${e.episodes.join(' ')} ${userText(e.caseId)}`.toLowerCase().includes(ql)),
  );
  const mineList = myCases.filter((c) => (!pillar || c.pillar === pillar) && hasTag(c.id) && (!q || `${c.title} ${c.company} ${c.tagline} ${userText(c.id)}`.toLowerCase().includes(ql)));
  const setTag = (t) => {
    const next = new URLSearchParams(params);
    if (t) next.set('tag', t);
    else next.delete('tag');
    setParams(next, { replace: true });
  };

  return (
    <div className="stack gap-6">
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">Season library</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          Decisions that shaped business.
        </h1>
        <p className="lead">
          {CATALOGUE.length} seasons · {CATALOGUE.length * 4} episodes · {TOTAL_DECISIONS} decisions across six executive pillars and more than 3,700 years, from Hammurabi’s laws to OpenAI’s boardroom. Every season is four episodes, and every episode is two or more linked decisions with its own outcome and insight.
        </p>
      </header>

      <section aria-labelledby="tl-title">
        <h2 id="tl-title" className="eyebrow">
          Signature seasons · timeline
        </h2>
        <div className="timeline">
          {signature.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className={done.has(c.id) ? 'done' : ''}>
                <span className="meta num">{c.yearLabel.split(' – ')[0]}</span>
                <span style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>{c.company}</span>
              </Link>
          ))}
        </div>
      </section>

      <Tabs
        label="Library view"
        value={tab}
        onChange={(v) => {
          const next = new URLSearchParams(params);
          if (v === 'mine') next.set('view', 'mine');
          else next.delete('view');
          setParams(next, { replace: true });
        }}
        tabs={[
          { id: 'catalogue', label: 'All seasons', count: CATALOGUE.length },
          { id: 'mine', label: 'Live & saved', count: myCases.length },
        ]}
      />

      <section className="stack gap-4" aria-label="Filters">
        <div className="search-field" style={{ maxWidth: 420 }}>
          <Search aria-hidden="true" />
          <input className="input" type="search" placeholder="Search by company, person, idea or year…" aria-label="Filter cases" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ChipGroup label="Pillar" options={pillarNames} value={pillar} onChange={setPillar} />
        {(tagOptions.length > 0 || tag) && <ChipGroup label="My tags" options={Object.fromEntries([...new Set([tag, ...tagOptions].filter(Boolean))].map((t) => [t, t]))} value={tag || null} onChange={(v) => setTag(v || '')} />}
        {tab === 'catalogue' && (
          <>
            <ChipGroup label="Era" options={usedEras} value={era} onChange={setEra} />
            <label className="row gap-2 meta" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={unplayedOnly} onChange={(e) => setUnplayedOnly(e.target.checked)} /> Only seasons I haven’t finished
            </label>
          </>
        )}
      </section>

      <TabPanel id="catalogue" active={tab === 'catalogue'}>
        <div className="stack gap-6">
          <p className="meta num" aria-live="polite">
            {list.length} of {CATALOGUE.length} seasons
          </p>
          {Object.entries(PILLARS)
            .filter(([k]) => list.some((e) => e.pillar === k))
            .map(([k, p]) => (
              <section key={k} className="stack gap-4" aria-labelledby={`p-${k}`}>
                <div className="pillar-head">
                  <h2 id={`p-${k}`} className="h2">
                    {p.long}
                  </h2>
                  <p className="meta">{p.focus}</p>
                </div>
                <div className="cat-list">
                  {list
                    .filter((e) => e.pillar === k)
                    .map((e) => (
                      <CatalogueCard key={e.id} e={e} done={done.has(e.caseId)} />
                    ))}
                </div>
              </section>
            ))}
          {!list.length && (
            <Empty icon={Search} title="No seasons match these filters">
              Clear a filter or search for something else.
            </Empty>
          )}
        </div>
      </TabPanel>

      <TabPanel id="mine" active={tab === 'mine'}>
        {mineList.length ? (
          <div className="case-grid">
            {mineList.map((c) => (
              <CaseCard key={c.id} c={c} done={done.has(c.id)} />
            ))}
          </div>
        ) : (
          <Empty icon={Radar} title="No live seasons yet">
            Research any company in Live Company Research: BIZSIM turns it into a season whose last episode is happening now.
          </Empty>
        )}
      </TabPanel>
    </div>
  );
}
