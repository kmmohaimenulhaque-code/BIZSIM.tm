import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, CheckCircle2, Trash2, Building2, Clock, Search, FileText, Download, Upload, RotateCcw, Server, BookOpen, ArrowRight, ExternalLink, Sparkles, FileDown } from 'lucide-react';
import { CASES } from '@shared/cases/index.js';
import { BOOKS, PRINCIPLES, BOOK_BY_ID } from '@shared/books.js';
import { Badge, Button, Callout, Dialog, Empty, QualityBars, toast } from '../components/ui.jsx';
import { DimensionBars } from '../components/content.jsx';
import { TransferPanel, PhonePanel } from '../components/Transfer.jsx';
import { KeysPanel } from '../components/Keys.jsx';
import { StoragePanel } from '../components/Storage.jsx';
import { VOICES, currentVoice, setVoice } from '../lib/voice.js';
import { ListenButton } from '../components/Listen.jsx';
import { CaseRow } from './Dashboard.jsx';
import { useStore, removeCompany, removeGeneratedCase, removeResearchHistoryItem, removeRunHistoryEntry, clearAnalysisHistory, exportState, previewImport, applyImport, resetState, setTheme, storageIsPersistent } from '../lib/store.js';
import { saveFile, readFileText } from '../lib/files.js';
import { openImport } from '../components/CaseShare.jsx';
import { BookmarkButton } from '../components/Collections.jsx';
import { findCase, learningStats, metersFor, progressLabel, decisionLabel, isOpen, wilson } from '../lib/sim.js';
import { apiBase, setApiBase } from '../lib/api.js';
import { useStatus, refreshStatus } from '../lib/useStatus.js';
import { relTime, fmtDate } from '../lib/format.js';
import { useTranslation, Trans, t as tr } from '../i18n/index.js';
import { formatInteger, formatDecimal, formatPercent, formatDateTime, formatList } from '../i18n/format.js';
import { LANGUAGE_COUNT } from '@shared/locales.js';
import { LanguagePanel } from '../components/Language.jsx';
import { contentLangOf } from '../lib/caseLocale.js';


function PageHead({ eyebrow, title, lead, action }) {
  return (
    <header className="row between wrap gap-4" style={{ alignItems: 'flex-end' }}>
      <div className="stack gap-3">
        <div className="eyebrow eyebrow-rule">{eyebrow}</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          {title}
        </h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {action}
    </header>
  );
}

