import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, History, Lightbulb, RotateCcw, Sparkles, Target, AlertTriangle, Scale, Flag, Image as ImageIcon, BookOpen, Share2, FileDown } from 'lucide-react';
import { METHOD } from '@shared/dimensions.js';
import { CaseCover, ImageCredit, PrincipleCard, PrincipleList, SourceList, Footnote, Meter, DimensionBars, useOpenImage } from '../components/content.jsx';
import { Badge, Button, Callout, Empty, QualityBars, toast } from '../components/ui.jsx';
import { useStore, setCaseImage } from '../lib/store.js';
import { findCase, startRun, restartRun, recordDecision, finishRun, metersFor, progressLabel, runComplete, METERS, isOpen, attemptsFor, setReflection } from '../lib/sim.js';
import { downloadReport } from '../lib/report.js';
import { generateImage } from '../lib/api.js';
import { useStatus } from '../lib/useStatus.js';
import { difficultyLabel, domainLabel, eraLabel, signed } from '../lib/format.js';
import { ListenButton } from '../components/Listen.jsx';
import { situationText, conceptText, evidenceText, checkpointText, outcomeText, insightText, episodeOutcomeText } from '../lib/caseText.js';
import { episodesOf, episodeOutcome, seasonShape } from '@shared/episodes.js';
import { PILLARS } from '@shared/dimensions.js';
import { CaseTagEditor } from './Library.jsx';
import { TrustBadges } from '../components/trust.jsx';
import { ShareCaseDialog } from '../components/CaseShare.jsx';
import { BookmarkButton } from '../components/Collections.jsx';
import { TrustPanel, EvidenceTag } from '../components/evidence.jsx';
import { evidenceNoteOf, consequenceKind, CONSEQUENCE_LABEL, contentClassOf } from '@shared/contentClass.js';

