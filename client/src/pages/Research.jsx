import { useCallback, useEffect, useState } from 'react';
import { episodesOf, seasonShape } from '@shared/episodes.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, X, Minus, Bookmark, BookmarkCheck, ExternalLink, Play, AlertTriangle, Sparkles, Search, Database, Newspaper, Globe, FileText, Info } from 'lucide-react';
import { useJob, startJob } from '../lib/jobs.js';
import { useStatus } from '../lib/useStatus.js';
import { useStore, saveCompany, removeCompany, saveGeneratedCase } from '../lib/store.js';
import { Badge, Button, Callout, Empty, Tabs, TabPanel, toast } from '../components/ui.jsx';
import { FinancialChart, PrincipleList, SourceList } from '../components/content.jsx';
import { fmtDate } from '../lib/format.js';
import { ListenButton } from '../components/Listen.jsx';
import ChatBuilder from '../components/ChatBuilder.jsx';
import { safeUrl } from '../lib/safe.js';

const DEFAULT_STAGES = [
  { id: 'resolve', label: 'Identifying the company' },
  { id: 'profile', label: 'Collecting structured company data' },
  { id: 'filings', label: 'Checking SEC EDGAR filings' },
  { id: 'news', label: 'Gathering recent news coverage' },
  { id: 'website', label: 'Reading the official website' },
  { id: 'synthesis', label: 'Constructing the case' },
];
const KIND_ICON = { structured: Database, reference: FileText, filing: FileText, news: Newspaper, company: Globe };

function StageIcon({ status }) {
  if (status === 'running') return <span className="spinner" aria-hidden="true" />;
  if (status === 'done') return <Check aria-hidden="true" />;
  if (status === 'error') return <X aria-hidden="true" />;
  if (status === 'skipped') return <Minus aria-hidden="true" />;
  return <span className="dot off" aria-hidden="true" />;
}
const STATUS_TEXT = { pending: 'Waiting', running: 'In progress', done: 'Complete', error: 'Failed', skipped: 'Skipped' };

