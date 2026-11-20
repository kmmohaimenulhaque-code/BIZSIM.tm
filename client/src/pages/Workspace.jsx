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
import { useStore, removeCompany, removeGeneratedCase, exportState, previewImport, applyImport, resetState, setTheme, storageIsPersistent } from '../lib/store.js';
import { saveFile, readFileText } from '../lib/files.js';
import { CONTENT_CLASSES } from '@shared/contentClass.js';
import { openImport } from '../components/CaseShare.jsx';
import { BookmarkButton } from '../components/Collections.jsx';
import { EVIDENCE } from '@shared/evidenceCheck.js';
import { findCase, learningStats, metersFor, progressLabel, decisionLabel, isOpen, wilson } from '../lib/sim.js';
import { apiBase, setApiBase } from '../lib/api.js';
import { useStatus, refreshStatus } from '../lib/useStatus.js';
import { relTime, fmtDate } from '../lib/format.js';

const evidenceMethod = 'Each historical outcome and evidence figure in the built-in seasons was compared automatically with the text of the source it cites: its years, figures and proper names were searched for in that source. This shows whether the source states the same details. It does not prove the history is true, and sources can be wrong or disputed.';

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
  const runs = useStore((s) => s.runs);
  useStore((s) => s.myCases);
  const active = runs.filter((r) => isOpen(r) && findCase(r.caseId));
  const finished = runs.filter((r) => r.finishedAt && findCase(r.caseId));
  const played = new Set(runs.map((r) => r.caseId));
  const next = CASES.filter((c) => !played.has(c.id));
  return (
    <div className="stack gap-6">
      <PageHead eyebrow="Simulations" title="Make the call." lead="Every simulation is a season of four episodes. Each episode holds two to four linked decisions; you see the evidence available at the time, make each call, then get the episode’s outcome and insight." />
      {active.length > 0 && (
        <section className="panel" aria-labelledby="ip-h">
          <div className="panel-head">
            <h2 id="ip-h" className="section-title">
              In progress
            </h2>
          </div>
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: '0 var(--s5)' }}>
            {active.map((r) => {
              const c = findCase(r.caseId);
              return (
                <li key={r.id} className="row between wrap gap-3" style={{ padding: 'var(--s4) 0', borderBottom: '1px solid var(--border)' }}>
                  <span>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                    <div className="meta num">
                      {c.company} · {progressLabel(c, r)} · started {relTime(r.startedAt)}
                    </div>
                  </span>
                  <Link className="btn btn-primary btn-sm" to={`/cases/${c.id}`}>
                    <Play aria-hidden="true" /> Resume
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
            {next.length ? 'Not yet played' : 'All curated cases played'}
          </h2>
          <Link to="/cases" className="link">
            Library <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <div style={{ padding: '0 var(--s5) var(--s2)' }}>
          {(next.length ? next : CASES).slice(0, 4).map((c) => (
            <CaseRow key={c.id} c={c} />
          ))}
        </div>
      </section>
      <section className="stack gap-3" aria-labelledby="done-h">
        <h2 id="done-h" className="section-title">
          Completed runs
        </h2>
        {finished.length === 0 ? (
          <div className="panel">
            <Empty icon={CheckCircle2}>Completed simulations and their results will be listed here.</Empty>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">Completed</th>
                  <th scope="col">Matched history</th>
                  <th scope="col">Avg. quality</th>
                  <th scope="col">Final position</th>
                </tr>
              </thead>
              <tbody>
                {finished.map((r) => {
                  const c = findCase(r.caseId);
                  const avg = r.choices.reduce((a, x) => a + x.quality, 0) / (r.choices.length || 1);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link className="link" to={`/cases/${c.id}`}>
                          {c.title}
                        </Link>
                        <div className="meta">{c.company}</div>
                      </td>
                      <td className="num">{fmtDate(r.finishedAt)}</td>
                      <td className="num">{c.classification === 'HYPOTHETICAL' ? '' : `${r.choices.filter((x) => x.historical).length}/${r.choices.length}`}</td>
                      <td>
                        <QualityBars value={Math.round(avg)} />
                      </td>
                      <td className="num">{metersFor(r).position}</td>
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
  const state = useStore((s) => s);
  const stats = learningStats(state);
  const topPrinciples = Object.entries(stats.principleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  return (
    <div className="stack gap-6">
      <PageHead eyebrow="Learning profile" title="How you decide." lead="Calculated only from the decisions you have made on this device. Each axis is a tendency in your choices, not a score: strong strategists move along them deliberately." />
      {stats.decisions === 0 ? (
        <div className="panel">
          <Empty icon={Play} title="No decisions yet" action={<Link to="/simulations" className="btn btn-primary">Start a simulation</Link>}>
            Your profile builds as you make decisions in cases.
          </Empty>
        </div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="meta-caps">Decisions made</span>
              <span className="kpi-value num">{stats.decisions}</span>
              <span className="meta">Your choices</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">Seasons completed</span>
              <span className="kpi-value num">{stats.casesCompleted}</span>
              <span className="meta">{stats.replays ? `${stats.replays} replay${stats.replays === 1 ? '' : 's'}` : 'No replays yet'}</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">Matched history</span>
              <span className="kpi-value num">{stats.alignment == null ? '' : `${stats.alignment}%`}</span>
              <span className="meta">{stats.alignmentN ? `${stats.alignmentMatched} of ${stats.alignmentN} documented decisions` : 'No documented decisions yet'}</span>
            </div>
            <div className="kpi">
              <span className="meta-caps">Avg. process quality</span>
              <span className="kpi-value num">{stats.avgQuality.toFixed(2)}</span>
              <span className="meta">of 3, over {stats.decisions} decisions</span>
            </div>
          </div>
          <section className="panel panel-pad stack gap-4" aria-labelledby="sure-h">
            <h2 id="sure-h" className="section-title">
              How sure are these numbers?
            </h2>
            <div className="stack gap-3">
              <RangeBar label="Matched history" lo={stats.alignmentCI?.[0]} hi={stats.alignmentCI?.[1]} value={stats.alignment == null ? null : stats.alignment / 100} fmt={(v) => `${Math.round(v * 100)}%`} n={stats.alignmentN} />
              <RangeBar label="Process quality" lo={stats.qualityCI ? (stats.qualityCI[0] - 1) / 2 : null} hi={stats.qualityCI ? (stats.qualityCI[1] - 1) / 2 : null} value={(stats.avgQuality - 1) / 2} fmt={(v) => (1 + v * 2).toFixed(1)} n={stats.decisions} />
            </div>
            <p className="meta">The shaded band is a 95% range: with few decisions it is wide, and the true tendency could be anywhere in it. It narrows as you play more.</p>
            <div className="quality-split" role="img" aria-label={`Process quality of your decisions: ${stats.qualityCounts[3]} strong, ${stats.qualityCounts[2]} sound, ${stats.qualityCounts[1]} weak`}>
              {[3, 2, 1].map((q) => (
                <span key={q} className={`qs qs-${q}`} style={{ flexGrow: stats.qualityCounts[q] || 0 }} title={`${stats.qualityCounts[q]} ${q === 3 ? 'strong' : q === 2 ? 'sound' : 'weak'}`} />
              ))}
            </div>
            <div className="row wrap gap-4 meta">
              <span>
                <i className="qs-key qs-3" /> Strong {stats.qualityCounts[3]}
              </span>
              <span>
                <i className="qs-key qs-2" /> Sound {stats.qualityCounts[2]}
              </span>
              <span>
                <i className="qs-key qs-1" /> Weak {stats.qualityCounts[1]}
              </span>
            </div>
          </section>
          <Callout>
            Process quality and matching history are measured separately. Quality judges each call on what was known at the time; matching history only says whether you chose what actually happened, and history was sometimes wrong (Kodak, the Medici in the 1470s).
          </Callout>
          <section className="panel panel-pad stack gap-2" aria-labelledby="src-kinds-h">
            <h2 id="src-kinds-h" className="section-title">
              Where each number comes from
            </h2>
            <ul className="stack gap-2 body" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
              <li>
                <strong>Your decisions:</strong> the options you chose, recorded on this device.
              </li>
              <li>
                <strong>Historical outcomes:</strong> what the cited sources record for each documented decision. {stats.liveDecisions > 0 && `${stats.liveDecisions} of your decisions were open, live decisions with no outcome yet, and are left out of “Matched history”.`}
              </li>
              <li>
                <strong>Derived metrics:</strong> process quality, the ten dimensions and the company-state meters are calculated by BIZSIM’s model from the options’ ratings.
              </li>
              <li>
                <strong>AI interpretations:</strong> {stats.aiSeasonDecisions ? `${stats.aiSeasonDecisions} of your decisions were in AI-written seasons, whose ratings and analysis were written by an AI model.` : 'none: all your decisions so far were in curated seasons.'}
              </li>
            </ul>
            <p className="meta">This profile describes patterns in the choices you made in BIZSIM simulations. It is not a personality or psychological assessment.</p>
          </section>
          <section className="panel panel-pad stack gap-5" aria-labelledby="dims-h">
            <h2 id="dims-h" className="section-title">
              Ten dimensions of strategic thinking
            </h2>
            <DimensionBars dims={state.profile.dims} />
            <p className="meta">Updated with an exponentially weighted average, so early decisions shape the profile quickly and later ones refine it.</p>
          </section>
          {topPrinciples.length > 0 && (
            <section className="panel panel-pad stack gap-4" aria-labelledby="pr-h">
              <h2 id="pr-h" className="section-title">
                Principles you have applied most
              </h2>
              <ul className="stack gap-3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {topPrinciples.map(([id, n]) => {
                  const p = PRINCIPLES.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <li key={id} className="row between gap-4">
                      <span>
                        <Link to={`/principles#${id}`} style={{ fontWeight: 500 }}>
                          {p.name}
                        </Link>
                        <div className="meta">{BOOK_BY_ID[p.book].title}</div>
                      </span>
                      <span className="num muted">{n}×</span>
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
  if (value == null || Number.isNaN(value)) return null;
  return (
    <div className="range-row">
      <div className="row between meta">
        <span>{label}</span>
        <span className="num">
          {fmt(value)}
          {lo != null && hi != null ? ` (likely ${fmt(lo)} to ${fmt(hi)}, n = ${n})` : ` (n = ${n}, too few to estimate a range)`}
        </span>
      </div>
      <div className="range-track" aria-hidden="true">
        {lo != null && hi != null && <span className="range-band" style={{ left: `${lo * 100}%`, width: `${Math.max(1, (hi - lo) * 100)}%` }} />}
        <span className="range-dot" style={{ left: `${value * 100}%` }} />
      </div>
    </div>
  );
}

// ---------- My cases ----------
export function MyCases() {
  const cases = useStore((s) => s.myCases);
  return (
    <div className="stack gap-6">
      <PageHead
        eyebrow="Workspace"
        title="My cases"
        lead="Seasons you built with live research or the chat builder, and seasons others shared with you. Stored on this device."
        action={
          <div className="row wrap gap-2">
            <Button icon={FileDown} onClick={openImport}>
              Import a season
            </Button>
            <Link to="/research" className="btn btn-primary">
              <Search aria-hidden="true" /> Research a company
            </Link>
          </div>
        }
      />
      {cases.length === 0 ? (
        <div className="panel">
          <Empty icon={FileText} title="No seasons of your own yet">
            Research a company with an AI key connected and choose “Play this season”, build one in the chat builder, or import a season someone shared with you. All 200 catalogue seasons are already built in.
          </Empty>
        </div>
      ) : (
        <div className="panel" style={{ padding: '0 var(--s5)' }}>
          {cases.map((c) => (
            <div key={c.id} className="row gap-3" style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <CaseRow c={c} />
              </div>
              <Button
                variant="ghost"
                icon={Trash2}
                aria-label={`Delete ${c.title}`}
                style={{ marginTop: 'var(--s4)' }}
                onClick={() => {
                  if (window.confirm(`Delete “${c.title}” and its runs from this device?`)) {
                    removeGeneratedCase(c.id);
                    toast('Case deleted');
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
  const list = useStore((s) => s.savedCompanies);
  return (
    <div className="stack gap-6">
      <PageHead eyebrow="Workspace" title="Saved companies" lead="Companies you are following. Re-run research at any time for the latest sources." />
      {list.length === 0 ? (
        <div className="panel">
          <Empty icon={Building2} title="No saved companies" action={<Link to="/research" className="btn">Research a company</Link>}>
            Save a company from its research results.
          </Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Saved</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div className="meta">{c.description}</div>
                  </td>
                  <td className="num meta">{relTime(c.savedAt)}</td>
                  <td>
                    <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                      <Link className="btn btn-sm" to={`/research?q=${encodeURIComponent(c.name)}&run=1`}>
                        <Search aria-hidden="true" /> Research
                      </Link>
                      <BookmarkButton item={{ type: 'company', id: c.id, label: c.name }} compact />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${c.name}`} onClick={() => removeCompany(c.id)} />
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
  const research = useStore((s) => s.researchHistory);
  const runs = useStore((s) => s.runs);
  useStore((s) => s.myCases);
  const events = [
    ...research.map((h) => ({ at: h.at, type: 'Research', label: h.name || h.query, sub: `${h.sourcesCount} sources${h.generated ? ' · case generated' : ''}`, to: `/research?q=${encodeURIComponent(h.query)}&run=1`, icon: Search })),
    ...runs.flatMap((r) => {
      const c = findCase(r.caseId);
      if (!c) return [];
      return r.choices.map((ch) => {
        const k = c.checkpoints.find((x) => x.id === ch.checkpointId);
        const o = k?.options.find((x) => x.id === ch.optionId);
        return { at: ch.at, type: 'Decision', label: `${c.company}: ${decisionLabel(c, ch.checkpointId) || k?.title}`, sub: o?.label, to: `/cases/${c.id}`, icon: Play };
      });
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <div className="stack gap-6">
      <PageHead eyebrow="Workspace" title="Analysis history" lead="Every research run and decision you have made on this device, newest first." />
      {events.length === 0 ? (
        <div className="panel">
          <Empty icon={Clock}>Nothing yet. Research a company or start a case.</Empty>
        </div>
      ) : (
        <ol className="panel" style={{ listStyle: 'none', margin: 0, padding: '0 var(--s5)' }}>
          {events.slice(0, 200).map((e, i) => (
            <li key={i} style={{ padding: 'var(--s4) 0', borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 0 }}>
              <Link to={e.to} className="row gap-4">
                <e.icon size={16} className="faint" aria-hidden="true" />
                <span className="grow">
                  <span className="row gap-2 wrap">
                    <Badge>{e.type}</Badge>
                    <span style={{ fontWeight: 500 }}>{e.label}</span>
                  </span>
                  <span className="meta">{e.sub}</span>
                </span>
                <span className="meta num" style={{ whiteSpace: 'nowrap' }}>
                  {relTime(e.at)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------- Settings ----------
function RestorePreview({ preview, onClose }) {
  const { report, exportedAt, kind } = preview;
  const [mode, setMode] = useState('merge');
  const apply = () => {
    if (mode === 'replace' && !window.confirm('Replace all progress, cases and collections on this device with the backup? This cannot be undone.')) return;
    applyImport(preview, mode);
    toast(mode === 'replace' ? 'Backup restored' : 'Backup merged into this device');
    onClose();
  };
  return (
    <Dialog title="Restore backup" onClose={onClose}>
      <p className="muted">
        {kind === 'transfer' ? 'Progress transfer' : 'Backup'}
        {exportedAt ? ` from ${new Date(exportedAt).toLocaleString()}` : ''}. Checked and cleaned before anything changes:
      </p>
      <ul className="stack gap-1 meta" style={{ margin: 0, paddingLeft: 'var(--s4)' }}>
        <li>{report.runs} simulation runs</li>
        <li>{report.cases} of your own seasons</li>
        <li>{report.companies} saved companies</li>
        <li>{report.collections} collections</li>
        {report.dropped > 0 && <li>{report.dropped} damaged or unsupported items will be skipped{report.droppedCases.length ? ` (including ${report.droppedCases.slice(0, 3).join(', ')})` : ''}</li>}
      </ul>
      <fieldset className="stack gap-2" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="meta" style={{ marginBottom: 'var(--s2)' }}>How to restore</legend>
        <label className="row gap-2">
          <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Merge: keep everything on this device and add what is new (recommended)
        </label>
        <label className="row gap-2">
          <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace: make this device match the backup
        </label>
      </fieldset>
      <div className="row gap-2 wrap">
        <Button variant="primary" onClick={apply}>
          {mode === 'merge' ? 'Merge backup' : 'Replace with backup'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}

export function SettingsPage() {
  const theme = useStore((s) => s.theme);
  const status = useStatus();
  const [server, setServer] = useState(apiBase());
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const download = async () => {
    try {
      const r = await saveFile(`bizsim-backup-${new Date().toISOString().slice(0, 10)}.json`, exportState());
      if (r === 'downloaded') toast('Backup downloaded');
    } catch (e) {
      toast(`Could not save the backup: ${e.message}`, 'error');
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
      <PageHead eyebrow="System" title="Settings" />
      <section className="panel panel-pad stack gap-4" aria-labelledby="ap-h">
        <h2 id="ap-h" className="section-title">
          Appearance
        </h2>
        <div className="row wrap gap-2" role="radiogroup" aria-label="Theme">
          {[
            [null, 'System'],
            ['dark', 'Dark'],
            ['light', 'Light'],
          ].map(([v, l]) => (
            <button key={l} className="chip" role="radio" aria-checked={theme === v} aria-pressed={theme === v} onClick={() => setTheme(v)}>
              {l}
            </button>
          ))}
        </div>
        <p className="meta">Motion follows your system’s reduced-motion setting.</p>
      </section>

      <KeysPanel />

      <section className="panel panel-pad stack gap-4" aria-labelledby="sv-h">
        <h2 id="sv-h" className="section-title">
          Server
        </h2>
        <div className="row gap-2 meta">
          <i className={`dot${status?.online ? '' : ' off'}`} aria-hidden="true" />
          {status == null ? 'Checking…' : status.online ? `Connected · BIZSIM ${status.version}` : `Not reachable, ${status.error}`}
        </div>
        {status?.online && (
          <ul className="stack gap-1 meta" style={{ margin: 0, paddingLeft: 'var(--s4)' }}>
            <li>AI live seasons: {status.ai?.enabled ? `${status.ai.provider} · ${status.ai.model}` : 'off'}</li>
            <li>Image generation: {status.images?.generation || 'off'} · Cover images: {status.images?.search || 'Wikipedia'}</li>
            <li>SEC EDGAR filings: {status.sec ? 'on' : 'off'}</li>
          </ul>
        )}
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            setApiBase(server);
            refreshStatus();
            toast(server ? 'Server address saved' : 'Using the built-in server');
          }}
        >
          <label htmlFor="srv">Server address</label>
          <div className="row gap-2 wrap">
            <input id="srv" className="input grow" placeholder="Same origin (default), e.g. https://bizsim.example.com" value={server} onChange={(e) => setServer(e.target.value)} inputMode="url" />
            <Button type="submit" icon={Server}>
              Save
            </Button>
          </div>
          <span className="hint">Only needed for mobile apps or when the interface and server run on different hosts.</span>
        </form>
      </section>

      {preview && <RestorePreview preview={preview} onClose={() => setPreview(null)} />}

      <StoragePanel />

      <PhonePanel status={status} />

      <TransferPanel />

      <VoicePanel />

      <section className="panel panel-pad stack gap-4" aria-labelledby="dt-h">
        <h2 id="dt-h" className="section-title">
          Your data
        </h2>
        <p className="muted">BIZSIM has no accounts. Progress, saved companies and generated cases live only on this device{storageIsPersistent() ? '' : ' (storage is unavailable, so data will be lost when you close the app)'}. Use QR transfer above, or a backup file.</p>
        <div className="row wrap gap-2">
          <Button icon={Download} onClick={download}>
            Download backup
          </Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>
            Restore backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() => {
              if (window.confirm('Erase all progress, saved companies and generated cases on this device?')) {
                resetState();
                toast('Local data reset');
              }
            }}
          >
            Reset all data
          </Button>
        </div>
      </section>
    </div>
  );
}

function VoicePanel() {
  const [voice, setV] = useState(currentVoice().id);
  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="vc-h">
      <h2 id="vc-h" className="section-title">
        Voice reader
      </h2>
      <p className="muted">
        Every case step has a <strong>Listen</strong> button. BIZSIM reads with Piper, a free open-source voice engine that runs on this device. All voices are male and free for any use. The chosen voice (about 60 MB) downloads once, then works offline.
      </p>
      <div className="stack gap-2" role="radiogroup" aria-label="Voice">
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
              <strong>{v.name}</strong> <span className="meta">{v.note}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <ListenButton key={voice} id={`preview-${voice}`} label="Preview voice" getText={() => 'Welcome to BIZSIM. Let us think like decision makers, weigh the evidence, and make the call.'} />
      </div>
    </section>
  );
}

// ---------- About & documentation ----------
export function About() {
  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <PageHead eyebrow="About" title="About BIZSIM" lead="An open-source platform for learning strategy by making real decisions, with evidence, sources and honest uncertainty." />
      <section className="stack gap-3">
        <h2 className="section-title">How cases work</h2>
        <p className="body">All 200 catalogue seasons are built in and play offline. Every season follows six steps: Situation, Concept, Evidence, Episodes, Outcome and Insight. Each episode holds two to four linked decisions and ends with its own outcome and insight; later episodes build on earlier ones. Pre-decision material is written so it does not reveal the answer. Historical outcomes cite their sources. Alternatives you did not see play out are clearly marked as counterfactual assessments.</p>
        <p className="body">Decisions are judged on process quality, how sound they were given what was known, not on hindsight. Matching history is reported separately, because history was sometimes wrong.</p>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Kinds of season</h2>
        <ul className="stack gap-2 body" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
          {Object.values(CONTENT_CLASSES).map((d) => (
            <li key={d.label}>
              <strong>{d.label}.</strong> {d.help}
            </li>
          ))}
        </ul>
        <p className="body">Seasons written by an AI model (live research and the chat builder) carry an <strong>AI-written</strong> label and name the model.</p>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Evidence labels</h2>
        <p className="body">{evidenceMethod}</p>
        <ul className="stack gap-2 body" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
          {['verified', 'available', 'inaccessible', 'insufficient'].map((k) => (
            <li key={k}>
              <strong>{EVIDENCE[k].label}.</strong> {EVIDENCE[k].help}
            </li>
          ))}
        </ul>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Provenance labels</h2>
        <div className="stack gap-3">
          <span className="provenance prov-verified">Structured data or official filings, as published, with a link</span>
          <span className="provenance prov-source">Source reference, encyclopedias, publishers, the company’s own site</span>
          <span className="provenance prov-ai">AI-generated analysis, interpretation by a language model, grounded in cited sources</span>
          <span className="provenance prov-hypo">Hypothetical scenario, possible futures, not facts</span>
        </div>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Data sources</h2>
        <ul className="stack gap-2 body" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
          <li>Wikidata (CC0) and Wikipedia (CC BY-SA) for company profiles</li>
          <li>U.S. SEC EDGAR for audited financials and filings</li>
          <li>Google News, Bing News or GDELT for recent headlines (links only)</li>
          <li>Wikipedia and Wikimedia Commons for each season's own lead image, free licences only (credited on use)</li>
          <li>Piper open-source voice engine with public-domain / CC0 male voices</li>
          <li>Optional: Gemini or OpenAI image generation, always labelled as AI</li>
        </ul>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Install on any device</h2>
        <p className="body">
          On iPhone or iPad: open BIZSIM in Safari, tap Share, then “Add to Home Screen”. On Android: open it in Chrome and choose “Install app”. On Windows, macOS and Linux: use the browser’s install button, or the desktop app built from the source. See <code>README.md</code> for desktop and native mobile builds.
        </p>
      </section>
      <section className="stack gap-3">
        <h2 className="section-title">Licence</h2>
        <p className="body">BIZSIM is released under the MIT licence. Book principles are short paraphrases for educational commentary; the books remain the property of their authors and publishers.</p>
      </section>
      <Callout icon={Sparkles}>No accounts, no tracking, no subscriptions. Your progress stays on your device.</Callout>
    </div>
  );
}