// Options are shown in a fixed, per-episode shuffled order so the documented
// choice is not always in the same position. Option ids (and saved runs) are unchanged.
function displayOrder(options, seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const list = options.slice();
  for (let i = list.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
    const j = h % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

const isLive = (c, k) => Boolean(k?.live) || c.classification === 'HYPOTHETICAL';

const QUALITY_TEXT = {
  3: 'Strong process, well reasoned given what was known at the time.',
  2: 'Defensible, reasonable, with notable gaps or risks.',
  1: 'Weak process, the information available argued against it.',
};

function StepRail({ step, setStep, unlocked }) {
  return (
    <ol className="step-rail" aria-label="Case steps">
      {METHOD.map((m, i) => (
        <li key={m}>
          <button aria-current={step === i ? 'step' : undefined} disabled={i > unlocked} onClick={() => setStep(i)}>
            <span className={`step-num num${step === i ? ' active' : i < step || i < unlocked ? ' done' : ''}`}>{i < unlocked && step !== i ? <Check size={14} aria-hidden="true" /> : i + 1}</span>
            {m}
          </button>
        </li>
      ))}
    </ol>
  );
}

function CoverControls({ c }) {
  const status = useStatus();
  const chosen = useStore((s) => s.caseImages[c.id]);
  const open = useOpenImage(chosen ? null : c);
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    try {
      const img = await generateImage(`${c.title}: ${c.situation.headline} (${c.company}, ${c.yearLabel})`);
      setCaseImage(c.id, img);
      toast('Illustration generated');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="row between wrap gap-3">
      <ImageCredit img={chosen || open} />
      <div className="row gap-2">
        {chosen && (
          <Button size="sm" variant="ghost" icon={ImageIcon} onClick={() => setCaseImage(c.id, undefined)}>
            Use Wikipedia image
          </Button>
        )}
        {status?.images?.generation && (
          <Button size="sm" variant="ghost" icon={Sparkles} loading={busy} onClick={gen}>
            Generate illustration
          </Button>
        )}
      </div>
    </div>
  );
}

function CaseActions({ c }) {
  const [share, setShare] = useState(false);
  return (
    <>
      <BookmarkButton item={{ type: 'season', id: c.id, label: c.title }} />
      <Button size="sm" variant="ghost" icon={Share2} onClick={() => setShare(true)}>
        Share
      </Button>
      {share && <ShareCaseDialog c={c} onClose={() => setShare(false)} />}
    </>
  );
}

function Situation({ c }) {
  return (
    <article className="brief">
      <div className="brief-head stack gap-3">
        <CaseCover c={c} eager />
        <CoverControls c={c} />
      </div>
      <header className="stack gap-3">
        <div className="badges">
          <Badge>{eraLabel(c.era)}</Badge>
          <Badge>{c.pillar ? PILLARS[c.pillar]?.name : domainLabel(c.domain)}</Badge>
          <Badge>{difficultyLabel(c.difficulty)}</Badge>
          <TrustBadges c={c} />
        </div>
        <div className="meta-caps num">
          {c.company} · {c.yearLabel}
        </div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          {c.title}
        </h1>
        <p className="lead">{c.tagline}</p>
        <div className="row wrap gap-2">
          <ListenButton id={`${c.id}-situation`} getText={() => situationText(c)} label="Listen to the briefing" />
          <CaseActions c={c} />
        </div>
        {evidenceNoteOf(c) && <Callout tone="warning">{evidenceNoteOf(c)}</Callout>}
        <TrustPanel c={c} />
      </header>
      <section className="brief-section" aria-labelledby="sit-h">
        <h2 id="sit-h" className="eyebrow eyebrow-rule">
          01 · Situation
        </h2>
        <p className="meta-caps">{c.situation.role}</p>
        <h3 className="h2">{c.situation.headline}</h3>
        <div>
          {c.situation.context.map((p, i) => (
            <p key={i} className="body mt-3">
              {p}
            </p>
          ))}
        </div>
        <p className="stakes">{c.situation.stakes}</p>
      </section>
    </article>
  );
}

function Concept({ c }) {
  return (
    <article className="brief">
      <section className="brief-section" aria-labelledby="con-h">
        <h2 id="con-h" className="eyebrow eyebrow-rule">
          02 · Concept
        </h2>
        <h3 className="h1">{c.concept.framework}</h3>
        <div>
          <ListenButton id={`${c.id}-concept`} getText={() => conceptText(c)} />
        </div>
        <p className="body">{c.concept.explanation}</p>
      </section>
      {c.concept.principles?.length > 0 && (
        <section className="brief-section" aria-labelledby="con-p">
          <h3 id="con-p" className="section-title">
            Principles from the library
          </h3>
          <p className="meta">Ideas paraphrased from the books named. They frame the decision; they do not reveal the answer.</p>
          <div className="stack gap-4">
            {c.concept.principles.map((id) => (
              <PrincipleCard key={id} id={id} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}

function Evidence({ c }) {
  return (
    <article className="brief">
      <section className="brief-section" aria-labelledby="ev-h">
        <h2 id="ev-h" className="eyebrow eyebrow-rule">
          03 · Evidence
        </h2>
        <h3 className="h1">What was known at the time</h3>
        <div>
          <ListenButton id={`${c.id}-evidence`} getText={() => evidenceText(c)} />
        </div>
        <p className="meta">Each figure links to its source. The tag shows whether an automated check found its specific details in that source; it does not prove the history.</p>
        {c.evidence?.length ? (
          <div className="stat-grid">
            {c.evidence.map((e, i) => (
              <div className="stat" key={i}>
                <span className="meta-caps">{e.label}</span>
                <span className="stat-value num">
                  {e.value}
                  <Footnote sources={c.sources} id={e.sourceId} />
                </span>
                {e.note && <span className="stat-note">{e.note}</span>}
                <span>
                  <EvidenceTag c={c} claimKey={`ev${i}`} sourceIds={e.sourceId ? [e.sourceId] : []} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Callout>No numerical evidence is available for this case.</Callout>
        )}
      </section>
      <section className="brief-section" aria-labelledby="src-h">
        <h3 id="src-h" className="section-title">
          Sources
        </h3>
        <SourceList sources={c.sources} />
      </section>
    </article>
  );
}

function OptionCard({ o, selected, locked, onSelect, revealed, chosen, name, histLabel = 'What happened' }) {
  return (
    <label className="option" data-selected={selected || chosen ? 'true' : 'false'} data-locked={locked ? 'true' : 'false'}>
      <input type="radio" name={name} value={o.id} checked={Boolean(selected || chosen)} disabled={locked} onChange={() => onSelect(o.id)} />
      <span className="radio" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        {revealed && (
          <span className="option-tags">
            {o.historical && (
              <Badge tone="success" icon={History}>
                {histLabel}
              </Badge>
            )}
            {chosen && <Badge tone="accent">Your call</Badge>}
          </span>
        )}
        <span className="option-label" style={{ display: 'block', paddingRight: revealed ? 180 : 0 }}>
          {o.label}
        </span>
        <span className="option-summary" style={{ display: 'block' }}>
          {o.summary}
        </span>
        {isBrief(o.tradeoffs) && isBrief(o.risks) ? (
          // Short notes read better as one compact line than as two near-empty columns.
          <span className="option-brief">
            <span className="ob-key">Upside</span> {o.tradeoffs.replace(/\.$/, '')}
            <span className="ob-sep" aria-hidden="true" />
            <span className="ob-key">Risk</span> {o.risks.replace(/\.$/, '')}
          </span>
        ) : (
          <dl className="option-detail">
            <div>
              <dt>Trade-offs</dt>
              <dd>{o.tradeoffs}</dd>
            </div>
            <div>
              <dt>Risks</dt>
              <dd>{o.risks}</dd>
            </div>
          </dl>
        )}
      </span>
    </label>
  );
}

const isBrief = (t) => !t || t.trim().split(/\s+/).length <= 4;

function Reveal({ c, k, choice }) {
  const opt = k.options.find((o) => o.id === choice.optionId);
  const hist = k.options.find((o) => o.historical);
  const hypothetical = isLive(c, k);
  return (
    <section className="reveal glass" aria-live="polite" aria-labelledby={`rv-${k.id}`}>
      <div className="row between wrap gap-3">
        <h3 id={`rv-${k.id}`} className="section-title">
          {hypothetical ? 'Analysis of your decision' : 'Your decision against history'}
        </h3>
        <span className="row gap-2">
          {!hypothetical && (choice.historical ? <Badge tone="success" icon={CheckCircle2}>You matched history</Badge> : <Badge>History chose differently</Badge>)}
          <BookmarkButton item={{ type: 'decision', id: `${c.id}:${k.id}`, caseId: c.id, label: k.prompt }} compact />
        </span>
      </div>

      {hypothetical ? (
        <Callout tone="ai" icon={Sparkles}>
          This decision is happening now; its outcome is not yet known. The assessment below is <strong>AI-generated analysis</strong> based on the cited sources, not a verified result.
        </Callout>
      ) : (
        !choice.historical &&
        hist && (
          <p className="meta-caps">
            {contentClassOf(c) === 'scriptural' ? 'Choice in the narrative' : 'Historical choice'}: <span style={{ color: 'var(--text)' }}>{hist.label}</span>
          </p>
        )
      )}

      <div className="stack gap-3">
        <div className="row between wrap gap-3">
          <span className="meta-caps">Your decision: {opt.label}</span>
          <span className="row gap-2 meta">
            Process quality <QualityBars value={opt.quality} />
          </span>
        </div>
        <p className="muted">{QUALITY_TEXT[opt.quality]}</p>
        <p className="body">
          <strong>{CONSEQUENCE_LABEL[consequenceKind(c, k, opt)]}. </strong>
          {opt.consequence}
        </p>
      </div>

      <div className="reveal-grid">
        {METERS.map((m) => (
          <div className="delta" key={m.id}>
            <span className="meta-caps">{m.label}</span>
            <span className={`delta-value num ${opt.impact[m.id] > 0 ? 'pos' : opt.impact[m.id] < 0 ? 'neg' : ''}`}>{signed(opt.impact[m.id])}</span>
          </div>
        ))}
      </div>
      <p className="meta">
        Impact scores come from BIZSIM’s analytical model. {hypothetical ? 'They are AI estimates.' : 'For the historical option they reflect the documented outcome; for alternatives they are counterfactual assessments.'} Quality is judged on the decision process, not the result, good decisions can still end badly.
      </p>

      {opt.principles?.length > 0 && (
        <div className="stack gap-2">
          <span className="meta-caps">Principles at work</span>
          <PrincipleList ids={opt.principles} />
        </div>
      )}
    </section>
  );
}

function EpisodeOutcome({ c, ep, run }) {
  const out = episodeOutcome(ep);
  const live = ep.live || c.classification === 'HYPOTHETICAL';
  const hist = ep.decisions.filter((k) => !k.live);
  const matched = run.choices.filter((ch) => ch.historical && hist.some((k) => k.id === ch.checkpointId)).length;
  return (
    <section className="reveal glass episode-outcome" aria-labelledby={`eo-${ep.n}`}>
      <div className="row between wrap gap-3">
        <h3 id={`eo-${ep.n}`} className="section-title">
          Episode {ep.roman} outcome
        </h3>
        <BookmarkButton item={{ type: 'episode', id: `${c.id}:${ep.n}`, caseId: c.id, label: `${c.title}, Episode ${ep.roman}` }} compact />
        {hist.length > 0 && (
          <Badge tone={matched === hist.length ? 'success' : undefined} icon={History}>
            Matched history {matched}/{hist.length}
          </Badge>
        )}
      </div>
      <div>
        <ListenButton id={`${c.id}-ep${ep.n}-outcome`} getText={() => episodeOutcomeText(c, ep, out)} label="Listen to the outcome" />
      </div>
      {live && (
        <Callout tone="ai" icon={Sparkles}>
          {out.parts.length ? 'Part of this episode is still unfolding. Where no result exists yet, the text is AI-generated analysis, not a verified fact.' : 'This episode is still unfolding, so there is no documented outcome yet.'}
        </Callout>
      )}
      {out.parts.length > 0 && (
        <div className="stack gap-3">
          <span className="meta-caps">{live ? 'What happened so far' : 'What actually happened'}</span>
          {out.parts.map((p) => (
            <div key={p.id} className="stack gap-1">
              <p className="body">
                {p.text}
                {p.sourceIds.map((id) => (
                  <Footnote key={id} sources={c.sources} id={id} />
                ))}
              </p>
              <span>
                <EvidenceTag c={c} claimKey={p.id} sourceIds={p.sourceIds} />
              </span>
            </div>
          ))}
        </div>
      )}
      {ep.insight?.text && (
        <div className="episode-insight stack gap-3">
          <span className="meta-caps">
            <Lightbulb size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 6, color: 'var(--accent-text)' }} aria-hidden="true" />
            Episode insight
          </span>
          <p className="h3" style={{ fontWeight: 500 }}>
            {ep.insight.text}
          </p>
          {ep.insight.principles?.length > 0 && <PrincipleList ids={ep.insight.principles} />}
        </div>
      )}
    </section>
  );
}

function Decisions({ c, run, onComplete }) {
  const eps = useMemo(() => episodesOf(c), [c]);
  const flat = useMemo(() => eps.flatMap((e) => e.decisions), [eps]);
  const isMade = (id) => run.choices.some((ch) => ch.checkpointId === id);
  const nextIdx = flat.findIndex((k) => !isMade(k.id));
  const [viewIdx, setViewIdx] = useState(nextIdx === -1 ? flat.length - 1 : nextIdx);
  const [selected, setSelected] = useState(null);
  const top = useRef(null);
  const k = flat[Math.min(viewIdx, flat.length - 1)];
  const ep = eps.find((e) => e.decisions.includes(k));
  const di = ep.decisions.indexOf(k);
  const choice = run.choices.find((ch) => ch.checkpointId === k.id);
  const epDone = ep.decisions.every((x) => isMade(x.id));
  const lastInEp = di === ep.decisions.length - 1;
  const lastEp = ep === eps[eps.length - 1];
  const multi = ep.decisions.length > 1;

  useEffect(() => setSelected(null), [viewIdx]);
  const goTo = (i) => {
    setViewIdx(i);
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const submit = () => {
    const o = k.options.find((x) => x.id === selected);
    if (!o) return;
    recordDecision(run.id, k, o);
  };
  const allDone = nextIdx === -1;

  return (
    <article className="brief" ref={top} style={{ scrollMarginTop: 'var(--decision-scroll-margin, 200px)' }}>
      <section className="brief-section">
        <div className="row between wrap gap-3">
          <h2 className="eyebrow eyebrow-rule">04 · Episodes</h2>
          <span className="meta num">
            Episode {ep.roman} of {eps[eps.length - 1].roman}
            {multi ? ` · Decision ${di + 1} of ${ep.decisions.length}` : ''}
          </span>
        </div>
        <div className="row gap-2 wrap" role="group" aria-label="Episodes">
          {eps.map((e) => {
            const done = e.decisions.every((x) => isMade(x.id));
            const started = e.decisions.some((x) => isMade(x.id));
            const reachable = started || e.decisions.some((x) => flat.indexOf(x) === nextIdx);
            const firstOpen = e.decisions.find((x) => !isMade(x.id)) || e.decisions[0];
            return (
              <button key={e.n} className="chip num" aria-pressed={e === ep} disabled={!reachable} onClick={() => goTo(flat.indexOf(firstOpen))} style={!reachable ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
                {done && <Check size={13} style={{ marginRight: 4 }} aria-hidden="true" />}
                Ep {e.roman}
                {e.live ? ' · now' : ''}
              </button>
            );
          })}
        </div>
        {multi && (
          <ol className="decision-steps" aria-label={`Decisions in episode ${ep.roman}`}>
            {ep.decisions.map((x, j) => {
              const made = isMade(x.id);
              const reachable = made || flat.indexOf(x) === nextIdx;
              return (
                <li key={x.id}>
                  <button className="decision-step num" aria-current={x === k ? 'step' : undefined} data-done={made ? 'true' : 'false'} disabled={!reachable} onClick={() => goTo(flat.indexOf(x))}>
                    {made ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">{j + 1}</span>}
                    Decision {j + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <div className="checkpoint-head mt-3">
          <span className="meta-caps num">
            Episode {ep.roman} · {k.dateLabel}
            {multi ? ` · Decision ${di + 1} of ${ep.decisions.length}` : ''}
            {k.live ? ' · happening now' : ''}
          </span>
          <h3 className="h1">{ep.title}</h3>
          <p className="body">{k.context}</p>
          <p className="stakes" style={{ fontWeight: 500 }}>
            {k.prompt}
          </p>
          <div>
            <ListenButton id={`${c.id}-${k.id}-${choice ? 'after' : 'before'}`} getText={() => checkpointText(c, k, choice, ep.n - 1, ep)} label={choice ? 'Listen to the result' : 'Listen to the decision'} />
          </div>
        </div>
      </section>

      <fieldset className="options" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">{k.prompt}</legend>
        {displayOrder(k.options, `${c.id}:${k.id}`).map((o) => (
          <OptionCard key={o.id} o={o} histLabel={contentClassOf(c) === 'scriptural' ? 'In the narrative' : 'What happened'} name={`cp-${k.id}`} selected={!choice && selected === o.id} chosen={choice?.optionId === o.id} locked={Boolean(choice)} revealed={Boolean(choice)} onSelect={setSelected} />
        ))}
      </fieldset>

      {!choice ? (
        <div className="row between wrap gap-3">
          <span className="meta">Choose one option. Your decision is final for this season.</span>
          <Button variant="primary" size="lg" disabled={!selected} onClick={submit} iconRight={ArrowRight}>
            Submit decision
          </Button>
        </div>
      ) : (
        <>
          <Reveal c={c} k={k} choice={choice} />
          {lastInEp && epDone && <EpisodeOutcome c={c} ep={ep} run={run} />}
          <div className="row between wrap gap-3">
            <span />
            {!lastInEp ? (
              <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => goTo(viewIdx + 1)}>
                Next decision
              </Button>
            ) : !lastEp ? (
              epDone && (
                <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => goTo(viewIdx + 1)}>
                  Episode {eps[eps.indexOf(ep) + 1].roman}
                </Button>
              )
            ) : (
              allDone && (
                <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={onComplete}>
                  See the season outcome
                </Button>
              )
            )}
          </div>
        </>
      )}
    </article>
  );
}

function Outcome({ c, run }) {
  const hypothetical = c.classification === 'HYPOTHETICAL';
  const hasLive = c.checkpoints.some((k) => k.live);
  return (
    <article className="brief">
      <section className="brief-section">
        <h2 className="eyebrow eyebrow-rule">05 · Outcome</h2>
        <h3 className="h1">{hypothetical ? 'Where this could go' : 'How it played out'}</h3>
        <div>
          <ListenButton id={`${c.id}-outcome`} getText={() => outcomeText(c)} />
        </div>
        {(hypothetical || hasLive) && (
          <Callout tone="ai" icon={Sparkles}>
            {hasLive ? 'The final episode is still unfolding. This outlook is AI-generated analysis, a structured hypothesis, not a fact.' : 'AI-generated analysis of an unresolved situation. Treat it as a structured hypothesis, not a fact.'}
          </Callout>
        )}
        <p className="body">{c.outcome.summary}</p>
      </section>
      {c.outcome.secondOrder?.length > 0 && (
        <section className="brief-section">
          <h3 className="section-title">Second-order effects</h3>
          <ul className="stack gap-3" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
            {c.outcome.secondOrder.map((s, i) => (
              <li key={i} className="body">
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}
      {c.scenarios?.length > 0 && (
        <section className="brief-section">
          <h3 className="section-title">
            <span className="provenance prov-hypo">Hypothetical scenarios</span>
          </h3>
          <div className="stack gap-4">
            {c.scenarios.map((s, i) => (
              <div key={i} className="principle">
                <div className="principle-name">{s.name}</div>
                <p className="muted">{s.description}</p>
                {s.signals?.length > 0 && <p className="meta">Signals to watch: {s.signals.join(' · ')}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="brief-section">
        <h3 className="section-title">Base rate &amp; counterfactual</h3>
        <Callout icon={Scale}>{c.outcome.baseRate}</Callout>
      </section>
      <section className="brief-section">
        <h3 className="section-title">Your season</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Decision</th>
                <th scope="col">Your call</th>
                {!hypothetical && <th scope="col">History</th>}
                <th scope="col">Quality</th>
              </tr>
            </thead>
            <tbody>
              {episodesOf(c).flatMap((ep) => ep.decisions.map((k, j) => {
                const ch = run.choices.find((x) => x.checkpointId === k.id);
                const o = k.options.find((x) => x.id === ch?.optionId);
                const h = k.options.find((x) => x.historical);
                return (
                  <tr key={k.id}>
                    <td>
                      <div className="meta num">
                        Ep {ep.roman}{ep.decisions.length > 1 ? ` · Decision ${j + 1}` : ''} · {k.dateLabel}
                      </div>
                      {j === 0 || ep.decisions.length === 1 ? ep.title : <span className="muted">{k.prompt.length > 90 ? `${k.prompt.slice(0, 88)}…` : k.prompt}</span>}
                    </td>
                    <td>{o?.label || ''}</td>
                    {!hypothetical && <td>{k.live ? <span className="faint">Still open</span> : ch?.historical ? <span className="pos">Matched</span> : h?.label}</td>}
                    <td>{o && <QualityBars value={o.quality} />}</td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </section>
      <CompareAttempts c={c} />
    </article>
  );
}

/** Side-by-side view of every attempt at this season, with history. */
function CompareAttempts({ c }) {
  const state = useStore((s) => s);
  const attempts = attemptsFor(state, c.id);
  if (attempts.length < 2) return null;
  const shown = attempts.slice(-4);
  const eps = episodesOf(c);
  const anyHist = c.checkpoints.some((k) => k.outcome?.text && !k.live);
  return (
    <section className="brief-section" aria-labelledby="cmp-h">
      <h3 id="cmp-h" className="section-title">
        Compare your attempts
      </h3>
      <p className="meta">Each earlier attempt is kept. Where your path differs from history, its consequences are counterfactual estimates, not records.</p>
      <div className="table-wrap">
        <table className="table compare-table">
          <caption className="sr-only">Your choices in each attempt at {c.title}</caption>
          <thead>
            <tr>
              <th scope="col">Decision</th>
              {shown.map((r, i) => (
                <th scope="col" key={r.id}>
                  Attempt {attempts.length - shown.length + i + 1}
                  <div className="meta">{new Date(r.startedAt).toLocaleDateString()}</div>
                </th>
              ))}
              {anyHist && <th scope="col">{contentClassOf(c) === 'scriptural' ? 'Narrative' : 'History'}</th>}
            </tr>
          </thead>
          <tbody>
            {eps.flatMap((ep) =>
              ep.decisions.map((k, j) => {
                const h = k.options.find((o) => o.historical);
                return (
                  <tr key={k.id}>
                    <th scope="row">
                      <div className="meta num">
                        Ep {ep.roman}
                        {ep.decisions.length > 1 ? ` · ${j + 1}` : ''}
                      </div>
                      <span className="muted">{k.prompt.length > 70 ? `${k.prompt.slice(0, 68)}…` : k.prompt}</span>
                    </th>
                    {shown.map((r) => {
                      const ch = r.choices.find((x) => x.checkpointId === k.id);
                      const o = ch && k.options.find((x) => x.id === ch.optionId);
                      return (
                        <td key={r.id}>
                          {o ? (
                            <>
                              {o.label}
                              <div className="meta">{k.live || !k.outcome ? 'Open decision' : ch.historical ? 'Matched history' : 'Counterfactual path'} · quality {o.quality}/3</div>
                            </>
                          ) : (
                            <span className="faint">Not decided</span>
                          )}
                        </td>
                      );
                    })}
                    {anyHist && <td>{k.live || !k.outcome ? <span className="faint">Still open</span> : h?.label}</td>}
                  </tr>
                );
              }),
            )}
            <tr>
              <th scope="row">Average process quality</th>
              {shown.map((r) => (
                <td key={r.id} className="num">
                  {r.choices.length ? `${(r.choices.reduce((a, x) => a + (x.quality || 0), 0) / r.choices.length).toFixed(1)}/3` : ''}
                </td>
              ))}
              {anyHist && <td />}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Reflection({ run }) {
  const [text, setText] = useState(run.reflection || '');
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (saved) return undefined;
    const t = setTimeout(() => {
      setReflection(run.id, text);
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [text, saved, run.id]);
  return (
    <section className="brief-section">
      <h3 className="section-title">
        <label htmlFor={`refl-${run.id}`}>Your reflection</label>
      </h3>
      <p className="meta">Optional. What would you do differently? Saved on this device and included in your report.</p>
      <textarea
        id={`refl-${run.id}`}
        className="input"
        rows={4}
        maxLength={2000}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      <span className="meta" aria-live="polite">
        {saved ? (text ? 'Saved' : '') : 'Saving…'}
      </span>
    </section>
  );
}

function ReportButton({ c, run }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="lg"
      icon={FileDown}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await downloadReport(c, run);
          if (r === 'downloaded') toast('Report saved');
        } catch (e) {
          toast(`Could not create the report: ${e.message}`, 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      Download report (PDF)
    </Button>
  );
}

function Insight({ c, run }) {
  const profile = useStore((s) => s.profile);
  const avg = run.choices.reduce((a, ch) => a + ch.quality, 0) / (run.choices.length || 1);
  const histEpisodes = c.checkpoints.filter((k) => !k.live).map((k) => k.id);
  const matched = run.choices.filter((ch) => ch.historical).length;
  const hypothetical = c.classification === 'HYPOTHETICAL' || histEpisodes.length === 0;
  return (
    <article className="brief">
      <section className="brief-section">
        <h2 className="eyebrow eyebrow-rule">06 · Insight</h2>
        <h3 className="h1">What to take from this case</h3>
        <div>
          <ListenButton id={`${c.id}-insight`} getText={() => insightText(c)} label="Listen to the lessons" />
        </div>
        <div className="kpis" style={{ gridTemplateColumns: hypothetical ? 'repeat(2, minmax(0,1fr))' : undefined }}>
          <div className="kpi">
            <span className="meta-caps">Decisions made</span>
            <span className="kpi-value num">{run.choices.length}</span>
          </div>
          {!hypothetical && (
            <div className="kpi">
              <span className="meta-caps">Matched history</span>
              <span className="kpi-value num">
                {matched}/{run.choices.filter((ch) => histEpisodes.includes(ch.checkpointId)).length}
              </span>
            </div>
          )}
          <div className="kpi">
            <span className="meta-caps">Avg. process quality</span>
            <span className="kpi-value num">{avg.toFixed(1)}/3</span>
          </div>
          {!hypothetical && (
            <div className="kpi">
              <span className="meta-caps">Final position</span>
              <span className="kpi-value num">{metersFor(run).position}</span>
            </div>
          )}
        </div>
      </section>
      {episodesOf(c).some((e) => e.insight?.text) && (
        <section className="brief-section">
          <h3 className="section-title">Episode insights</h3>
          <ol className="stack gap-4" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
            {episodesOf(c)
              .filter((e) => e.insight?.text)
              .map((e) => (
                <li key={e.n} className="stack gap-2">
                  <span className="meta-caps num">
                    Episode {e.roman} · {e.title}
                  </span>
                  <p className="body">{e.insight.text}</p>
                </li>
              ))}
          </ol>
        </section>
      )}
      <section className="brief-section">
        <h3 className="section-title">Season lessons</h3>
        <div className="stack gap-5">
          {c.outcome.lessons.map((l, i) => (
            <div key={i} className="stack gap-3">
              <p className="h3" style={{ fontWeight: 500 }}>
                <Lightbulb size={18} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 8, color: 'var(--accent-text)' }} aria-hidden="true" />
                {l.text}
              </p>
              <PrincipleList ids={l.principles} />
            </div>
          ))}
        </div>
      </section>
      {c.reading && (
        <section className="brief-section">
          <h3 className="section-title">Go deeper</h3>
          <p className="body">
            <BookOpen size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 8 }} aria-hidden="true" />
            {c.reading}
          </p>
        </section>
      )}
      <section className="brief-section">
        <div className="row between wrap gap-3">
          <h3 className="section-title">Your decision profile</h3>
          <Link to="/learning" className="link">
            Full profile <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <p className="meta">Updated after every decision across all cases. Each axis runs from one strategic tendency to its opposite; neither end is “right”.</p>
        <DimensionBars dims={profile.dims} />
      </section>
      <Reflection key={run.id} run={run} />
      <div className="row wrap gap-3">
        <Link to="/cases" className="btn btn-primary btn-lg">
          Next case <ArrowRight aria-hidden="true" />
        </Link>
        <ReportButton c={c} run={run} />
        <Button size="lg" icon={RotateCcw} onClick={() => restartRun(c.id)}>
          Try a different path
        </Button>
      </div>
      <p className="meta">Replaying keeps this attempt, so you can compare paths in the Outcome step.</p>
    </article>
  );
}

function Aside({ c, run }) {
  const m = metersFor(run);
  const last = run?.choices.at(-1);
  return (
    <aside className="aside" aria-label="Case context">
      <section className="panel panel-pad stack gap-4">
        <div className="row between">
          <h2 className="section-title">Company state</h2>
          <span className="meta num">{run ? progressLabel(c, run) : 'Not started'}</span>
        </div>
        {METERS.map((x) => (
          <Meter key={x.id} label={x.label} value={m[x.id]} delta={last?.impact?.[x.id]} />
        ))}
        <p className="meta">Starts at 50. Moves with each decision according to BIZSIM’s analytical model.</p>
      </section>
      <section className="panel panel-pad stack gap-3">
        <div className="row gap-3 meta">
          <Clock size={14} aria-hidden="true" /> <span className="num">{c.minutes} min</span>
          <Target size={14} aria-hidden="true" /> <span className="num">{seasonShape(c)}</span>
        </div>
        <h2 className="section-title">Sources</h2>
        <SourceList sources={c.sources.slice(0, 6)} />
        {c.sources.length > 6 && <p className="meta num">+{c.sources.length - 6} more in Evidence</p>}
      </section>
      <CaseTagEditor c={c} />
    </aside>
  );
}

export default function CasePlayer() {
  const { id } = useParams();
  useStore((s) => s.myCases); // re-render when generated cases change
  const runs = useStore((s) => s.runs);
  const c = findCase(id);
  const run = useMemo(() => runs.find((r) => r.caseId === id && isOpen(r)) || runs.find((r) => r.caseId === id && !r.abandonedAt) || runs.find((r) => r.caseId === id) || null, [runs, id]);
  const complete = runComplete(c, run);
  const unlocked = complete ? 5 : 3;
  const [step, setStep] = useState(() => (run && !run.finishedAt && run.choices.length ? 3 : 0));

  useEffect(() => {
    if (c) document.title = `${c.title} · BIZSIM`;
  }, [c]);
  useEffect(() => {
    if (complete && step === 5 && run && !run.finishedAt) finishRun(run.id);
  }, [complete, step, run]);
  // When a replay starts, return to the first decision.
  useEffect(() => {
    if (run && !run.finishedAt && run.choices.length === 0 && step > 3) setStep(3);
  }, [run, step]);

  if (!c) {
    return (
      <Empty icon={AlertTriangle} title="Case not found" action={<Link to="/cases" className="btn">Back to cases</Link>}>
        This case may have been removed from this device.
      </Empty>
    );
  }

  const go = (n) => {
    if (n === 3 && !run) startRun(c.id);
    setStep(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="player">
      <StepRail step={step} setStep={go} unlocked={unlocked} />
      <div className="stack gap-6" style={{ minWidth: 0 }}>
        {step === 0 && <Situation c={c} />}
        {step === 1 && <Concept c={c} />}
        {step === 2 && <Evidence c={c} />}
        {step === 3 && run && <Decisions key={run.id} c={c} run={run} onComplete={() => go(4)} />}
        {step === 4 && complete && <Outcome c={c} run={run} />}
        {step === 5 && complete && <Insight c={c} run={run} />}

        {step < 3 && (
          <nav className="row between gap-3" aria-label="Step navigation">
            {step > 0 ? (
              <Button icon={ArrowLeft} onClick={() => go(step - 1)}>
                {METHOD[step - 1]}
              </Button>
            ) : (
              <Link to="/cases" className="btn btn-ghost">
                <ArrowLeft aria-hidden="true" /> All cases
              </Link>
            )}
            <Button variant="primary" size="lg" iconRight={step === 2 ? Flag : ArrowRight} onClick={() => go(step + 1)}>
              {step === 2 ? (run && !run.finishedAt && run.choices.length ? 'Resume the season' : complete ? 'Review episodes' : 'Start Episode I') : METHOD[step + 1]}
            </Button>
          </nav>
        )}
        {step === 4 && (
          <nav className="row between gap-3">
            <Button icon={ArrowLeft} onClick={() => go(3)}>
              Episodes
            </Button>
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => go(5)}>
              Insight
            </Button>
          </nav>
        )}
      </div>
      <Aside c={c} run={run} />
    </div>
  );
}
