import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, BarChart2, CheckCircle2, Search, Play, ExternalLink, BookOpen, Radar } from 'lucide-react';
import { CASES } from '@shared/cases/index.js';
import { CATALOGUE, ROMAN } from '@shared/catalogue.js';
import { CASE_BY_ID } from '@shared/cases/index.js';
import { episodesOf } from '@shared/episodes.js';
import { ERAS, PILLARS } from '@shared/dimensions.js';
import { useTranslation, useLocale } from '../i18n/index.js';
import { formatInteger } from '../i18n/format.js';
import { seasonShapeLabel } from '../lib/sim.js';
import { pillarName } from '../lib/format.js';
import { hasOverlay, contentLangOf } from '../lib/caseLocale.js';

const TOTAL_DECISIONS = CASES.reduce((n, c) => n + c.checkpoints.length, 0);
import { CaseCover } from '../components/content.jsx';
import { Badge, Empty, Tabs, TabPanel } from '../components/ui.jsx';
import { useStore } from '../lib/store.js';
import { useLibrary, allTags } from '../lib/library.js';
import { eraLabel, difficultyLabel } from '../lib/format.js';

function CaseCard({ c, done }) {
  const { t } = useTranslation();
  return (
    <Link to={`/cases/${c.id}`} className="panel case-card interactive">
      <CaseCover c={c} />
      <div className="case-card-body">
        <div className="row between gap-2">
          <span className="meta-caps num">
            {c.company} · {c.yearLabel}
          </span>
          {done && <CheckCircle2 size={16} className="pos" aria-label={t('explore.completed')} />}
        </div>
        <h3 className="case-title" lang={contentLangOf(c)} dir="auto">
          {c.title}
        </h3>
        <p className="case-tagline" lang={contentLangOf(c)} dir="auto">
          {c.tagline}
        </p>
        <div className="badges mt-2">
          <Badge>{eraLabel(c.era)}</Badge>
          {c.pillar && <Badge>{pillarName(c.pillar)}</Badge>}
          {c.classification === 'LIVE' ? (
            <Badge tone="ai">{t('explore.liveSeason')}</Badge>
          ) : c.source === 'built' ? (
            <Badge tone="ai">{t('explore.aiBuilt')}</Badge>
          ) : c.classification === 'HYPOTHETICAL' ? (
            <Badge tone="warning">{t('explore.hypothetical')}</Badge>
          ) : (
            <Badge tone="success">{t('explore.curated')}</Badge>
          )}
        </div>
        <div className="case-facts" style={{ marginTop: 'auto', paddingTop: 'var(--s3)' }}>
          <span className="fact num">
            <Clock aria-hidden="true" /> {t('simulation.minutes', { count: c.minutes })}
          </span>
          <span className="bar" aria-hidden="true" />
          <span className="fact">
            <BarChart2 aria-hidden="true" /> {difficultyLabel(c.difficulty)}
          </span>
          <span className="bar" aria-hidden="true" />
          <span className="fact num">{seasonShapeLabel(c)}</span>
        </div>
      </div>
    </Link>
  );
}

