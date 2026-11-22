import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, History, Lightbulb, RotateCcw, Sparkles, Target, AlertTriangle, Scale, Flag, Image as ImageIcon, BookOpen, Share2, FileDown } from 'lucide-react';
import { CaseCover, ImageCredit, PrincipleCard, PrincipleList, SourceList, Footnote, Meter, DimensionBars, useOpenImage, METHOD_KEYS, methodLabel } from '../components/content.jsx';
import { useTranslation, Trans, useLocale } from '../i18n/index.js';
import { formatInteger, formatDecimal, formatDate } from '../i18n/format.js';
import { useLocalizedCase, contentLangOf } from '../lib/caseLocale.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import { Badge, Button, Callout, Empty, QualityBars, toast } from '../components/ui.jsx';
import { useStore, setCaseImage } from '../lib/store.js';
import { findCase, startRun, restartRun, recordDecision, finishRun, metersFor, progressLabel, runComplete, METERS, meterLabel, isOpen, attemptsFor, setReflection, seasonShapeLabel } from '../lib/sim.js';
import { downloadReport, reportFormat } from '../lib/report.js';
import { generateImage } from '../lib/api.js';
import { useStatus } from '../lib/useStatus.js';
import { difficultyLabel, domainLabel, eraLabel, signed, pillarName } from '../lib/format.js';
import { ListenButton } from '../components/Listen.jsx';
import { situationText, conceptText, evidenceText, checkpointText, outcomeText, insightText, episodeOutcomeText } from '../lib/caseText.js';
import { episodesOf, episodeOutcome } from '@shared/episodes.js';
import { CaseTagEditor } from './Library.jsx';
import { TrustBadges, evidenceNoteOf } from '../components/trust.jsx';
import { ShareCaseDialog } from '../components/CaseShare.jsx';
import { BookmarkButton } from '../components/Collections.jsx';
import { TrustPanel, EvidenceTag } from '../components/evidence.jsx';
import { consequenceKind, contentClassOf } from '@shared/contentClass.js';
import { languageName } from '../i18n/format.js';

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

function StepRail({ step, setStep, unlocked }) {
  const { t } = useTranslation();
  return (
    <ol className="step-rail" aria-label={t('case.steps')}>
      {METHOD_KEYS.map((m, i) => (
        <li key={m}>
          <button aria-current={step === i ? 'step' : undefined} disabled={i > unlocked} onClick={() => setStep(i)}>
            <span className={`step-num num${step === i ? ' active' : i < step || i < unlocked ? ' done' : ''}`}>{i < unlocked && step !== i ? <Check size={14} aria-hidden="true" /> : formatInteger(i + 1)}</span>
            {t(`method.steps.${m}`)}
          </button>
        </li>
      ))}
    </ol>
  );
}

function CoverControls({ c }) {
  const { t } = useTranslation();
  const status = useStatus();
  const chosen = useStore((s) => s.caseImages[c.id]);
  const open = useOpenImage(chosen ? null : c);
  const [busy, setBusy] = useState(false);
  const gen = async () => {
    setBusy(true);
    try {
      const img = await generateImage(`${c.title}: ${c.situation.headline} (${c.company}, ${c.yearLabel})`);
      setCaseImage(c.id, img);
      toast(t('case.cover.generated'));
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
            {t('case.cover.useWikipedia')}
          </Button>
        )}
        {status?.images?.generation && (
          <Button size="sm" variant="ghost" icon={Sparkles} loading={busy} onClick={gen}>
            {t('case.cover.generate')}
          </Button>
        )}
      </div>
    </div>
  );
}

function CaseActions({ c }) {
  const { t } = useTranslation();
  const [share, setShare] = useState(false);
  return (
    <>
      <BookmarkButton item={{ type: 'season', id: c.id, label: c.title }} />
      <Button size="sm" variant="ghost" icon={Share2} onClick={() => setShare(true)}>
        {t('case.share')}
      </Button>
      {share && <ShareCaseDialog c={c} onClose={() => setShare(false)} />}
    </>
  );
}

/** Says which language the season text is in when it differs from the interface. */
function ContentLanguageNote({ c }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const ui = LOCALE_BY_CODE[locale];
  const content = c.contentLocale || 'en';
  if (c.contentTranslation) {
    return (
      <p className="meta">
        {t('case.contentLang.translated', { language: languageName(content) })}
        {c.contentTranslation.stale ? ` ${t('case.contentLang.stale')}` : ''}
      </p>
    );
  }
  if (ui?.language === 'en' || LOCALE_BY_CODE[content]?.language === ui?.language) return null;
  return <p className="meta">{t('case.contentLang.english')}</p>;
}

