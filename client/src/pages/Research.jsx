import { useCallback, useEffect, useState } from 'react';
import { episodesOf } from '@shared/episodes.js';
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
import { useTranslation, Trans, getLocale } from '../i18n/index.js';
import { formatInteger } from '../i18n/format.js';
import { seasonShapeLabel } from '../lib/sim.js';
import { contentLangOf } from '../lib/caseLocale.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import { languageName } from '../i18n/format.js';

const DEFAULT_STAGES = [{ id: 'resolve' }, { id: 'profile' }, { id: 'filings' }, { id: 'news' }, { id: 'website' }, { id: 'synthesis' }];
const KIND_ICON = { structured: Database, reference: FileText, filing: FileText, news: Newspaper, company: Globe };

function StageIcon({ status }) {
  if (status === 'running') return <span className="spinner" aria-hidden="true" />;
  if (status === 'done') return <Check aria-hidden="true" />;
  if (status === 'error') return <X aria-hidden="true" />;
  if (status === 'skipped') return <Minus aria-hidden="true" />;
  return <span className="dot off" aria-hidden="true" />;
}
function Terminal({ stages, progress, sources, running }) {
  const { t } = useTranslation();
  return (
    <div className="grid-12">
      <section className="glass terminal span-8" aria-labelledby="stg-h">
        <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
          <h2 id="stg-h" className="section-title">
            {t('research.statusTitle')}
          </h2>
          <span className="meta">{running ? t('research.live') : t('research.finished')}</span>
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
                  {t(`research.stages.${s.id}`, { defaultValue: s.label || s.id })}
                  <span className="sr-only">{t(`research.stageStatus.${p.status}`)}</span>
                </span>
                <span className="stage-detail" title={p.detail} lang="en" dir="auto">
                  {p.detail || (p.status === 'running' ? t('research.working') : '')}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
      <section className="panel panel-pad span-4" aria-labelledby="disc-h">
        <div className="row between" style={{ marginBottom: 'var(--s3)' }}>
          <h2 id="disc-h" className="section-title">
            {t('research.sourcesFound')}
          </h2>
          <span className="meta num">{formatInteger(sources.length)}</span>
        </div>
        {sources.length === 0 ? (
          <p className="meta">{running ? t('research.sourcesWaiting') : t('research.noSources')}</p>
        ) : (
          <ul className="feed">
            {sources.map((s, i) => {
              const Icon = KIND_ICON[s.kind] || FileText;
              return (
                <li key={i}>
                  <Icon size={15} className="faint" aria-hidden="true" style={{ marginTop: 2 }} />
                  <span style={{ minWidth: 0 }}>
                    <a href={safeUrl(s.url)} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }} lang="und" dir="auto">
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
  const { t } = useTranslation();
  const facts = r.profile.facts.filter((f) => f.property !== 'P856');
  return (
    <div className="stack gap-5">
      {r.wikipedia && (
        <div className="stack gap-3">
          <span className="provenance prov-source">{t('research.facts.sourceReference')}</span>
          <p className="body" lang="en" dir="auto">
            {r.wikipedia.extract}
          </p>
          <p className="meta">
            {t('research.facts.from')}{' '}
            <a className="link" href={safeUrl(r.wikipedia.url)} target="_blank" rel="noreferrer">
              {t('research.facts.wikipedia')}
            </a>
            {r.wikipedia.lastModified && t('research.facts.lastEdited', { date: fmtDate(r.wikipedia.lastModified) })}
            {t('research.facts.verifyNote')}
          </p>
        </div>
      )}
      <div className="stack gap-3">
        <span className="provenance prov-verified">{t('research.facts.structured')}</span>
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">{t('research.facts.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('research.facts.colFact')}</th>
                <th scope="col">{t('research.facts.colValue')}</th>
                <th scope="col">{t('research.facts.colAsOf')}</th>
                <th scope="col">{t('research.facts.colSource')}</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f) => (
                <tr key={f.label}>
                  <th scope="row" style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 'var(--t-14)', background: 'transparent', color: 'var(--text)' }}>
                    {t(`research.facts.labels.${f.property}`, { defaultValue: f.label })}
                  </th>
                  <td className="tabular" lang="en" dir="auto">
                    {f.value}
                  </td>
                  <td className="meta num">{f.asOf || ''}</td>
                  <td>
                    <a className="link meta" href={safeUrl(`${f.sourceUrl}#${f.property}`)} target="_blank" rel="noreferrer">
                      {t('research.facts.wikidataProp', { property: f.property })}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="meta">{t('research.facts.note')}</p>
      </div>
    </div>
  );
}

function Financials({ r }) {
  const { t } = useTranslation();
  if (!r.sec) {
    return (
      <Empty icon={FileText} title={t('research.financials.noneTitle')}>
        {r.stages.filings?.detail || t('research.financials.noneDefault')} {t('research.financials.noInvent')}
      </Empty>
    );
  }
  const rev = r.sec.revenue;
  return (
    <div className="stack gap-5">
      <span className="provenance prov-verified">{t('research.financials.audited')}</span>
      {rev ? (
        <FinancialChart
          title={t(r.sec.netIncome ? 'research.financials.chartTitleNet' : 'research.financials.chartTitle', { name: r.sec.entityName })}
          series={rev.series}
          unit={rev.unit}
          secondary={r.sec.netIncome?.unit === rev.unit ? r.sec.netIncome.series : null}
          secondaryLabel={t('research.financials.netIncome')}
          sourceLabel={`SEC EDGAR XBRL (${rev.tag})`}
          sourceUrl={r.sec.sourceUrl}
        />
      ) : (
        <Callout>{t('research.financials.noRevenue')}</Callout>
      )}
      {r.sec.filings.length > 0 && (
        <div className="stack gap-3">
          <h3 className="section-title">{t('research.financials.recent')}</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('research.financials.colForm')}</th>
                  <th scope="col">{t('research.financials.colFiled')}</th>
                  <th scope="col">{t('research.financials.colDocument')}</th>
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
  const { t } = useTranslation();
  if (!r.news.length) return <Empty icon={Newspaper} title={t('research.news.noneTitle')}>{r.stages.news?.detail}</Empty>;
  return (
    <div className="stack gap-4">
      <span className="provenance prov-source">{t('research.news.label')}</span>
      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {r.news.map((n) => (
          <li key={n.url} style={{ padding: 'var(--s4) 0', borderBottom: '1px solid var(--border)' }}>
            <a href={safeUrl(n.url)} target="_blank" rel="noreferrer" className="stack gap-1">
              <span style={{ fontWeight: 500, fontSize: 'var(--t-16)' }} lang="und" dir="auto">
                {n.title}
              </span>
              <span className="meta num">
                {n.publisher || t('research.news.unknownPublisher')} · {fmtDate(n.date)}
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="meta">{t('research.news.note')}</p>
    </div>
  );
}

function Analysis({ r, status }) {
  const { t } = useTranslation();
  const g = r.generated?.case;
  const nav = useNavigate();
  if (!g) {
    return (
      <div className="stack gap-4">
        {r.stages.synthesis?.status === 'error' ? (
          <Callout tone="danger" icon={AlertTriangle}>
            {t('research.analysis.failed', { detail: r.stages.synthesis.detail })}
          </Callout>
        ) : (
          <Callout icon={Info}>
            {status?.ai?.enabled === false ? (
              <Trans i18nKey="research.analysis.aiOff" components={{ link: <Link className="link" to="/settings" /> }} />
            ) : (
              r.stages.synthesis?.detail || t('research.analysis.none')
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
        <strong>{t('research.analysis.title')}</strong> {t('research.analysis.by', { provider: status?.ai?.provider || g.provider || '', model: status?.ai?.model || g.model || '', count: g.sources.length })} {r.generated.warnings?.length ? t('research.analysis.removed', { count: r.generated.warnings.length }) : ''}
      </Callout>
      <div>
        <ListenButton
          id={`analysis-${g.id}`}
          label={t('research.analysis.listen')}
          lang={contentLangOf(g)}
          getText={() => [a.summary, a.strengths?.length && `Strengths: ${a.strengths.join('. ')}.`, a.risks?.length && `Risks: ${a.risks.join('. ')}.`, a.uncertainties?.length && `Open questions: ${a.uncertainties.join('. ')}.`].filter(Boolean).join(' ')}
        />
      </div>
      {a.summary && (
        <p className="body" lang={contentLangOf(g)} dir="auto">
          {a.summary}
        </p>
      )}
      <div className="grid-12">
        {[
          [t('research.analysis.strengths'), a.strengths, 'prov-ai'],
          [t('research.analysis.risks'), a.risks, 'prov-ai'],
          [t('research.analysis.uncertainties'), a.uncertainties, 'prov-hypo'],
        ].map(([title, list, cls]) =>
          list?.length ? (
            <section key={title} className="panel panel-pad span-4 stack gap-3" style={{ gridColumn: 'span 4' }}>
              <h3 className={`provenance ${cls}`}>{title}</h3>
              <ul className="stack gap-2" style={{ margin: 0, paddingInlineStart: 'var(--s4)' }} lang={contentLangOf(g)} dir="auto">
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
          <h3 className="provenance prov-hypo">{t('research.analysis.scenarios')}</h3>
          {g.scenarios.map((s, i) => (
            <div key={i} className="principle" lang={contentLangOf(g)} dir="auto">
              <div className="principle-name">{s.name}</div>
              <p className="muted">{s.description}</p>
            </div>
          ))}
        </section>
      )}
      <section className="panel panel-pad row between wrap gap-4">
        <div className="stack gap-2 grow">
          <span className="meta-caps">{t('research.analysis.generated', { shape: seasonShapeLabel(g) })}</span>
          {g.contentLocale && LOCALE_BY_CODE[g.contentLocale] && <span className="meta">{t('research.analysis.language', { language: languageName(g.contentLocale) })}</span>}
          <h3 className="h2" lang={contentLangOf(g)} dir="auto">
            {g.title}
          </h3>
          <p className="muted" lang={contentLangOf(g)} dir="auto">
            {g.tagline}
          </p>
          <ol className="episodes" aria-label={t('explore.episodes')}>
            {episodesOf(g).map((e) => (
              <li key={e.n}>
                <span className="ep-num num">{t('explore.epShort', { roman: e.roman, n: e.n })}</span>
                <span lang={contentLangOf(g)} dir="auto">
                  {e.title}{' '}
                  <span className="faint">
                    · {e.dateLabel}
                    {e.decisions.length > 1 ? ` · ${t('research.analysis.epDecisions', { count: e.decisions.length })}` : ''}
                  </span>
                  {e.live && <Badge tone="warning">{t('research.analysis.now')}</Badge>}
                </span>
              </li>
            ))}
          </ol>
          <PrincipleList ids={g.concept?.principles || []} />
        </div>
        <Button variant="primary" size="lg" icon={Play} onClick={play}>
          {t('research.analysis.play')}
        </Button>
      </section>
    </div>
  );
}

function Result({ r, status }) {
  const { t } = useTranslation();
  const saved = useStore((s) => s.savedCompanies.some((c) => c.id === r.profile?.id));
  const [tab, setTab] = useState('overview');
  if (!r.profile) {
    return (
      <section className="panel panel-pad stack gap-4">
        <Empty icon={Search} title={t('research.result.notFoundTitle')}>
          {t('research.result.notFoundBody')}
        </Empty>
        {r.candidates?.length > 0 && (
          <div className="stack gap-2">
            <span className="meta-caps">{t('research.result.closest')}</span>
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
      toast(t('research.result.removed'));
    } else {
      saveCompany({ id: r.profile.id, name: r.profile.name, description: r.profile.description, website: r.profile.website });
      toast(t('research.result.saved'));
    }
  };
  const tabs = [
    { id: 'overview', label: t('research.result.tabs.overview') },
    { id: 'financials', label: t('research.result.tabs.financials'), count: formatInteger(r.sec?.revenue?.series.length || 0) },
    { id: 'news', label: t('research.result.tabs.news'), count: formatInteger(r.news.length) },
    { id: 'sources', label: t('research.result.tabs.sources'), count: formatInteger(r.sources.length) },
    { id: 'analysis', label: t('research.result.tabs.analysis') },
  ];
  return (
    <section className="stack gap-5" aria-labelledby="res-name">
      <div className="row between wrap gap-4">
        <div className="stack gap-2">
          <span className="meta-caps" lang="en" dir="auto">
            {r.profile.description}
          </span>
          <h2 id="res-name" className="display" style={{ fontSize: 'var(--t-36)' }} dir="auto">
            {r.profile.name}
          </h2>
          <div className="badges">
            {r.profile.tickers.slice(0, 3).map((tk) => (
              <Badge key={tk.ticker + tk.exchange}>
                {tk.ticker}
                {tk.exchange ? ` · ${tk.exchange}` : ''}
              </Badge>
            ))}
            {r.profile.website && (
              <a className="badge" href={safeUrl(r.profile.website)} target="_blank" rel="noreferrer">
                <Globe aria-hidden="true" /> {t('research.result.website')}
              </a>
            )}
            {r.via && <Badge title={t('research.result.makerHint')}>{t('research.result.maker', { label: r.via.label })}</Badge>}
            {r.fromCache && <Badge title={t('research.result.cachedHint')}>{t('research.result.cached', { date: fmtDate(r.finishedAt) })}</Badge>}
          </div>
        </div>
        <Button icon={saved ? BookmarkCheck : Bookmark} onClick={toggleSave} aria-pressed={saved}>
          {saved ? t('research.result.savedButton') : t('research.result.save')}
        </Button>
      </div>
      <div className="legend">
        <span className="provenance prov-verified">{t('research.result.legend.structured')}</span>
        <span className="provenance prov-source">{t('research.result.legend.source')}</span>
        <span className="provenance prov-ai">{t('research.result.legend.ai')}</span>
        <span className="provenance prov-hypo">{t('research.result.legend.hypo')}</span>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} label={t('research.result.resultsLabel')} />
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
  const { t } = useTranslation();
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
    else if (ev.event === 'failure') error = ev.data.message || t('research.form.failed');
  }
  const running = Boolean(job && !job.done);

  const run = useCallback(
    (query) => {
      const term = query.trim();
      if (term.length < 2) return;
      setParams({ q: term }, { replace: true });
      // The season is written in the interface language (see docs/I18N.md).
      startJob('research', '/api/jobs/research', { q: term, locale: getLocale() }, { q: term });
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
        <p className="lead">{t('research.form.lead')}</p>
        <form
          className="research-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(q);
          }}
        >
          <label htmlFor="company" className="sr-only">
            {t('research.form.label')}
          </label>
          <input id="company" className="input input-lg" placeholder={t('research.form.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" autoFocus={!params.get('q')} />
          <Button type="submit" variant="primary" size="lg" loading={running} disabled={q.trim().length < 2 || running} iconRight={ArrowRight}>
            {t('research.form.start')}
          </Button>
        </form>
        <p className="meta">
          {t('research.form.searches', { secNote: status && !status.sec ? t('research.form.secNotConfigured') : '' })}{' '}
          {status?.ai?.enabled ? `${t('research.form.aiOn')}${LOCALE_BY_CODE[getLocale()]?.language !== 'en' ? ` ${t('research.form.aiOnLang', { language: languageName(getLocale()) })}` : ''}` : t('research.form.aiOff')}
        </p>
      </header>

      {status && status.online === false && (
        <Callout tone="warning" icon={AlertTriangle}>
          <Trans i18nKey="research.form.unreachable" values={{ error: status.error }} components={{ link: <Link className="link" to="/settings" /> }} />
        </Callout>
      )}
      {error && (
        <Callout tone="danger" icon={AlertTriangle}>
          {error}
        </Callout>
      )}
      {running && <p className="meta">{t('research.form.background')}</p>}
      {started && <Terminal stages={stages} progress={progress} sources={sources} running={running} />}
      {result && <Result r={result} status={status} />}
    </div>
  );
}

export default function Research() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'chat' ? 'chat' : 'company';
  return (
    <div className="stack gap-6">
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">{t('research.page.eyebrow')}</div>
        <h1 className="display">{mode === 'chat' ? t('research.page.titleChat') : t('research.page.titleCompany')}</h1>
      </header>
      <Tabs
        label={t('research.page.mode')}
        value={mode}
        onChange={(v) => setParams(v === 'chat' ? { mode: 'chat' } : {}, { replace: true })}
        tabs={[
          { id: 'company', label: t('research.page.tabCompany') },
          { id: 'chat', label: t('research.page.tabChat') },
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