function Terminal({ stages, progress, sources, running }) {
  return (
    <div className="grid-12">
      <section className="glass terminal span-8" aria-labelledby="stg-h">
        <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
          <h2 id="stg-h" className="section-title">
            Research status
          </h2>
          <span className="meta">{running ? 'Live' : 'Finished'}</span>
        </div>
        <ol className="stage-list" aria-live="polite">
          {stages.map((s) => {
            const p = progress[s.id] || { status: 'pending' };
            return (
              <li key={s.id} className="stage" data-status={p.status}>
                <span className="stage-icon">
                  <StageIcon status={p.status} />
                </span>
                <span>
                  {s.label}
                  <span className="sr-only">{STATUS_TEXT[p.status]}</span>
                </span>
                <span className="stage-detail" title={p.detail}>
                  {p.detail || (p.status === 'running' ? 'Working…' : '')}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="panel panel-pad span-4" aria-labelledby="disc-h">
        <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
          <h2 id="disc-h" className="section-title">
            Sources discovered
          </h2>
          <span className="meta num">{sources.length}</span>
        </div>
        {sources.length === 0 ? (
          <p className="meta">{running ? 'Sources appear here as they are retrieved.' : 'No sources retrieved.'}</p>
        ) : (
          <ul className="feed">
            {sources.map((s, i) => {
              const Icon = KIND_ICON[s.kind] || FileText;
              return (
                <li key={i}>
                  <Icon size={15} className="faint" aria-hidden="true" style={{ marginTop: 2 }} />
                  <span style={{ minWidth: 0 }}>
                    <a href={safeUrl(s.url)} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>
                      {s.title}
                    </a>
                    <div className="meta">{[s.publisher, s.date && fmtDate(s.date)].filter(Boolean).join(' · ')}</div>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Facts({ r }) {
  const facts = r.profile.facts.filter((f) => f.property !== 'P856');
  return (
    <div className="stack gap-5">
      {r.wikipedia && (
        <div className="stack gap-3">
          <span className="provenance prov-source">Source reference</span>
          <p className="body">{r.wikipedia.extract}</p>
          <p className="meta">
            From{' '}
            <a className="link" href={safeUrl(r.wikipedia.url)} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
            {r.wikipedia.lastModified && `, last edited ${fmtDate(r.wikipedia.lastModified)}`}. Encyclopedia text can change; verify critical claims in primary sources.
          </p>
        </div>
      )}
      <div className="stack gap-3">
        <span className="provenance prov-verified">Structured data (Wikidata), as published</span>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Structured company facts from Wikidata</caption>
            <thead>
              <tr>
                <th scope="col">Fact</th>
                <th scope="col">Value</th>
                <th scope="col">As of</th>
                <th scope="col">Source</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f) => (
                <tr key={f.label}>
                  <th scope="row" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--t-14)', background: 'transparent', color: 'var(--text)' }}>
                    {f.label}
                  </th>
                  <td className="tabular">{f.value}</td>
                  <td className="meta num">{f.asOf || ''}</td>
                  <td>
                    <a className="link meta" href={safeUrl(`${f.sourceUrl}#${f.property}`)} target="_blank" rel="noreferrer">
                      Wikidata {f.property}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta">Facts are community-maintained structured data. Values without an “as of” date may be out of date.</p>
      </div>
    </div>
  );
}

function Financials({ r }) {
  if (!r.sec) {
    return (
      <Empty icon={FileText} title="No regulatory filings available">
        {r.stages.filings?.detail || 'Audited financials are shown for companies that file with the U.S. SEC.'} BIZSIM does not estimate or invent financial figures.
      </Empty>
    );
  }
  const rev = r.sec.revenue;
  return (
    <div className="stack gap-5">
      <span className="provenance prov-verified">Verified · audited annual filings</span>
      {rev ? (
        <FinancialChart
          title={`${r.sec.entityName}, annual revenue${r.sec.netIncome ? ' and net income' : ''}`}
          series={rev.series}
          unit={rev.unit}
          secondary={r.sec.netIncome?.unit === rev.unit ? r.sec.netIncome.series : null}
          secondaryLabel="Net income"
          sourceLabel={`SEC EDGAR XBRL (${rev.tag})`}
          sourceUrl={r.sec.sourceUrl}
        />
      ) : (
        <Callout>Revenue data is not available in a standard XBRL tag for this company.</Callout>
      )}
      {r.sec.filings.length > 0 && (
        <div className="stack gap-3">
          <h3 className="section-title">Recent filings</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Form</th>
                  <th scope="col">Filed</th>
                  <th scope="col">Document</th>
                </tr>
              </thead>
              <tbody>
                {r.sec.filings.map((f) => (
                  <tr key={f.url}>
                    <td>
                      <Badge>{f.form}</Badge>
                    </td>
                    <td className="tabular">{fmtDate(f.date)}</td>
                    <td>
                      <a className="link" href={safeUrl(f.url)} target="_blank" rel="noreferrer">
                        {f.description} <ExternalLink aria-hidden="true" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function News({ r }) {
  if (!r.news.length) return <Empty icon={Newspaper} title="No recent coverage retrieved">{r.stages.news?.detail}</Empty>;
  return (
    <div className="stack gap-4">
      <span className="provenance prov-source">Source references · headlines only</span>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {r.news.map((n) => (
          <li key={n.url} style={{ padding: 'var(--s4) 0', borderBottom: '1px solid var(--border)' }}>
            <a href={safeUrl(n.url)} target="_blank" rel="noreferrer" className="stack gap-1">
              <span style={{ fontWeight: 500, fontSize: 'var(--t-16)' }}>{n.title}</span>
              <span className="meta num">
                {n.publisher || 'Unknown publisher'} · {fmtDate(n.date)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="meta">Headlines link to the original publishers. BIZSIM does not reproduce article text.</p>
    </div>
  );
}

function Analysis({ r, status }) {
  const g = r.generated?.case;
  const nav = useNavigate();
  if (!g) {
    return (
      <div className="stack gap-4">
        {r.stages.synthesis?.status === 'error' ? (
          <Callout tone="danger" icon={AlertTriangle}>
            Case construction failed: {r.stages.synthesis.detail}. The verified evidence above is unaffected.
          </Callout>
        ) : (
          <Callout icon={Info}>
            {status?.ai?.enabled === false ? (
              <>
                AI live seasons are off, so BIZSIM shows only verified evidence. To turn it on, paste an API key in{' '}
                <Link className="link" to="/settings">
                  Settings → AI keys
                </Link>{' '}
                (a free Gemini key works).
              </>
            ) : (
              r.stages.synthesis?.detail || 'No AI analysis for this research.'
            )}
          </Callout>
        )}
      </div>
    );
  }
  const a = g.analysis || {};
  const play = () => {
    saveGeneratedCase(g);
    nav(`/cases/${g.id}`);
  };
  return (
    <div className="stack gap-6">
      <Callout tone="ai" icon={Sparkles}>
        <strong>AI-generated analysis.</strong> Written by {status?.ai?.provider} ({status?.ai?.model}) from the {g.sources.length} sources retrieved above. Evidence items cite their source; anything uncited is interpretation. {r.generated.warnings?.length ? `${r.generated.warnings.length} unsupported item(s) were removed by validation.` : ''}
      </Callout>
      <div>
        <ListenButton
          id={`analysis-${g.id}`}
          label="Listen to the analysis"
          getText={() => [a.summary, a.strengths?.length && `Strengths: ${a.strengths.join('. ')}.`, a.risks?.length && `Risks: ${a.risks.join('. ')}.`, a.uncertainties?.length && `Open questions: ${a.uncertainties.join('. ')}.`].filter(Boolean).join(' ')}
        />
      </div>
      {a.summary && <p className="body">{a.summary}</p>}
      <div className="grid-12">
        {[
          ['Strengths', a.strengths, 'prov-ai'],
          ['Risks', a.risks, 'prov-ai'],
          ['Open questions & uncertainty', a.uncertainties, 'prov-hypo'],
        ].map(([title, list, cls]) =>
          list?.length ? (
            <section key={title} className="panel panel-pad span-4 stack gap-3" style={{ gridColumn: 'span 4' }}>
              <h3 className={`provenance ${cls}`}>{title}</h3>
              <ul className="stack gap-2" style={{ margin: 0, paddingLeft: 'var(--s4)' }}>
                {list.map((x, i) => (
                  <li key={i} className="muted">
                    {x}
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )}
      </div>
      {g.scenarios?.length > 0 && (
        <section className="stack gap-3">
          <h3 className="provenance prov-hypo">Hypothetical scenarios</h3>
          {g.scenarios.map((s, i) => (
            <div key={i} className="principle">
              <div className="principle-name">{s.name}</div>
              <p className="muted">{s.description}</p>
            </div>
          ))}
        </section>
      )}
      <section className="panel panel-pad row between wrap gap-4">
        <div className="stack gap-2 grow">
          <span className="meta-caps">Generated season · {seasonShape(g)} · saved to My Cases</span>
          <h3 className="h2">{g.title}</h3>
          <p className="muted">{g.tagline}</p>
          <ol className="episodes" aria-label="Episodes">
            {episodesOf(g).map((e) => (
              <li key={e.n}>
                <span className="ep-num num">Ep {e.roman}</span>
                <span>
                  {e.title} <span className="faint">· {e.dateLabel}{e.decisions.length > 1 ? ` · ${e.decisions.length} decisions` : ''}</span>
                  {e.live && <Badge tone="warning">Now</Badge>}
                </span>
              </li>
            ))}
          </ol>
          <PrincipleList ids={g.concept?.principles || []} />
        </div>
        <Button variant="primary" size="lg" icon={Play} onClick={play}>
          Play this season
        </Button>
      </section>
    </div>
  );
}

function Result({ r, status }) {
  const saved = useStore((s) => s.savedCompanies.some((c) => c.id === r.profile?.id));
  const [tab, setTab] = useState('overview');
  if (!r.profile) {
    return (
      <section className="panel panel-pad stack gap-4">
        <Empty icon={Search} title="We could not identify that company">
          Try the full legal or commonly used name.
        </Empty>
        {r.candidates?.length > 0 && (
          <div className="stack gap-2">
            <span className="meta-caps">Closest matches in Wikidata</span>
            <ul className="stack gap-2" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {r.candidates.map((c) => (
                <li key={c.id}>
                  <Link className="link" to={`/research?q=${encodeURIComponent(c.label)}&run=1`}>
                    {c.label}
                  </Link>{' '}
                  <span className="meta">{c.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }
  const toggleSave = () => {
    if (saved) {
      removeCompany(r.profile.id);
      toast('Removed from saved companies');
    } else {
      saveCompany({ id: r.profile.id, name: r.profile.name, description: r.profile.description, website: r.profile.website });
      toast('Company saved');
    }
  };
  const tabs = [
    { id: 'overview', label: 'Company intelligence' },
    { id: 'financials', label: 'Financials', count: r.sec?.revenue?.series.length || 0 },
    { id: 'news', label: 'News', count: r.news.length },
    { id: 'sources', label: 'Sources', count: r.sources.length },
    { id: 'analysis', label: 'AI analysis & case' },
  ];
  return (
    <section className="stack gap-5" aria-labelledby="res-name">
      <div className="row between wrap gap-4">
        <div className="stack gap-2">
          <span className="meta-caps">{r.profile.description}</span>
          <h2 id="res-name" className="display" style={{ fontSize: 'var(--t-36)' }}>
            {r.profile.name}
          </h2>
          <div className="badges">
            {r.profile.tickers.slice(0, 3).map((t) => (
              <Badge key={t.ticker + t.exchange}>
                {t.ticker}
                {t.exchange ? ` · ${t.exchange}` : ''}
              </Badge>
            ))}
            {r.profile.website && (
              <a className="badge" href={safeUrl(r.profile.website)} target="_blank" rel="noreferrer">
                <Globe aria-hidden="true" /> Website
              </a>
            )}
            {r.via && <Badge title="Your search matched a product; BIZSIM researched the company behind it">Maker of {r.via.label}</Badge>}
            {r.fromCache && <Badge title="Results from the last hour are reused to limit load on sources">Cached · {fmtDate(r.finishedAt)}</Badge>}
          </div>
        </div>
        <Button icon={saved ? BookmarkCheck : Bookmark} onClick={toggleSave} aria-pressed={saved}>
          {saved ? 'Saved' : 'Save company'}
        </Button>
      </div>
      <div className="legend">
        <span className="provenance prov-verified">Structured data and filings</span>
        <span className="provenance prov-source">Source references</span>
        <span className="provenance prov-ai">AI-generated analysis</span>
        <span className="provenance prov-hypo">Hypothetical scenarios</span>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Research results" />
      <TabPanel id="overview" active={tab === 'overview'}>
        <Facts r={r} />
      </TabPanel>
      <TabPanel id="financials" active={tab === 'financials'}>
        <Financials r={r} />
      </TabPanel>
      <TabPanel id="news" active={tab === 'news'}>
        <News r={r} />
      </TabPanel>
      <TabPanel id="sources" active={tab === 'sources'}>
        <SourceList sources={r.sources.map((s) => ({ ...s, type: s.kind }))} />
      </TabPanel>
      <TabPanel id="analysis" active={tab === 'analysis'}>
        <Analysis r={r} status={status} />
      </TabPanel>
    </section>
  );
}

function CompanyResearch() {
  const [params, setParams] = useSearchParams();
  const status = useStatus();
  const job = useJob('research');
  const [q, setQ] = useState(params.get('q') || job?.meta?.q || '');
  const stages = status?.stages || DEFAULT_STAGES;

  // Everything shown comes from the background job's event log, so leaving this
  // screen (or the app) and coming back never loses progress.
  const progress = {};
  const sources = [];
  let result = null;
  let error = job?.error || null;
  for (const ev of job?.events || []) {
    if (ev.event === 'stage') progress[ev.data.id] = ev.data;
    else if (ev.event === 'source') sources.push(ev.data);
    else if (ev.event === 'result') result = ev.data;
    else if (ev.event === 'failure') error = ev.data.message || 'Research failed';
  }
  const running = Boolean(job && !job.done);

  const run = useCallback(
    (query) => {
      const term = query.trim();
      if (term.length < 2) return;
      setParams({ q: term }, { replace: true });
      startJob('research', '/api/jobs/research', { q: term }, { q: term });
    },
    [setParams],
  );

  useEffect(() => {
    const want = params.get('q');
    if (params.get('run') === '1' && want && !(job && job.meta?.q === want)) run(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const started = running || result || error;

  return (
    <div className="stack gap-6">
      <header className="research-hero">
        <p className="lead">Turn publicly available company intelligence into an interactive season, with every fact traced to its source.</p>
        <form
          className="research-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(q);
          }}
        >
          <label htmlFor="company" className="sr-only">
            Company name
          </label>
          <input id="company" className="input input-lg" placeholder="Enter a company name…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoFocus={!params.get('q')} />
          <Button type="submit" variant="primary" size="lg" loading={running} disabled={q.trim().length < 2 || running} iconRight={ArrowRight}>
            Start Live Research
          </Button>
        </form>
        <p className="meta">
          Searches Wikidata, Wikipedia, SEC EDGAR{status && !status.sec ? ' (not configured)' : ''}, recent news and the company’s own website. {status?.ai?.enabled ? 'An AI model then turns that evidence into a live season of four episodes, each with several decisions.' : 'AI live seasons are off on this server.'}
        </p>
      </header>

      {status && status.online === false && (
        <Callout tone="warning" icon={AlertTriangle}>
          The research server is unreachable ({status.error}). On mobile builds, set your server address in{' '}
          <Link className="link" to="/settings">
            Settings
          </Link>
          .
        </Callout>
      )}
      {error && (
        <Callout tone="danger" icon={AlertTriangle}>
          {error}
        </Callout>
      )}
      {running && <p className="meta">Research keeps running on the server while you use other screens or switch apps. Come back here to see the result.</p>}
      {started && <Terminal stages={stages} progress={progress} sources={sources} running={running} />}
      {result && <Result r={result} status={status} />}
    </div>
  );
}

export default function Research() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'chat' ? 'chat' : 'company';
  return (
    <div className="stack gap-6">
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">Live company research</div>
        <h1 className="display">{mode === 'chat' ? 'Build seasons by chatting.' : 'Investigate any company.'}</h1>
      </header>
      <Tabs
        label="Research mode"
        value={mode}
        onChange={(v) => setParams(v === 'chat' ? { mode: 'chat' } : {}, { replace: true })}
        tabs={[
          { id: 'company', label: 'Research a company' },
          { id: 'chat', label: 'Chat builder' },
        ]}
      />
      <TabPanel id="company" active={mode === 'company'}>
        <CompanyResearch />
      </TabPanel>
      <TabPanel id="chat" active={mode === 'chat'}>
        <ChatBuilder />
      </TabPanel>
    </div>
  );
}