function Situation({ c }) {
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  return (
    <article className="brief">
      <div className="brief-head stack gap-3">
        <CaseCover c={c} eager />
        <CoverControls c={c} />
      </div>
      <header className="stack gap-3">
        <div className="badges">
          <Badge>{eraLabel(c.era)}</Badge>
          <Badge>{c.pillar ? pillarName(c.pillar) : domainLabel(c.domain)}</Badge>
          <Badge>{difficultyLabel(c.difficulty)}</Badge>
          <TrustBadges c={c} />
        </div>
        <div className="meta-caps num">
          {c.company} · {c.yearLabel}
        </div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }} lang={cl} dir="auto">
          {c.title}
        </h1>
        <p className="lead" lang={cl} dir="auto">
          {c.tagline}
        </p>
        <div className="row wrap gap-2">
          <ListenButton lang={contentLangOf(c)} id={`${c.id}-situation`} getText={() => situationText(c)} label={t('case.listenBriefing')} />
          <CaseActions c={c} />
        </div>
        <ContentLanguageNote c={c} />
        {evidenceNoteOf(c) && <Callout tone="warning">{evidenceNoteOf(c)}</Callout>}
        <TrustPanel c={c} />
      </header>
      <section className="brief-section" aria-labelledby="sit-h">
        <h2 id="sit-h" className="eyebrow eyebrow-rule">
          {t('case.sectionNo', { n: '01', title: methodLabel(0) })}
        </h2>
        <p className="meta-caps" lang={cl} dir="auto">
          {c.situation.role}
        </p>
        <h3 className="h2" lang={cl} dir="auto">
          {c.situation.headline}
        </h3>
        <div lang={cl} dir="auto">
          {c.situation.context.map((p, i) => (
            <p key={i} className="body mt-3">
              {p}
            </p>
          ))}
        </div>
        <p className="stakes" lang={cl} dir="auto">
          {c.situation.stakes}
        </p>
      </section>
    </article>
  );
}