// ---------- Simulations ----------
export function Simulations() {
  const { t } = useTranslation();
  const runs = useStore((s) => s.runs);
  useStore((s) => s.myCases);
  const active = runs.filter((r) => isOpen(r) && findCase(r.caseId));
  const finished = runs.filter((r) => r.finishedAt && findCase(r.caseId));
  const played = new Set(runs.map((r) => r.caseId));
  const next = CASES.filter((c) => !played.has(c.id));
  return (
    <div className="stack gap-6">
      <PageHead eyebrow={t('simulations.eyebrow')} title={t('simulations.title')} lead={t('simulations.lead')} />
      {active.length > 0 && (
        <section className="panel" aria-labelledby="ip-h">
          <div className="panel-head">
            <h2 id="ip-h" className="section-title">
              {t('simulations.inProgress')}
            </h2>
          </div>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, paddingBlock: 0, paddingInline: 'var(--s5)' }}>
            {active.map((r) => {
              const c = findCase(r.caseId);
              return (
                <li key={r.id} className="row between wrap gap-3" style={{ padding: 'var(--s4) 0', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <div style={{ fontWeight: 500 }} lang={contentLangOf(c)} dir="auto">
                      {c.title}
                    </div>
                    <div className="meta num">
                      {c.company} · {progressLabel(c, r)} · {t('simulations.startedAgo', { time: relTime(r.startedAt) })}
                    </div>
                  </span>
                  <Link className="btn btn-primary btn-sm" to={`/cases/${c.id}`}>
                    <Play aria-hidden="true" /> {t('simulations.resume')}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="panel" aria-labelledby="ns-h">
        <div className="panel-head">
          <h2 id="ns-h" className="section-title">
            {next.length ? t('simulations.notPlayed') : t('simulations.allPlayed')}
          </h2>
          <Link to="/cases" className="link">
            {t('simulations.library')} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div style={{ paddingInline: 'var(--s5)', paddingBottom: 'var(--s2)' }}>
          {(next.length ? next : CASES).slice(0, 4).map((c) => (
            <CaseRow key={c.id} c={c} />
          ))}
        </div>
      </section>
      <section className="stack gap-3" aria-labelledby="done-h">
        <h2 id="done-h" className="section-title">
          {t('simulations.completed')}
        </h2>
        {finished.length === 0 ? (
          <div className="panel">
            <Empty icon={CheckCircle2}>{t('simulations.completedEmpty')}</Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('simulations.colCase')}</th>
                  <th scope="col">{t('simulations.colCompleted')}</th>
                  <th scope="col">{t('simulations.colMatched')}</th>
                  <th scope="col">{t('simulations.colQuality')}</th>
                  <th scope="col">{t('simulations.colPosition')}</th>
                </tr>
              </thead>
              <tbody>
                {finished.map((r) => {
                  const c = findCase(r.caseId);
                  const avg = r.choices.reduce((a, x) => a + x.quality, 0) / (r.choices.length || 1);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link className="link" to={`/cases/${c.id}`} lang={contentLangOf(c)} dir="auto">
                          {c.title}
                        </Link>
                        <div className="meta">{c.company}</div>
                      </td>
                      <td className="num">{fmtDate(r.finishedAt)}</td>
                      <td className="num">{c.classification === 'HYPOTHETICAL' ? '' : t('simulations.fraction', { a: formatInteger(r.choices.filter((x) => x.historical).length), b: formatInteger(r.choices.length) })}</td>
                      <td>
                        <QualityBars value={Math.round(avg)} />
                      </td>
                      <td className="num">{formatInteger(metersFor(r).position)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- Learning profile ----------
export function Learning() {
  const { t } = useTranslation();
  const state = useStore((s) => s);
  const stats = learningStats(state);
  const topPrinciples = Object.entries(stats.principleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <div className="stack gap-6">
      <PageHead eyebrow={t('learning.eyebrow')} title={t('learning.title')} lead={t('learning.lead')} />
      {stats.decisions === 0 ? (
        <div className="panel">
          <Empty
            icon={Play}
            title={t('learning.emptyTitle')}
            action={
              <Link to="/simulations" className="btn btn-primary">
                {t('learning.emptyAction')}
              </Link>
            }
          >
            {t('learning.emptyBody')}
          </Empty>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="meta-caps">{t('learning.kpi.decisions')}</span>
              <span className="kpi-value num">{formatInteger(stats.decisions)}</span>
              <span className="meta">{t('learning.kpi.yourChoices')}</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">{t('learning.kpi.completed')}</span>
              <span className="kpi-value num">{formatInteger(stats.casesCompleted)}</span>
              <span className="meta">{stats.replays ? t('learning.kpi.replays', { count: stats.replays }) : t('learning.kpi.noReplays')}</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">{t('learning.kpi.matched')}</span>
              <span className="kpi-value num">{stats.alignment == null ? '' : formatPercent(stats.alignment / 100)}</span>
              <span className="meta">{stats.alignmentN ? t('learning.kpi.matchedOf', { matched: formatInteger(stats.alignmentMatched), total: formatInteger(stats.alignmentN) }) : t('learning.kpi.noDocumented')}</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">{t('learning.kpi.quality')}</span>
              <span className="kpi-value num">{formatDecimal(stats.avgQuality, 2)}</span>
              <span className="meta">{t('learning.kpi.qualityOf', { count: stats.decisions })}</span>
            </div>
          </div>
          <section className="panel panel-pad stack gap-4" aria-labelledby="sure-h">
            <h2 id="sure-h" className="section-title">
              {t('learning.sure.title')}
            </h2>
            <div className="stack gap-3">
              <RangeBar label={t('learning.sure.matched')} lo={stats.alignmentCI?.[0]} hi={stats.alignmentCI?.[1]} value={stats.alignment == null ? null : stats.alignment / 100} fmt={(v) => formatPercent(v)} n={stats.alignmentN} />
              <RangeBar label={t('learning.sure.quality')} lo={stats.qualityCI ? (stats.qualityCI[0] - 1) / 2 : null} hi={stats.qualityCI ? (stats.qualityCI[1] - 1) / 2 : null} value={(stats.avgQuality - 1) / 2} fmt={(v) => formatDecimal(1 + v * 2)} n={stats.decisions} />
            </div>
            <p className="meta">{t('learning.sure.note')}</p>
            <div className="quality-split" dir="ltr" role="img" aria-label={t('learning.sure.splitLabel', { strong: stats.qualityCounts[3], sound: stats.qualityCounts[2], weak: stats.qualityCounts[1] })}>
              {[3, 2, 1].map((q) => (
                <span key={q} className={`qs qs-${q}`} style={{ flexGrow: stats.qualityCounts[q] || 0 }} title={t(q === 3 ? 'learning.sure.countStrong' : q === 2 ? 'learning.sure.countSound' : 'learning.sure.countWeak', { count: stats.qualityCounts[q] })} />
              ))}
            </div>
            <div className="row wrap gap-4 meta">
              <span>
                <i className="qs-key qs-3" /> {t('learning.sure.strong')} {formatInteger(stats.qualityCounts[3])}
              </span>
              <span>
                <i className="qs-key qs-2" /> {t('learning.sure.sound')} {formatInteger(stats.qualityCounts[2])}
              </span>
              <span>
                <i className="qs-key qs-1" /> {t('learning.sure.weak')} {formatInteger(stats.qualityCounts[1])}
              </span>
            </div>
          </section>
          <Callout>{t('learning.separate')}</Callout>
          <section className="panel panel-pad stack gap-2" aria-labelledby="src-kinds-h">
            <h2 id="src-kinds-h" className="section-title">
              {t('learning.sources.title')}
            </h2>
            <ul className="stack gap-2 body" style={{ margin: 0, paddingInlineStart: 'var(--s5)' }}>
              <li>
                <strong>{t('learning.sources.decisionsTitle')}</strong> {t('learning.sources.decisions')}
              </li>
              <li>
                <strong>{t('learning.sources.historyTitle')}</strong> {t('learning.sources.history')} {stats.liveDecisions > 0 && t('learning.sources.live', { count: stats.liveDecisions })}
              </li>
              <li>
                <strong>{t('learning.sources.derivedTitle')}</strong> {t('learning.sources.derived')}
              </li>
              <li>
                <strong>{t('learning.sources.aiTitle')}</strong> {stats.aiSeasonDecisions ? t('learning.sources.ai', { count: stats.aiSeasonDecisions }) : t('learning.sources.aiNone')}
              </li>
            </ul>
            <p className="meta">{t('learning.sources.notPsych')}</p>
          </section>
          <section className="panel panel-pad stack gap-5" aria-labelledby="dims-h">
            <h2 id="dims-h" className="section-title">
              {t('learning.dimensions')}
            </h2>
            <DimensionBars dims={state.profile.dims} />
            <p className="meta">{t('learning.dimensionsNote')}</p>
          </section>
          {topPrinciples.length > 0 && (
            <section className="panel panel-pad stack gap-4" aria-labelledby="pr-h">
              <h2 id="pr-h" className="section-title">
                {t('learning.topPrinciples')}
              </h2>
              <ul className="stack gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {topPrinciples.map(([id, n]) => {
                  const p = PRINCIPLES.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <li key={id} className="row between gap-4">
                      <span>
                        <Link to={`/principles#${id}`} style={{ fontWeight: 500 }} lang="en">
                          {p.name}
                        </Link>
                        <div className="meta">{BOOK_BY_ID[p.book].title}</div>
                      </span>
                      <span className="num muted">{t('learning.times', { count: n })}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RangeBar({ label, value, lo, hi, fmt, n }) {
  const { t } = useTranslation();
  if (value == null || Number.isNaN(value)) return null;
  return (
    <div className="range-row">
      <div className="row between meta">
        <span>{label}</span>
        <span className="num">
          {fmt(value)}
          {lo != null && hi != null ? t('learning.sure.likely', { lo: fmt(lo), hi: fmt(hi), n: formatInteger(n) }) : t('learning.sure.tooFew', { n: formatInteger(n) })}
        </span>
      </div>
      <div className="range-track" aria-hidden="true" dir="ltr">
        {lo != null && hi != null && <span className="range-band" style={{ left: `${lo * 100}%`, width: `${Math.max(1, (hi - lo) * 100)}%` }} />}
        <span className="range-dot" style={{ left: `${value * 100}%` }} />
      </div>
    </div>
  );
}

// ---------- My cases ----------
export function MyCases() {
  const { t } = useTranslation();
  const cases = useStore((s) => s.myCases);
  return (
    <div className="stack gap-6">
      <PageHead
        eyebrow={t('myCases.eyebrow')}
        title={t('myCases.title')}
        lead={t('myCases.lead')}
        action={
          <div className="row wrap gap-2">
            <Button icon={FileDown} onClick={openImport}>
              {t('myCases.import')}
            </Button>
            <Link to="/research" className="btn btn-primary">
              <Search aria-hidden="true" /> {t('myCases.research')}
            </Link>
          </div>
        }
      />
      {cases.length === 0 ? (
        <div className="panel">
          <Empty icon={FileText} title={t('myCases.emptyTitle')}>
            {t('myCases.emptyBody')}
          </Empty>
        </div>
      ) : (
        <div className="panel" style={{ paddingInline: 'var(--s5)' }}>
          {cases.map((c) => (
            <div key={c.id} className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <CaseRow c={c} />
              </div>
              <Button
                variant="ghost"
                icon={Trash2}
                aria-label={t('myCases.delete', { title: c.title })}
                style={{ marginTop: 'var(--s4)' }}
                onClick={() => {
                  if (window.confirm(t('myCases.confirmDelete', { title: c.title }))) {
                    removeGeneratedCase(c.id);
                    toast(t('myCases.deleted'));
                  }
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Saved companies ----------
export function Companies() {
  const { t } = useTranslation();
  const list = useStore((s) => s.savedCompanies);
  return (
    <div className="stack gap-6">
      <PageHead eyebrow={t('companies.eyebrow')} title={t('companies.title')} lead={t('companies.lead')} />
      {list.length === 0 ? (
        <div className="panel">
          <Empty
            icon={Building2}
            title={t('companies.emptyTitle')}
            action={
              <Link to="/research" className="btn">
                {t('companies.emptyAction')}
              </Link>
            }
          >
            {t('companies.emptyBody')}
          </Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('companies.colCompany')}</th>
                <th scope="col">{t('companies.colSaved')}</th>
                <th scope="col">
                  <span className="sr-only">{t('companies.colActions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500 }} dir="auto">{c.name}</div>
                    <div className="meta" dir="auto">{c.description}</div>
                  </td>
                  <td className="num meta">{relTime(c.savedAt)}</td>
                  <td>
                    <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                      <Link className="btn btn-sm" to={`/research?q=${encodeURIComponent(c.name)}&run=1`}>
                        <Search aria-hidden="true" /> {t('companies.research')}
                      </Link>
                      <BookmarkButton item={{ type: 'company', id: c.id, label: c.name }} compact />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('companies.remove', { name: c.name })} onClick={() => removeCompany(c.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- History ----------
export function History() {
  const { t } = useTranslation();
  const research = useStore((s) => s.researchHistory);
  const runs = useStore((s) => s.runs);
  useStore((s) => s.myCases);
  const events = [
    ...research.map((h) => ({
      key: `r:${h.at}:${h.query}`,
      kind: 'research',
      at: h.at,
      query: h.query,
      type: t('history.typeResearch'),
      label: h.name || h.query,
      sub: t('history.sources', { count: h.sourcesCount }) + (h.generated ? t('history.caseGenerated') : ''),
      to: `/research?q=${encodeURIComponent(h.query)}&run=1`,
      icon: Search,
    })),
    ...runs.flatMap((r) => {
      const c = findCase(r.caseId);
      if (!c) return [];
      return r.choices.map((ch) => {
        const k = c.checkpoints.find((x) => x.id === ch.checkpointId);
        const o = k?.options.find((x) => x.id === ch.optionId);
        return {
          key: `d:${r.id}:${ch.checkpointId}:${ch.at}`,
          kind: 'decision',
          runId: r.id,
          checkpointId: ch.checkpointId,
          at: ch.at,
          type: t('history.typeDecision'),
          label: `${c.company}: ${decisionLabel(c, ch.checkpointId) || k?.title}`,
          sub: o?.label,
          to: `/cases/${c.id}`,
          icon: Play,
        };
      });
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="stack gap-6">
      <PageHead
        eyebrow={t('history.eyebrow')}
        title={t('history.title')}
        lead={t('history.lead')}
        action={
          events.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => {
                if (window.confirm(t('history.clearConfirm', 'Delete all items from Analysis History?'))) {
                  clearAnalysisHistory();
                  toast?.(t('history.cleared', 'Analysis history cleared'));
                }
              }}
            >
              {t('history.clearAll', 'Clear history')}
            </Button>
          ) : null
        }
      />
      {events.length === 0 ? (
        <div className="panel">
          <Empty icon={Clock}>{t('history.empty')}</Empty>
        </div>
      ) : (
        <ol className="panel" style={{ listStyle: 'none', margin: 0, paddingBlock: 0, paddingInline: 'var(--s5)' }}>
          {events.slice(0, 200).map((ev, i) => (
            <li
              key={ev.key}
              className="history-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: 'var(--s4) 0',
                borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 0,
              }}
            >
              <Link to={ev.to} className="row gap-4" style={{ flex: 1, minWidth: 0 }}>
                <ev.icon size={16} className="faint" aria-hidden="true" />
                <span className="grow">
                  <span className="row gap-2 wrap">
                    <Badge>{ev.type}</Badge>
                    <span style={{ fontWeight: 500 }} dir="auto">{ev.label}</span>
                  </span>
                  <span className="meta" dir="auto">{ev.sub}</span>
                </span>
                <span className="meta num" style={{ whiteSpace: 'nowrap' }}>
                  {relTime(ev.at)}
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={Trash2}
                aria-label={t('history.deleteItem', 'Delete entry')}
                title={t('history.deleteItem', 'Delete entry')}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (ev.kind === 'research') {
                    removeResearchHistoryItem(ev.at, ev.query);
                  } else {
                    removeRunHistoryEntry(ev.runId, ev.checkpointId);
                  }
                  toast?.(t('history.deleted', 'History entry deleted'));
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Settings ----------
function RestorePreview({ preview, onClose }) {
  const { t } = useTranslation();
  const { report, exportedAt, kind } = preview;
  const [mode, setMode] = useState('merge');
  const apply = () => {
    if (mode === 'replace' && !window.confirm(t('settings.restore.confirmReplace'))) return;
    applyImport(preview, mode);
    toast(mode === 'replace' ? t('settings.restore.restored') : t('settings.restore.merged'));
    onClose();
  };
  const kindLabel = kind === 'transfer' ? t('settings.restore.transfer') : t('settings.restore.backup');
  return (
    <Dialog title={t('settings.restore.title')} onClose={onClose}>
      <p className="muted">{exportedAt ? t('settings.restore.introDated', { kind: kindLabel, date: formatDateTime(exportedAt) }) : t('settings.restore.intro', { kind: kindLabel })}</p>
      <ul className="stack gap-1 meta" style={{ margin: 0, paddingInlineStart: 'var(--s4)' }}>
        <li>{t('settings.restore.runs', { count: report.runs })}</li>
        <li>{t('settings.restore.cases', { count: report.cases })}</li>
        <li>{t('settings.restore.companies', { count: report.companies })}</li>
        <li>{t('settings.restore.collections', { count: report.collections })}</li>
        {report.dropped > 0 && (
          <li>
            {t('settings.restore.dropped', { count: report.dropped })}
            {report.droppedCases.length ? t('settings.restore.droppedIncluding', { list: formatList(report.droppedCases.slice(0, 3)) }) : ''}
          </li>
        )}
      </ul>
      <fieldset className="stack gap-2" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="meta" style={{ marginBottom: 'var(--s2)' }}>
          {t('settings.restore.how')}
        </legend>
        <label className="row gap-2">
          <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> {t('settings.restore.merge')}
        </label>
        <label className="row gap-2">
          <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> {t('settings.restore.replace')}
        </label>
      </fieldset>
      <div className="row gap-2 wrap">
        <Button variant="primary" onClick={apply}>
          {mode === 'merge' ? t('settings.restore.mergeBtn') : t('settings.restore.replaceBtn')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('settings.restore.cancel')}
        </Button>
      </div>
    </Dialog>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const theme = useStore((s) => s.theme);
  const status = useStatus();
  const [server, setServer] = useState(apiBase());
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const download = async () => {
    try {
      const r = await saveFile(`bizsim-backup-${new Date().toISOString().slice(0, 10)}.json`, exportState());
      if (r === 'downloaded') toast(t('settings.data.downloaded'));
    } catch (e) {
      toast(t('settings.data.saveFailed', { message: e.message }), 'error');
    }
  };
  const onImport = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      setPreview(previewImport(await readFileText(f, 12_000_000)));
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <PageHead eyebrow={t('settings.eyebrow')} title={t('settings.title')} />
      <LanguagePanel />

      <section className="panel panel-pad stack gap-4" aria-labelledby="ap-h">
        <h2 id="ap-h" className="section-title">
          {t('settings.appearance.title')}
        </h2>
        <div className="row wrap gap-2" role="radiogroup" aria-label={t('settings.appearance.theme')}>
          {[
            [null, 'system'],
            ['dark', 'dark'],
            ['light', 'light'],
          ].map(([v, l]) => (
            <button key={l} className="chip" role="radio" aria-checked={theme === v} aria-pressed={theme === v} onClick={() => setTheme(v)}>
              {t(`settings.appearance.${l}`)}
            </button>
          ))}
        </div>
        <p className="meta">{t('settings.appearance.motion')}</p>
      </section>

      <KeysPanel />

      <section className="panel panel-pad stack gap-4" aria-labelledby="sv-h">
        <h2 id="sv-h" className="section-title">
          {t('settings.server.title')}
        </h2>
        <div className="row gap-2 meta">
          <i className={`dot${status?.online ? '' : ' off'}`} aria-hidden="true" />
          {status == null ? t('settings.server.checking') : status.online ? t('settings.server.connected', { version: status.version }) : t('settings.server.unreachable', { error: status.error })}
        </div>
        {status?.online && (
          <ul className="stack gap-1 meta" style={{ margin: 0, paddingInlineStart: 'var(--s4)' }}>
            <li>{t('settings.server.ai', { value: status.ai?.enabled ? `${status.ai.provider} · ${status.ai.model}` : t('settings.server.off') })}</li>
            <li>{t('settings.server.images', { generation: status.images?.generation || t('settings.server.off'), search: status.images?.search || t('settings.server.wikipedia') })}</li>
            <li>{t('settings.server.sec', { value: status.sec ? t('settings.server.on') : t('settings.server.off') })}</li>
          </ul>
        )}
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            setApiBase(server);
            refreshStatus();
            toast(server ? t('settings.server.saved') : t('settings.server.builtIn'));
          }}
        >
          <label htmlFor="srv">{t('settings.server.address')}</label>
          <div className="row gap-2 wrap">
            <input id="srv" className="input grow" dir="ltr" placeholder={t('settings.server.placeholder')} value={server} onChange={(e) => setServer(e.target.value)} inputMode="url" />
            <Button type="submit" icon={Server}>
              {t('settings.server.save')}
            </Button>
          </div>
          <span className="hint">{t('settings.server.hint')}</span>
        </form>
      </section>

      {preview && <RestorePreview preview={preview} onClose={() => setPreview(null)} />}

      <StoragePanel />

      <PhonePanel status={status} />

      <TransferPanel />

      <VoicePanel />

      <section className="panel panel-pad stack gap-4" aria-labelledby="dt-h">
        <h2 id="dt-h" className="section-title">
          {t('settings.data.title')}
        </h2>
        <p className="muted">{storageIsPersistent() ? t('settings.data.body') : t('settings.data.bodyNoStorage')}</p>
        <div className="row wrap gap-2">
          <Button icon={Download} onClick={download}>
            {t('settings.data.download')}
          </Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>
            {t('settings.data.restore')}
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() => {
              if (window.confirm(t('settings.data.confirmReset'))) {
                resetState();
                toast(t('settings.data.resetDone'));
              }
            }}
          >
            {t('settings.data.reset')}
          </Button>
        </div>
      </section>
    </div>
  );
}

function VoicePanel() {
  const { t } = useTranslation();
  const [voice, setV] = useState(currentVoice().id);
  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="vc-h">
      <h2 id="vc-h" className="section-title">
        {t('settings.voice.title')}
      </h2>
      <p className="muted">
        <Trans i18nKey="settings.voice.body" components={{ strong: <strong /> }} />
      </p>
      <p className="meta">{t('settings.voice.englishOnly')}</p>
      <div className="stack gap-2" role="radiogroup" aria-label={t('settings.voice.label')}>
        {VOICES.map((v) => (
          <label key={v.id} className="row gap-3" style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="voice"
              checked={voice === v.id}
              onChange={() => {
                setVoice(v.id);
                setV(v.id);
              }}
            />
            <span>
              <strong>{v.name}</strong> <span className="meta">{t(`settings.voice.notes.${v.id}`, { defaultValue: v.note })}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <ListenButton key={voice} id={`preview-${voice}`} label={t('settings.voice.preview')} getText={() => tr('settings.voice.sample', { lng: 'en' })} />
      </div>
    </section>
  );
}

// ---------- About & documentation ----------
const CLASS_IDS = ['documented', 'scriptural', 'live', 'counterfactual'];

export function About() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('overview'); // 'overview' | 'privacy' | 'terms'
  const ul = { margin: 0, paddingInlineStart: 'var(--s5)' };
  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <PageHead eyebrow={t('about.eyebrow')} title={t('about.title')} lead={t('about.lead')} />

      <div className="row wrap gap-2" role="tablist" aria-label="About BIZSIM sections" style={{ alignItems: 'center' }}>
        {[
          ['overview', 'About BIZSIM'],
          ['privacy', 'Privacy Policy'],
          ['terms', 'Terms & Conditions'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-pressed={tab === id}
            className="chip"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <a
          href="https://github.com/kmmohaimenulhaque-code/BIZSIM.tm"
          target="_blank"
          rel="noreferrer"
          className="chip"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
        >
          Source Code <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>

      <p className="meta">
        BIZSIM is 100% open source under the MIT License—inspect the code, verify every security control, or download official installers directly from{' '}
        <a className="link" href="https://github.com/kmmohaimenulhaque-code/BIZSIM.tm" target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </p>

      <Callout icon={Download}>
        <strong>Use the official native apps for personal use.</strong> For the best privacy, offline reliability, and safe local API key handling,{' '}
        <a className="link" href="https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/latest" target="_blank" rel="noreferrer">
          download the latest Desktop (Windows, macOS, Linux) or Mobile (Android, iOS) release
        </a>{' '}
        instead of relying on a public website deployment.
      </Callout>

      {tab === 'overview' && (
        <>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.howTitle')}</h2>
            <p className="body">{t('about.how1')}</p>
            <p className="body">{t('about.how2')}</p>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.kindsTitle')}</h2>
            <ul className="stack gap-2 body" style={ul}>
              {CLASS_IDS.map((id) => (
                <li key={id}>
                  <strong>{t(`contentClass.${id}.label`)}.</strong> {t(`contentClass.${id}.help`)}
                </li>
              ))}
            </ul>
            <p className="body">
              <Trans i18nKey="about.kindsAi" components={{ strong: <strong /> }} />
            </p>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.evidenceTitle')}</h2>
            <p className="body">{t('about.evidenceMethod')}</p>
            <ul className="stack gap-2 body" style={ul}>
              {['verified', 'available', 'inaccessible', 'insufficient'].map((k) => (
                <li key={k}>
                  <strong>{t(`evidence.status.${k}.label`)}.</strong> {t(`evidence.status.${k}.help`)}
                </li>
              ))}
            </ul>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.provTitle')}</h2>
            <div className="stack gap-3">
              <span className="provenance prov-verified">{t('about.provVerified')}</span>
              <span className="provenance prov-source">{t('about.provSource')}</span>
              <span className="provenance prov-ai">{t('about.provAi')}</span>
              <span className="provenance prov-hypo">{t('about.provHypo')}</span>
            </div>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.dataTitle')}</h2>
            <ul className="stack gap-2 body" style={ul}>
              {[].concat(t('about.data', { returnObjects: true }) || []).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.languagesTitle')}</h2>
            <p className="body">{t('about.languages', { count: LANGUAGE_COUNT })}</p>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.installTitle')}</h2>
            <p className="body">
              <Trans i18nKey="about.install" components={{ code: <code dir="ltr" /> }} />
            </p>
          </section>
          <section className="stack gap-3">
            <h2 className="section-title">{t('about.licenseTitle')}</h2>
            <p className="body">{t('about.license')}</p>
          </section>
          <Callout icon={Sparkles}>{t('about.privacy')}</Callout>
          <div className="row wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setTab('privacy')}>Read Privacy Policy</Button>
            <Button size="sm" variant="ghost" onClick={() => setTab('terms')}>Read Terms &amp; Conditions</Button>
          </div>
        </>
      )}

      {tab === 'privacy' && (
        <article className="panel panel-pad stack gap-5">
          <div className="stack gap-2">
            <h2 className="section-title">Privacy Policy</h2>
            <p className="meta">Applies to BIZSIM 1.7.3 (Desktop, Mobile, and Self-Hosted / Public Web deployments)</p>
          </div>

          <section className="stack gap-2">
            <h3 className="h3">1. No BIZSIM Cloud Account or Tracking Backend</h3>
            <p className="body">
              BIZSIM does not run a user-account cloud service that collects personal profiles, nor does it store user personal data on a BIZSIM-operated backend for analytics, tracking, profiling, or advertising.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">2. Local-First Device Storage</h3>
            <p className="body">
              Your simulation progress, saved companies, research history, custom cases, collections, settings, and any device-level API keys stay on your own device (or your own self-hosted deployment). Nothing leaves your device unless you explicitly export a backup, transfer progress via QR code, share a <code>.bizsim</code> case package, or submit a request to an upstream provider you configured.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">3. API Key Safety Is Your Responsibility</h3>
            <p className="body">
              If you enter third-party API keys (such as Google Gemini, OpenAI, Anthropic, NVIDIA NIM, Groq, xAI, or OpenRouter), protecting those keys is strictly your responsibility. Note that zero-key-logging on the server is not zero-key-transmission: browser device keys are stored in local browser storage and transmitted to the connected BIZSIM server in request headers (over HTTPS on properly configured sites) while forwarding your AI request, then discarded from request memory. BIZSIM’s authors and instance operators are not responsible for key leakage caused by your browser, browser extensions, device compromise, screenshots, shared computers, or misconfigured public deployments.
            </p>
            <p className="body">
              <strong>If you suspect an API key has been exposed:</strong> immediately revoke and rotate it at your provider’s console (Google AI Studio, OpenAI Platform, Anthropic Console, etc.).
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">4. Name &amp; Email Fields (e.g., SEC EDGAR User-Agent)</h3>
            <p className="body">
              Entering a name and email address—such as the contact string required by the U.S. SEC EDGAR fair-access policy (<code>SEC_USER_AGENT</code>) or local settings—is <strong>not</strong> an account signup and is not BIZSIM collecting a personal data vault. Those values are used solely to satisfy upstream regulatory/API header requirements or local preferences. BIZSIM does not build user dossiers or sell data.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">5. Public Web Deployments</h3>
            <p className="body">
              When you use a public website hosted by an operator, that operator’s server necessarily processes the HTTP requests you send to it in memory (for example, company research queries or AI synthesis requests). Operators are responsible for configuring HTTPS, environment secrets, and access controls properly. Even on public deployments, BIZSIM includes no central telemetry or BIZSIM-wide data collection service.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">6. Recommended Privacy Setup</h3>
            <p className="body">
              To get the full local-first privacy model BIZSIM was designed for, download and install the official Desktop (Windows, macOS, Linux) or Mobile (Android, iOS) apps rather than relying on a public web instance.
            </p>
          </section>
        </article>
      )}

      {tab === 'terms' && (
        <article className="panel panel-pad stack gap-5">
          <div className="stack gap-2">
            <h2 className="section-title">Terms &amp; Conditions</h2>
            <p className="meta">MIT License · BIZSIM 1.7.3</p>
          </div>

          <section className="stack gap-2">
            <h3 className="h3">1. Open-Source License &amp; No Warranty</h3>
            <p className="body">
              BIZSIM is provided “as is” under the <strong>MIT License</strong>, without warranty of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. To the maximum extent permitted by law, the authors and contributors are not liable for any claim, damages, or other liability arising from your use of the software.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">2. Educational Purpose — Not Professional Advice</h3>
            <p className="body">
              Simulations, historical case studies, live research dossiers, and AI-generated analyses are provided strictly for educational and strategic-thinking practice. They do not constitute financial, investment, legal, tax, or professional advice. You are solely responsible for verifying facts against primary sources and for any decisions you make.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">3. Third-Party AI Providers &amp; Costs</h3>
            <p className="body">
              Use of third-party AI APIs and public data endpoints is governed by your agreements with those providers. Any API usage fees, quota consumption, or billing incurred through your keys (or through an operator’s server keys) are strictly the responsibility of the key holder or instance operator.
            </p>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">4. Strongly Recommended: Download the Native Apps</h3>
            <p className="body">
              For regular personal use, you are strongly encouraged to download and run the official BIZSIM Desktop or Mobile apps (or a private self-hosted instance).
            </p>
            <Callout tone="warning">
              <strong>Do NOT test or rely on a public web deployment for SEC EDGAR or BYOK (bring-your-own-key) features.</strong> Public browsers, shared networks, third-party browser extensions, and multi-tenant web hosting increase the risk of credential exposure and misconfiguration. Use the official Desktop/Mobile apps or your own private self-hosted server for BYOK keys and SEC EDGAR lookups.
            </Callout>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">5. Acceptable Use</h3>
            <ul className="stack gap-2 body" style={ul}>
              <li>Do not abuse public BIZSIM instances, attempt to evade rate limits, or exhaust operator AI quotas.</li>
              <li>Do not use AI, research, or image endpoints for unauthorized scanning, SSRF attacks against third parties or private networks, or automated bulk scraping.</li>
              <li>Do not redistribute malicious or secret-bearing <code>.bizsim</code> packages.</li>
            </ul>
          </section>

          <section className="stack gap-2">
            <h3 className="h3">6. Key Compromise Response</h3>
            <p className="body">
              If a personal API key may have been exposed, rotate and revoke it immediately at your provider. If a public instance’s server-side environment keys are suspected of compromise, the operator must revoke and replace them immediately.
            </p>
          </section>
        </article>
      )}
    </div>
  );
}