function CatalogueCard({ e, done, translated }) {
  const { t } = useTranslation();
  const c = CASE_BY_ID[e.caseId];
  return (
    <article className="panel cat-card" id={e.id}>
      <div className="row between gap-2">
        <span className="cat-num num">
          #{formatInteger(e.n)} · <span lang="en">{e.when}</span>
        </span>
        <span className="row gap-2">
          {translated && <Badge tone="accent">{t('explore.translated')}</Badge>}
          {done ? <CheckCircle2 size={16} className="pos" aria-label={t('explore.completed')} /> : e.bonus ? <Badge>{t('explore.bonus')}</Badge> : e.added ? <Badge>{t('explore.new')}</Badge> : null}
        </span>
      </div>
      <h3 className="cat-title" lang="en" dir="auto">
        {e.title}
      </h3>
      <p className="muted" style={{ fontSize: 'var(--t-14)' }} lang="en" dir="auto">
        {e.summary}
      </p>
      <ol className="episodes" aria-label={t('explore.episodes')}>
        {(c ? episodesOf(c).map((x) => x.title) : e.episodes).map((title, i) => (
          <li key={i}>
            <span className="ep-num num">{t('explore.epShort', { roman: ROMAN[i], n: i + 1 })}</span>
            <span lang="en" dir="auto">
              {title}
            </span>
          </li>
        ))}
      </ol>
      <div>
        <p className="meta row gap-2" style={{ alignItems: 'flex-start' }}>
          <BookOpen size={13} aria-hidden="true" style={{ marginTop: 2, flex: 'none' }} />
          <span lang="en" dir="auto">
            {e.reading}
          </span>
        </p>
        <div className="cat-actions">
          <Link className="btn btn-sm btn-primary" to={`/cases/${e.caseId}`}>
            <Play aria-hidden="true" /> {done ? t('explore.playAgain') : t('explore.play')}
          </Link>
          <a className="btn btn-sm btn-ghost" href={`https://en.wikipedia.org/wiki/${encodeURIComponent(e.wiki.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">
            {t('explore.source')} <ExternalLink aria-hidden="true" />
          </a>
        </div>
      </div>
    </article>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className="row wrap gap-2" role="group" aria-label={label}>
      <button className="chip" aria-pressed={!value} onClick={() => onChange(null)}>
        {t('explore.all')}
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
  const { t } = useTranslation();
  const locale = useLocale();
  const [translatedOnly, setTranslatedOnly] = useState(false);
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
    const tg = lib.tags[id];
    if (!tg) return '';
    return `${(tg.tags || []).join(' ')} ${(tg.principles || []).map((p) => lib.principleById[p]?.name || '').join(' ')}`;
  };
  const hasTag = (id) => !tag || (lib.tags[id]?.tags || []).includes(tag);
  const done = new Set(runs.filter((r) => r.finishedAt).map((r) => r.caseId));
  const signature = useMemo(() => CASES.filter((c) => !c.catalogueId).sort((a, b) => a.yearSort - b.yearSort), []);
  const usedEras = Object.fromEntries(Object.keys(ERAS).filter((k) => CATALOGUE.some((c) => c.era === k)).map((k) => [k, t(`taxonomy.era.${k}`)]));
  const pillarNames = Object.fromEntries(Object.keys(PILLARS).map((k) => [k, pillarName(k)]));
  const anyTranslated = CATALOGUE.some((e) => hasOverlay(locale, e.caseId));
  const ql = q.toLowerCase();
  const list = CATALOGUE.filter(
    (e) =>
      (!pillar || e.pillar === pillar) &&
      (!era || e.era === era) &&
      (!unplayedOnly || !done.has(e.caseId)) &&
      (!translatedOnly || hasOverlay(locale, e.caseId)) &&
      hasTag(e.caseId) &&
      (!q || `${e.n} ${e.title} ${e.summary} ${e.reading} ${e.when} ${e.episodes.join(' ')} ${userText(e.caseId)}`.toLowerCase().includes(ql)),
  );
  const mineList = myCases.filter((c) => (!pillar || c.pillar === pillar) && hasTag(c.id) && (!q || `${c.title} ${c.company} ${c.tagline} ${userText(c.id)}`.toLowerCase().includes(ql)));
  const setTag = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('tag', value);
    else next.delete('tag');
    setParams(next, { replace: true });
  };

  return (
    <div className="stack gap-6">
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">{t('explore.eyebrow')}</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          {t('explore.title')}
        </h1>
        <p className="lead">{t('explore.lead', { seasons: formatInteger(CATALOGUE.length), episodes: formatInteger(CATALOGUE.length * 4), decisions: formatInteger(TOTAL_DECISIONS) })}</p>
      </header>

      <section aria-labelledby="tl-title">
        <h2 id="tl-title" className="eyebrow">
          {t('explore.timeline')}
        </h2>
        <div className="timeline">
          {signature.map((c) => (
              <Link key={c.id} to={`/cases/${c.id}`} className={done.has(c.id) ? 'done' : ''}>
                <span className="meta num">{c.yearLabel.split(' – ')[0]}</span>
                <span style={{ fontWeight: 500, fontSize: 'var(--t-13)' }} lang="en">
                  {c.company}
                </span>
              </Link>
          ))}
        </div>
      </section>

      <Tabs
        label={t('explore.libraryView')}
        value={tab}
        onChange={(v) => {
          const next = new URLSearchParams(params);
          if (v === 'mine') next.set('view', 'mine');
          else next.delete('view');
          setParams(next, { replace: true });
        }}
        tabs={[
          { id: 'catalogue', label: t('explore.tabAll'), count: formatInteger(CATALOGUE.length) },
          { id: 'mine', label: t('explore.tabMine'), count: formatInteger(myCases.length) },
        ]}
      />

      <section className="stack gap-4" aria-label={t('explore.filters')}>
        <div className="search-field" style={{ maxWidth: 420 }}>
          <Search aria-hidden="true" />
          <input className="input" type="search" placeholder={t('explore.searchPlaceholder')} aria-label={t('explore.searchLabel')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <ChipGroup label={t('explore.pillar')} options={pillarNames} value={pillar} onChange={setPillar} />
        {(tagOptions.length > 0 || tag) && <ChipGroup label={t('explore.myTags')} options={Object.fromEntries([...new Set([tag, ...tagOptions].filter(Boolean))].map((x) => [x, x]))} value={tag || null} onChange={(v) => setTag(v || '')} />}
        {tab === 'catalogue' && (
          <>
            <ChipGroup label={t('explore.era')} options={usedEras} value={era} onChange={setEra} />
            <label className="row gap-2 meta" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={unplayedOnly} onChange={(e) => setUnplayedOnly(e.target.checked)} /> {t('explore.unplayed')}
            </label>
            {anyTranslated && (
              <label className="row gap-2 meta" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={translatedOnly} onChange={(e) => setTranslatedOnly(e.target.checked)} /> {t('explore.translatedOnly')}
              </label>
            )}
          </>
        )}
      </section>

      <TabPanel id="catalogue" active={tab === 'catalogue'}>
        <div className="stack gap-6">
          <p className="meta num" aria-live="polite">
            {t('explore.count', { shown: formatInteger(list.length), total: formatInteger(CATALOGUE.length) })}
          </p>
          {Object.entries(PILLARS)
            .filter(([k]) => list.some((e) => e.pillar === k))
            .map(([k]) => (
              <section key={k} className="stack gap-4" aria-labelledby={`p-${k}`}>
                <div className="pillar-head">
                  <h2 id={`p-${k}`} className="h2">
                    {t(`taxonomy.pillar.${k}.long`)}
                  </h2>
                  <p className="meta">{t(`taxonomy.pillar.${k}.focus`)}</p>
                </div>
                <div className="cat-list">
                  {list
                    .filter((e) => e.pillar === k)
                    .map((e) => (
                      <CatalogueCard key={e.id} e={e} done={done.has(e.caseId)} translated={hasOverlay(locale, e.caseId)} />
                    ))}
                </div>
              </section>
            ))}
          {!list.length && (
            <Empty icon={Search} title={t('explore.emptyTitle')}>
              {t('explore.emptyBody')}
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
          <Empty icon={Radar} title={t('explore.mineEmptyTitle')}>
            {t('explore.mineEmptyBody')}
          </Empty>
        )}
      </TabPanel>
    </div>
  );
}