function Concept({ c }) {
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  return (
    <article className="brief">
      <section className="brief-section" aria-labelledby="con-h">
        <h2 id="con-h" className="eyebrow eyebrow-rule">
          {t('case.sectionNo', { n: '02', title: methodLabel(1) })}
        </h2>
        <h3 className="h1" lang={cl} dir="auto">
          {c.concept.framework}
        </h3>
        <div>
          <ListenButton lang={contentLangOf(c)} id={`${c.id}-concept`} getText={() => conceptText(c)} />
        </div>
        <p className="body" lang={cl} dir="auto">
          {c.concept.explanation}
        </p>
      </section>
      {c.concept.principles?.length > 0 && (
        <section className="brief-section" aria-labelledby="con-p">
          <h3 id="con-p" className="section-title">
            {t('case.concept.principles')}
          </h3>
          <p className="meta">{t('case.concept.principlesNote')}</p>
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
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  return (
    <article className="brief">
      <section className="brief-section" aria-labelledby="ev-h">
        <h2 id="ev-h" className="eyebrow eyebrow-rule">
          {t('case.sectionNo', { n: '03', title: methodLabel(2) })}
        </h2>
        <h3 className="h1">{t('case.evidence.title')}</h3>
        <div>
          <ListenButton lang={contentLangOf(c)} id={`${c.id}-evidence`} getText={() => evidenceText(c)} />
        </div>
        <p className="meta">{t('case.evidence.note')}</p>
        {c.evidence?.length ? (
          <div className="stat-grid">
            {c.evidence.map((e, i) => (
              <div className="stat" key={i} lang={cl} dir="auto">
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
          <Callout>{t('case.evidence.none')}</Callout>
        )}
      </section>
      <section className="brief-section" aria-labelledby="src-h">
        <h3 id="src-h" className="section-title">
          {t('case.evidence.sources')}
        </h3>
        <SourceList sources={c.sources} />
      </section>
    </article>
  );
}

function OptionCard({ o, selected, locked, onSelect, revealed, chosen, name, histLabel, lang }) {
  const { t } = useTranslation();
  return (
    <label lang={lang} className="option" data-selected={selected || chosen ? 'true' : 'false'} data-locked={locked ? 'true' : 'false'}>
      <input type="radio" name={name} value={o.id} checked={Boolean(selected || chosen)} disabled={locked} onChange={() => onSelect(o.id)} />
      <span className="radio" aria-hidden="true" />
      <span style={{ minWidth: 0 }}>
        {revealed && (
          <span className="option-tags">
            {o.historical && (
              <Badge tone="success" icon={History}>
                {histLabel || t('case.option.whatHappened')}
              </Badge>
            )}
            {chosen && <Badge tone="accent">{t('case.option.yourCall')}</Badge>}
          </span>
        )}
        <span className="option-label" style={{ display: 'block', paddingInlineEnd: revealed ? 180 : 0 }} dir="auto">
          {o.label}
        </span>
        <span className="option-summary" style={{ display: 'block' }}>
          {o.summary}
        </span>
        {isBrief(o.tradeoffs) && isBrief(o.risks) ? (
          // Short notes read better as one compact line than as two near-empty columns.
          <span className="option-brief">
            <span className="ob-key">{t('case.option.upside')}</span> {o.tradeoffs.replace(/\.$/, '')}
            <span className="ob-sep" aria-hidden="true" />
            <span className="ob-key">{t('case.option.risk')}</span> {o.risks.replace(/\.$/, '')}
          </span>
        ) : (
          <dl className="option-detail">
            <div>
              <dt>{t('case.option.tradeoffs')}</dt>
              <dd>{o.tradeoffs}</dd>
            </div>
            <div>
              <dt>{t('case.option.risks')}</dt>
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
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  const opt = k.options.find((o) => o.id === choice.optionId);
  const hist = k.options.find((o) => o.historical);
  const hypothetical = isLive(c, k);
  return (
    <section className="reveal glass" aria-live="polite" aria-labelledby={`rv-${k.id}`}>
      <div className="row between wrap gap-3">
        <h3 id={`rv-${k.id}`} className="section-title">
          {hypothetical ? t('case.reveal.analysisTitle') : t('case.reveal.historyTitle')}
        </h3>
        <span className="row gap-2">
          {!hypothetical &&
            (choice.historical ? (
              <Badge tone="success" icon={CheckCircle2}>
                {t('case.reveal.matched')}
              </Badge>
            ) : (
              <Badge>{t('case.reveal.differed')}</Badge>
            ))}
          <BookmarkButton item={{ type: 'decision', id: `${c.id}:${k.id}`, caseId: c.id, label: k.prompt }} compact />
        </span>
      </div>

      {hypothetical ? (
        <Callout tone="ai" icon={Sparkles}>
          <Trans i18nKey="case.reveal.liveNote" components={{ strong: <strong /> }} />
        </Callout>
      ) : (
        !choice.historical &&
        hist && (
          <p className="meta-caps">
            {contentClassOf(c) === 'scriptural' ? t('case.reveal.narrativeChoice') : t('case.reveal.historicalChoice')}:{' '}
            <span style={{ color: 'var(--text)' }} lang={cl} dir="auto">
              {hist.label}
            </span>
          </p>
        )
      )}

      <div className="stack gap-3">
        <div className="row between wrap gap-3">
          <span className="meta-caps">{t('case.reveal.yourDecision', { label: opt.label })}</span>
          <span className="row gap-2 meta">
            {t('case.reveal.processQuality')} <QualityBars value={opt.quality} label={t('case.reveal.processQuality')} />
          </span>
        </div>
        <p className="muted">{t(`case.quality.${opt.quality}`)}</p>
        <p className="body">
          <strong>{t(`contentClass.consequence.${consequenceKind(c, k, opt)}`)}. </strong>
          <span lang={cl} dir="auto">
            {opt.consequence}
          </span>
        </p>
      </div>

      <div className="reveal-grid">
        {METERS.map((m) => (
          <div className="delta" key={m.id}>
            <span className="meta-caps">{meterLabel(m.id)}</span>
            <span className={`delta-value num ${opt.impact[m.id] > 0 ? 'pos' : opt.impact[m.id] < 0 ? 'neg' : ''}`} dir="ltr">
              {signed(opt.impact[m.id])}
            </span>
          </div>
        ))}
      </div>
      <p className="meta">
        {t('case.reveal.impactNote')} {hypothetical ? t('case.reveal.impactAi') : t('case.reveal.impactHistory')} {t('case.reveal.qualityNote')}
      </p>

      {opt.principles?.length > 0 && (
        <div className="stack gap-2">
          <span className="meta-caps">{t('case.reveal.principlesAtWork')}</span>
          <PrincipleList ids={opt.principles} />
        </div>
      )}
    </section>
  );
}

function EpisodeOutcome({ c, ep, run }) {
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  const out = episodeOutcome(ep);
  const live = ep.live || c.classification === 'HYPOTHETICAL';
  const hist = ep.decisions.filter((k) => !k.live);
  const matched = run.choices.filter((ch) => ch.historical && hist.some((k) => k.id === ch.checkpointId)).length;
  return (
    <section className="reveal glass episode-outcome" aria-labelledby={`eo-${ep.n}`}>
      <div className="row between wrap gap-3">
        <h3 id={`eo-${ep.n}`} className="section-title">
          {t('case.episodeOutcome.title', { roman: ep.roman, n: ep.n })}
        </h3>
        <BookmarkButton item={{ type: 'episode', id: `${c.id}:${ep.n}`, caseId: c.id, label: t('case.episodeOutcome.bookmarkLabel', { title: c.title, roman: ep.roman, n: ep.n }) }} compact />
        {hist.length > 0 && (
          <Badge tone={matched === hist.length ? 'success' : undefined} icon={History}>
            {t('case.episodeOutcome.matched', { matched: formatInteger(matched), total: formatInteger(hist.length) })}
          </Badge>
        )}
      </div>
      <div>
        <ListenButton lang={contentLangOf(c)} id={`${c.id}-ep${ep.n}-outcome`} getText={() => episodeOutcomeText(c, ep, out)} label={t('case.episodeOutcome.listen')} />
      </div>
      {live && (
        <Callout tone="ai" icon={Sparkles}>
          {out.parts.length ? t('case.episodeOutcome.livePartial') : t('case.episodeOutcome.liveNone')}
        </Callout>
      )}
      {out.parts.length > 0 && (
        <div className="stack gap-3">
          <span className="meta-caps">{live ? t('case.episodeOutcome.soFar') : t('case.episodeOutcome.actually')}</span>
          {out.parts.map((p) => (
            <div key={p.id} className="stack gap-1">
              <p className="body" lang={cl} dir="auto">
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
            <Lightbulb size={14} style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 6, color: 'var(--accent-text)' }} aria-hidden="true" />
            {t('case.episodeOutcome.insight')}
          </span>
          <p className="h3" style={{ fontWeight: 500 }} lang={cl} dir="auto">
            {ep.insight.text}
          </p>
          {ep.insight.principles?.length > 0 && <PrincipleList ids={ep.insight.principles} />}
        </div>
      )}
    </section>
  );
}

function Decisions({ c, run, onComplete }) {
  const { t } = useTranslation();
  const cl = contentLangOf(c);
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
          <h2 className="eyebrow eyebrow-rule">{t('case.sectionNo', { n: '04', title: methodLabel(3) })}</h2>
          <span className="meta num">
            {t('simulation.episodeOf', { roman: ep.roman, n: ep.n, last: eps[eps.length - 1].roman, total: eps.length })}
            {multi ? ` · ${t('simulation.decisionOf', { n: di + 1, total: ep.decisions.length })}` : ''}
          </span>
        </div>
        <div className="row gap-2 wrap" role="group" aria-label={t('case.decisions.episodes')}>
          {eps.map((e) => {
            const done = e.decisions.every((x) => isMade(x.id));
            const started = e.decisions.some((x) => isMade(x.id));
            const reachable = started || e.decisions.some((x) => flat.indexOf(x) === nextIdx);
            const firstOpen = e.decisions.find((x) => !isMade(x.id)) || e.decisions[0];
            return (
              <button key={e.n} className="chip num" aria-pressed={e === ep} disabled={!reachable} onClick={() => goTo(flat.indexOf(firstOpen))} style={!reachable ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
                {done && <Check size={13} style={{ marginInlineEnd: 4 }} aria-hidden="true" />}
                {e.live ? t('case.decisions.chipNow', { roman: e.roman, n: e.n }) : t('case.decisions.chip', { roman: e.roman, n: e.n })}
              </button>
            );
          })}
        </div>
        {multi && (
          <ol className="decision-steps" aria-label={t('case.decisions.decisionsIn', { roman: ep.roman, n: ep.n })}>
            {ep.decisions.map((x, j) => {
              const made = isMade(x.id);
              const reachable = made || flat.indexOf(x) === nextIdx;
              return (
                <li key={x.id}>
                  <button className="decision-step num" aria-current={x === k ? 'step' : undefined} data-done={made ? 'true' : 'false'} disabled={!reachable} onClick={() => goTo(flat.indexOf(x))}>
                    {made ? <Check size={12} aria-hidden="true" /> : <span aria-hidden="true">{formatInteger(j + 1)}</span>}
                    {t('case.decisions.decision', { n: j + 1 })}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <div className="checkpoint-head mt-3">
          <span className="meta-caps num">
            {t('case.decisions.headEpisode', { roman: ep.roman, n: ep.n })} · <span lang={cl}>{k.dateLabel}</span>
            {multi ? ` · ${t('simulation.decisionOf', { n: di + 1, total: ep.decisions.length })}` : ''}
            {k.live ? ` · ${t('case.decisions.happeningNow')}` : ''}
          </span>
          <h3 className="h1" lang={cl} dir="auto">
            {ep.title}
          </h3>
          <p className="body" lang={cl} dir="auto">
            {k.context}
          </p>
          <p className="stakes" style={{ fontWeight: 500 }} lang={cl} dir="auto">
            {k.prompt}
          </p>
          <div>
            <ListenButton lang={contentLangOf(c)} id={`${c.id}-${k.id}-${choice ? 'after' : 'before'}`} getText={() => checkpointText(c, k, choice, ep.n - 1, ep)} label={choice ? t('case.decisions.listenResult') : t('case.decisions.listenDecision')} />
          </div>
        </div>
      </section>

      <fieldset className="options" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">{k.prompt}</legend>
        {displayOrder(k.options, `${c.id}:${k.id}`).map((o) => (
          <OptionCard key={o.id} o={o} lang={cl} histLabel={contentClassOf(c) === 'scriptural' ? t('case.option.inNarrative') : t('case.option.whatHappened')} name={`cp-${k.id}`} selected={!choice && selected === o.id} chosen={choice?.optionId === o.id} locked={Boolean(choice)} revealed={Boolean(choice)} onSelect={setSelected} />
        ))}
      </fieldset>

      {!choice ? (
        <div className="row between wrap gap-3">
          <span className="meta">{t('case.decisions.chooseNote')}</span>
          <Button variant="primary" size="lg" disabled={!selected} onClick={submit} iconRight={ArrowRight}>
            {t('case.decisions.submit')}
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
                {t('case.decisions.next')}
              </Button>
            ) : !lastEp ? (
              epDone && (
                <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => goTo(viewIdx + 1)}>
                  {t('case.decisions.episodeButton', { roman: eps[eps.indexOf(ep) + 1].roman, n: eps[eps.indexOf(ep) + 1].n })}
                </Button>
              )
            ) : (
              allDone && (
                <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={onComplete}>
                  {t('case.decisions.seeOutcome')}
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
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  const hypothetical = c.classification === 'HYPOTHETICAL';
  const hasLive = c.checkpoints.some((k) => k.live);
  return (
    <article className="brief">
      <section className="brief-section">
        <h2 className="eyebrow eyebrow-rule">{t('case.sectionNo', { n: '05', title: methodLabel(4) })}</h2>
        <h3 className="h1">{hypothetical ? t('case.outcome.couldGo') : t('case.outcome.playedOut')}</h3>
        <div>
          <ListenButton lang={contentLangOf(c)} id={`${c.id}-outcome`} getText={() => outcomeText(c)} />
        </div>
        {(hypothetical || hasLive) && (
          <Callout tone="ai" icon={Sparkles}>
            {hasLive ? t('case.outcome.liveFinal') : t('case.outcome.liveAll')}
          </Callout>
        )}
        <p className="body" lang={cl} dir="auto">
          {c.outcome.summary}
        </p>
      </section>
      {c.outcome.secondOrder?.length > 0 && (
        <section className="brief-section">
          <h3 className="section-title">{t('case.outcome.secondOrder')}</h3>
          <ul className="stack gap-3" style={{ margin: 0, paddingInlineStart: 'var(--s5)' }} lang={cl} dir="auto">
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
            <span className="provenance prov-hypo">{t('case.outcome.scenarios')}</span>
          </h3>
          <div className="stack gap-4">
            {c.scenarios.map((s, i) => (
              <div key={i} className="principle" lang={cl} dir="auto">
                <div className="principle-name">{s.name}</div>
                <p className="muted">{s.description}</p>
                {s.signals?.length > 0 && <p className="meta">{t('case.outcome.signals', { signals: s.signals.join(' · ') })}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="brief-section">
        <h3 className="section-title">{t('case.outcome.baseRate')}</h3>
        <Callout icon={Scale}>
          <span lang={cl} dir="auto">
            {c.outcome.baseRate}
          </span>
        </Callout>
      </section>
      <section className="brief-section">
        <h3 className="section-title">{t('case.outcome.yourSeason')}</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('case.outcome.colDecision')}</th>
                <th scope="col">{t('case.outcome.colCall')}</th>
                {!hypothetical && <th scope="col">{t('case.outcome.colHistory')}</th>}
                <th scope="col">{t('case.outcome.colQuality')}</th>
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
                        {t('case.outcome.rowEpisode', { roman: ep.roman, n: ep.n })}
                        {ep.decisions.length > 1 ? ` · ${t('case.outcome.rowDecision', { n: j + 1 })}` : ''} · <span lang={cl}>{k.dateLabel}</span>
                      </div>
                      <span lang={cl} dir="auto">
                        {j === 0 || ep.decisions.length === 1 ? ep.title : <span className="muted">{k.prompt.length > 90 ? `${k.prompt.slice(0, 88)}…` : k.prompt}</span>}
                      </span>
                    </td>
                    <td lang={cl} dir="auto">
                      {o?.label || ''}
                    </td>
                    {!hypothetical && (
                      <td>
                        {k.live ? (
                          <span className="faint">{t('case.outcome.stillOpen')}</span>
                        ) : ch?.historical ? (
                          <span className="pos">{t('case.outcome.matched')}</span>
                        ) : (
                          <span lang={cl} dir="auto">
                            {h?.label}
                          </span>
                        )}
                      </td>
                    )}
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
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  const state = useStore((s) => s);
  const attempts = attemptsFor(state, c.id);
  if (attempts.length < 2) return null;
  const shown = attempts.slice(-4);
  const eps = episodesOf(c);
  const anyHist = c.checkpoints.some((k) => k.outcome?.text && !k.live);
  return (
    <section className="brief-section" aria-labelledby="cmp-h">
      <h3 id="cmp-h" className="section-title">
        {t('case.compare.title')}
      </h3>
      <p className="meta">{t('case.compare.note')}</p>
      <div className="table-wrap">
        <table className="table compare-table">
          <caption className="sr-only">{t('case.compare.caption', { title: c.title })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('case.outcome.colDecision')}</th>
              {shown.map((r, i) => (
                <th scope="col" key={r.id}>
                  {t('case.compare.attempt', { n: attempts.length - shown.length + i + 1 })}
                  <div className="meta">{formatDate(r.startedAt)}</div>
                </th>
              ))}
              {anyHist && <th scope="col">{contentClassOf(c) === 'scriptural' ? t('case.compare.narrative') : t('case.compare.history')}</th>}
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
                        {t('case.outcome.rowEpisode', { roman: ep.roman, n: ep.n })}
                        {ep.decisions.length > 1 ? ` · ${formatInteger(j + 1)}` : ''}
                      </div>
                      <span className="muted" lang={cl} dir="auto">
                        {k.prompt.length > 70 ? `${k.prompt.slice(0, 68)}…` : k.prompt}
                      </span>
                    </th>
                    {shown.map((r) => {
                      const ch = r.choices.find((x) => x.checkpointId === k.id);
                      const o = ch && k.options.find((x) => x.id === ch.optionId);
                      return (
                        <td key={r.id}>
                          {o ? (
                            <>
                              <span lang={cl} dir="auto">
                                {o.label}
                              </span>
                              <div className="meta">
                                {k.live || !k.outcome ? t('case.compare.open') : ch.historical ? t('case.compare.matched') : t('case.compare.counterfactual')} · {t('case.compare.quality', { value: formatInteger(o.quality) })}
                              </div>
                            </>
                          ) : (
                            <span className="faint">{t('case.compare.notDecided')}</span>
                          )}
                        </td>
                      );
                    })}
                    {anyHist && (
                      <td>
                        {k.live || !k.outcome ? (
                          <span className="faint">{t('case.outcome.stillOpen')}</span>
                        ) : (
                          <span lang={cl} dir="auto">
                            {h?.label}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              }),
            )}
            <tr>
              <th scope="row">{t('case.compare.avgQuality')}</th>
              {shown.map((r) => (
                <td key={r.id} className="num">
                  {r.choices.length ? t('case.compare.avgValue', { value: formatDecimal(r.choices.reduce((a, x) => a + (x.quality || 0), 0) / r.choices.length) }) : ''}
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
  const { t } = useTranslation();
  const [text, setText] = useState(run.reflection || '');
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (saved) return undefined;
    const timer = setTimeout(() => {
      setReflection(run.id, text);
      setSaved(true);
    }, 600);
    return () => clearTimeout(timer);
  }, [text, saved, run.id]);
  return (
    <section className="brief-section">
      <h3 className="section-title">
        <label htmlFor={`refl-${run.id}`}>{t('case.reflection.title')}</label>
      </h3>
      <p className="meta">{t('case.reflection.note')}</p>
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
        {saved ? (text ? t('common.saved') : '') : t('common.saving')}
      </span>
    </section>
  );
}

function ReportButton({ c, run }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fmt = useMemo(() => reportFormat(c, run), [c, run, i18n.language]);
  return (
    <Button
      size="lg"
      icon={FileDown}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await downloadReport(c, run);
          if (r === 'downloaded') toast(t('case.report.saved'));
          else if (r === 'printed') toast(t('case.report.printed'));
          else if (r === 'shared' && fmt === 'html') toast(t('case.report.sharedHtml'));
        } catch (e) {
          toast(t('case.report.failed', { error: e.message }), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {fmt === 'pdf' ? t('case.report.download') : fmt === 'html' ? t('case.report.html') : t('case.report.downloadPrint')}
    </Button>
  );
}

function Insight({ c, run }) {
  const { t } = useTranslation();
  const cl = contentLangOf(c);
  const profile = useStore((s) => s.profile);
  const avg = run.choices.reduce((a, ch) => a + ch.quality, 0) / (run.choices.length || 1);
  const histEpisodes = c.checkpoints.filter((k) => !k.live).map((k) => k.id);
  const matched = run.choices.filter((ch) => ch.historical).length;
  const hypothetical = c.classification === 'HYPOTHETICAL' || histEpisodes.length === 0;
  return (
    <article className="brief">
      <section className="brief-section">
        <h2 className="eyebrow eyebrow-rule">{t('case.sectionNo', { n: '06', title: methodLabel(5) })}</h2>
        <h3 className="h1">{t('case.insight.title')}</h3>
        <div>
          <ListenButton lang={contentLangOf(c)} id={`${c.id}-insight`} getText={() => insightText(c)} label={t('case.insight.listen')} />
        </div>
        <div className="kpis" style={{ gridTemplateColumns: hypothetical ? 'repeat(2, minmax(0,1fr))' : undefined }}>
          <div className="kpi">
            <span className="meta-caps">{t('case.insight.decisions')}</span>
            <span className="kpi-value num">{formatInteger(run.choices.length)}</span>
          </div>
          {!hypothetical && (
            <div className="kpi">
              <span className="meta-caps">{t('case.insight.matched')}</span>
              <span className="kpi-value num">
                {t('case.insight.fraction', { a: formatInteger(matched), b: formatInteger(run.choices.filter((ch) => histEpisodes.includes(ch.checkpointId)).length) })}
              </span>
            </div>
          )}
          <div className="kpi">
            <span className="meta-caps">{t('case.insight.avgQuality')}</span>
            <span className="kpi-value num">{t('case.compare.avgValue', { value: formatDecimal(avg) })}</span>
          </div>
          {!hypothetical && (
            <div className="kpi">
              <span className="meta-caps">{t('case.insight.finalPosition')}</span>
              <span className="kpi-value num">{formatInteger(metersFor(run).position)}</span>
            </div>
          )}
        </div>
      </section>
      {episodesOf(c).some((e) => e.insight?.text) && (
        <section className="brief-section">
          <h3 className="section-title">{t('case.insight.episodeInsights')}</h3>
          <ol className="stack gap-4" style={{ margin: 0, paddingInlineStart: 0, listStyle: 'none' }}>
            {episodesOf(c)
              .filter((e) => e.insight?.text)
              .map((e) => (
                <li key={e.n} className="stack gap-2">
                  <span className="meta-caps num">{t('case.insight.episodeLine', { roman: e.roman, n: e.n, title: e.title })}</span>
                  <p className="body" lang={cl} dir="auto">
                    {e.insight.text}
                  </p>
                </li>
              ))}
          </ol>
        </section>
      )}
      <section className="brief-section">
        <h3 className="section-title">{t('case.insight.lessons')}</h3>
        <div className="stack gap-5">
          {c.outcome.lessons.map((l, i) => (
            <div key={i} className="stack gap-3">
              <p className="h3" style={{ fontWeight: 500 }} lang={cl} dir="auto">
                <Lightbulb size={18} style={{ display: 'inline', verticalAlign: '-3px', marginInlineEnd: 8, color: 'var(--accent-text)' }} aria-hidden="true" />
                {l.text}
              </p>
              <PrincipleList ids={l.principles} />
            </div>
          ))}
        </div>
      </section>
      {c.reading && (
        <section className="brief-section">
          <h3 className="section-title">{t('case.insight.goDeeper')}</h3>
          <p className="body" lang={cl} dir="auto">
            <BookOpen size={16} style={{ display: 'inline', verticalAlign: '-2px', marginInlineEnd: 8 }} aria-hidden="true" />
            {c.reading}
          </p>
        </section>
      )}
      <section className="brief-section">
        <div className="row between wrap gap-3">
          <h3 className="section-title">{t('case.insight.profile')}</h3>
          <Link to="/learning" className="link">
            {t('case.insight.fullProfile')} <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <p className="meta">{t('case.insight.profileNote')}</p>
        <DimensionBars dims={profile.dims} />
      </section>
      <Reflection key={run.id} run={run} />
      <div className="row wrap gap-3">
        <Link to="/cases" className="btn btn-primary btn-lg">
          {t('case.insight.nextCase')} <ArrowRight aria-hidden="true" />
        </Link>
        <ReportButton c={c} run={run} />
        <Button size="lg" icon={RotateCcw} onClick={() => restartRun(c.id)}>
          {t('case.insight.tryAgain')}
        </Button>
      </div>
      <p className="meta">{t('case.insight.replayNote')}</p>
    </article>
  );
}

function Aside({ c, run }) {
  const { t } = useTranslation();
  const m = metersFor(run);
  const last = run?.choices.at(-1);
  return (
    <aside className="aside" aria-label={t('case.aside.label')}>
      <section className="panel panel-pad stack gap-4">
        <div className="row between">
          <h2 className="section-title">{t('case.aside.companyState')}</h2>
          <span className="meta num">{run ? progressLabel(c, run) : t('simulation.notStarted')}</span>
        </div>
        {METERS.map((x) => (
          <Meter key={x.id} label={meterLabel(x.id)} value={m[x.id]} delta={last?.impact?.[x.id]} />
        ))}
        <p className="meta">{t('case.aside.meterNote')}</p>
      </section>
      <section className="panel panel-pad stack gap-3">
        <div className="row gap-3 meta">
          <Clock size={14} aria-hidden="true" /> <span className="num">{t('simulation.minutes', { count: c.minutes })}</span>
          <Target size={14} aria-hidden="true" /> <span className="num">{seasonShapeLabel(c)}</span>
        </div>
        <h2 className="section-title">{t('case.aside.sources')}</h2>
        <SourceList sources={c.sources.slice(0, 6)} />
        {c.sources.length > 6 && <p className="meta num">{t('case.aside.moreSources', { count: c.sources.length - 6 })}</p>}
      </section>
      <CaseTagEditor c={c} />
    </aside>
  );
}

export default function CasePlayer() {
  const { t } = useTranslation();
  const { id } = useParams();
  const locale = useLocale();
  const myCases = useStore((s) => s.myCases); // re-render when generated cases change
  const runs = useStore((s) => s.runs);
  // Content in the user's language where a translation exists; ids and numbers never change.
  const base = useMemo(() => findCase(id), [id, myCases]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = useLocalizedCase(base, locale);
  const run = useMemo(() => runs.find((r) => r.caseId === id && isOpen(r)) || runs.find((r) => r.caseId === id && !r.abandonedAt) || runs.find((r) => r.caseId === id) || null, [runs, id]);
  const complete = runComplete(c, run);
  const unlocked = complete ? 5 : 3;
  const [step, setStep] = useState(() => (run && !run.finishedAt && run.choices.length ? 3 : 0));

  useEffect(() => {
    if (c) document.title = t('case.pageTitle', { title: c.title });
  }, [c, t]);
  useEffect(() => {
    if (complete && step === 5 && run && !run.finishedAt) finishRun(run.id);
  }, [complete, step, run]);
  // When a replay starts, return to the first decision.
  useEffect(() => {
    if (run && !run.finishedAt && run.choices.length === 0 && step > 3) setStep(3);
  }, [run, step]);

  if (!c) {
    return (
      <Empty
        icon={AlertTriangle}
        title={t('case.notFound.title')}
        action={
          <Link to="/cases" className="btn">
            {t('case.notFound.back')}
          </Link>
        }
      >
        {t('case.notFound.body')}
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
          <nav className="row between gap-3" aria-label={t('case.nav.steps')}>
            {step > 0 ? (
              <Button icon={ArrowLeft} onClick={() => go(step - 1)}>
                {methodLabel(step - 1)}
              </Button>
            ) : (
              <Link to="/cases" className="btn btn-ghost">
                <ArrowLeft aria-hidden="true" /> {t('case.nav.allCases')}
              </Link>
            )}
            <Button variant="primary" size="lg" iconRight={step === 2 ? Flag : ArrowRight} onClick={() => go(step + 1)}>
              {step === 2 ? (run && !run.finishedAt && run.choices.length ? t('case.nav.resume') : complete ? t('case.nav.review') : t('case.nav.start', { roman: 'I', n: 1 })) : methodLabel(step + 1)}
            </Button>
          </nav>
        )}
        {step === 4 && (
          <nav className="row between gap-3">
            <Button icon={ArrowLeft} onClick={() => go(3)}>
              {methodLabel(3)}
            </Button>
            <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => go(5)}>
              {methodLabel(5)}
            </Button>
          </nav>
        )}
      </div>
      <Aside c={c} run={run} />
    </div>
  );
}
