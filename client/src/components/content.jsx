// Content components shared across pages: covers, principles, sources, charts, meters.
import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { useLibrary } from '../lib/library.js';
import { DIMENSIONS } from '@shared/dimensions.js';
import { assetUrl } from '../lib/api.js';
import { wikiLeadImage, wikiImageForQuery } from '@shared/wikiImage.js';
import { SEASON_IMAGES } from '@shared/seasonImages.js';
import { useStore } from '../lib/store.js';
import { compactMoney, fmtDate } from '../lib/format.js';
import { safeUrl, safeImageSrc } from '../lib/safe.js';
import { buildCoverAlt } from '@shared/imagePolicy.js';
import { sourceKind } from '@shared/evidenceCheck.js';
import { BookmarkButton } from './Collections.jsx';
import { useTranslation, t as tr } from '../i18n/index.js';
import { formatInteger } from '../i18n/format.js';

// The six method steps, by stable key.
export const METHOD_KEYS = ['situation', 'concept', 'evidence', 'episodes', 'outcome', 'insight'];
export const methodLabel = (i) => tr(`method.steps.${METHOD_KEYS[i]}`);

export function MethodSteps() {
  const { t } = useTranslation();
  return (
    <ol className="method-steps">
      {METHOD_KEYS.map((m, i) => (
        <li key={m}>
          <span className={`step-num num${i === 0 ? ' active' : ''}`}>{formatInteger(i + 1)}</span>
          {t(`method.steps.${m}`)}
        </li>
      ))}
    </ol>
  );
}

// ---------- Case cover: chosen image > the season's own Wikipedia image > typographic fallback ----------
// Built-in seasons use a pre-checked list (the lead image of each season's own
// Wikipedia article, free licences only), so the picture always matches the topic.
// Live and chat-built seasons look up their article's image once and cache it.
const imageCache = new Map();
const LS = 'bizsim.wikiImages.v2';
function readLs() {
  try {
    return JSON.parse(localStorage.getItem(LS) || '{}');
  } catch {
    return {};
  }
}
function writeLs(key, img) {
  try {
    const all = readLs();
    all[key] = { img, at: Date.now() };
    const keys = Object.keys(all);
    if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete all[k];
    localStorage.setItem(LS, JSON.stringify(all));
  } catch {
    /* storage full or unavailable */
  }
}
export function useOpenImage(c) {
  const builtIn = c && Object.prototype.hasOwnProperty.call(SEASON_IMAGES, c.id);
  const key = !c || builtIn ? null : c.wiki ? `w:${c.wiki}` : c.imageQuery ? `q:${c.imageQuery}` : null;
  const initial = () => {
    if (builtIn) return SEASON_IMAGES[c.id];
    if (!key) return null;
    if (imageCache.has(key)) return imageCache.get(key);
    const hit = readLs()[key];
    const ttl = hit?.img ? 30 * 864e5 : 10 * 60 * 1000;
    return hit && Date.now() - hit.at < ttl ? hit.img : undefined;
  };
  const [img, setImg] = useState(initial);
  useEffect(() => {
    const now = initial();
    setImg(now ?? null);
    if (now !== undefined || !key) return;
    let alive = true;
    (async () => {
      let found = c.wiki ? await wikiLeadImage(c.wiki).catch(() => null) : null;
      if (!found) {
        const q = c.imageQuery || c.company || c.wiki;
        if (q) found = await wikiImageForQuery(q).catch(() => null);
      }
      return found;
    })()
      .then((found) => {
        imageCache.set(key, found || null);
        writeLs(key, found || null);
        if (alive) setImg(found || null);
      })
      .catch(() => imageCache.set(key, null));
    return () => {
      alive = false;
    };
  }, [c?.id, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return img || null;
}

function Pattern({ seed = 'x' }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = 10 + i * 10;
    const x = ((h >> i) & 7) * 6;
    return <line key={i} x1={x} y1={y} x2={100} y2={y - 20 - ((h >> (i + 3)) & 15)} stroke="currentColor" strokeWidth=".4" />;
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ color: 'var(--border-strong)' }}>
      {lines}
    </svg>
  );
}

export function CaseCover({ c, className = '', eager = false }) {
  const { t } = useTranslation();
  const chosen = useStore((s) => s.caseImages[c.id]);
  const open = useOpenImage(chosen ? null : c);
  const img = chosen || open || (c.cover ? { url: c.cover, title: c.title, provider: 'Wikimedia Commons' } : null);
  const [loaded, setLoaded] = useState(false);
  const [useRemote, setUseRemote] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setUseRemote(false);
  }, [img?.url]);
  const src = img ? safeImageSrc(assetUrl(useRemote && img.remote ? img.remote : img.url), img.title || c.title || '') : null;
  const altText = buildCoverAlt(c, src ? img : null);
  return (
    <div className={`cover ${className}`}>
      {!loaded && (
        <div className="cover-fallback" role="img" aria-label={altText}>
          <Pattern seed={c.id} />
          <span className="num">{c.yearLabel}</span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={altText}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className={loaded ? 'loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (img.remote && !useRemote) setUseRemote(true);
          }}
          referrerPolicy="no-referrer"
        />
      )}
      {img?.aiGenerated && loaded && (
        <span className="ai-tag badge badge-ai">
          <Sparkles aria-hidden="true" /> {t('content.aiImage')}
        </span>
      )}
    </div>
  );
}

export function ImageCredit({ img }) {
  const { t } = useTranslation();
  if (!img) return null;
  if (img.aiGenerated) return <span className="meta">{t('content.aiIllustration', { provider: img.provider })}</span>;
  const [before, after] = t('content.imageBy', { title: '\u0000', creator: img.creator }).split('\u0000');
  return (
    <span className="meta">
      {before}
      {img.landingUrl ? (
        <a className="link" href={safeUrl(img.landingUrl)} target="_blank" rel="noreferrer">
          {img.title}
        </a>
      ) : (
        img.title
      )}
      {after}
      {img.license && (
        <>
          {' · '}
          {img.licenseUrl ? <a className="link" href={safeUrl(img.licenseUrl)} target="_blank" rel="noreferrer">{img.license}</a> : img.license}
        </>
      )}
      {' · '}
      {img.article ? t('content.fromArticle', { article: img.article }) : t('content.via', { provider: img.provider || 'Wikimedia Commons' })}
    </span>
  );
}

// ---------- Principles ----------
export function PrincipleChip({ id, mine = false }) {
  const lib = useLibrary();
  const p = lib.principleById[id];
  if (!p) return null;
  const b = lib.bookOf(p);
  return (
    <span className="tooltip-wrap">
      <button type="button" className={`principle-chip${mine || p.custom ? ' mine' : ''}`} aria-describedby={`tip-${id}`}>
        <BookOpen aria-hidden="true" />
        {p.name}
      </button>
      <span role="tooltip" id={`tip-${id}`} className="tooltip">
        <strong>{p.name}</strong>
        <br />
        {p.idea}
        <br />
        <span className="faint">
          {b.title}, {b.author}
        </span>
      </span>
    </span>
  );
}

export function PrincipleList({ ids = [] }) {
  if (!ids.length) return null;
  return (
    <div className="badges">
      {ids.map((id) => (
        <PrincipleChip key={id} id={id} />
      ))}
    </div>
  );
}

export function PrincipleCard({ id }) {
  const lib = useLibrary();
  const p = lib.principleById[id];
  if (!p) return null;
  const b = lib.bookOf(p);
  return (
    <div className="principle">
      <div className="row between gap-2" style={{ alignItems: 'flex-start' }}>
        <div className="principle-name">{p.name}</div>
        <BookmarkButton item={{ type: 'principle', id: p.id, label: p.name }} compact />
      </div>
      <p className="muted">{p.idea}</p>
      <div className="principle-book">
        {b.title} · {b.author}
      </div>
    </div>
  );
}

// ---------- Sources ----------
export function SourceList({ sources, numbered = true }) {
  return (
    <ol className="source-list">
      {sources.map((s, i) => (
        <li key={s.id || s.url} id={s.id ? `src-${s.id}` : undefined}>
          <span className="idx">{numbered ? i + 1 : '•'}</span>
          <span>
            <a href={safeUrl(s.url)} target="_blank" rel="noreferrer" lang="und" dir="auto">
              {s.title} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} aria-hidden="true" />
            </a>
            <div className="meta">
              {[s.publisher, tr(`evidence.kind.${sourceKind(s)}`), s.date && fmtDate(s.date)].filter(Boolean).join(' · ')}
            </div>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Footnote({ sources, id }) {
  const i = sources.findIndex((s) => s.id === id);
  if (i < 0) return null;
  return (
    <a className="fn num" href={`#src-${id}`} aria-label={tr('content.sourceN', { n: i + 1, title: sources[i].title })} title={sources[i].title}>
      {i + 1}
    </a>
  );
}

// ---------- Meters & profile ----------
export function Meter({ label, value, delta }) {
  return (
    <div className="meter">
      <div className="row between">
        <span className="meta-caps">{label}</span>
        <span className="num" style={{ fontWeight: 600 }}>
          {formatInteger(value)}
          {delta ? (
            <span className={delta > 0 ? 'pos' : 'neg'} style={{ marginInlineStart: 6, fontSize: 'var(--t-12)' }} dir="ltr">
              {delta > 0 ? `+${formatInteger(delta)}` : `−${formatInteger(Math.abs(delta))}`}
            </span>
          ) : null}
        </span>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function DimensionBars({ dims, compact = false }) {
  const { t } = useTranslation();
  return (
    <div className="stack gap-5">
      {DIMENSIONS.map((d0) => {
        const d = { id: d0.id, name: t(`dimensions.${d0.id}.name`), left: t(`dimensions.${d0.id}.left`), right: t(`dimensions.${d0.id}.right`) };
        const v = dims[d.id] || 0;
        const left = v < 0 ? 50 + v / 2 : 50;
        const width = Math.abs(v) / 2;
        return (
          // A spectrum, not reading order: poles keep their sides in every language.
          <div key={d.id} className="dim" dir="ltr">
            {!compact && <div className="dim-name">{d.name}</div>}
            <span className="left">{d.left}</span>
            <div className="dim-track" role="meter" aria-label={t('dimensions.aria', { name: d.name, value: Math.round(v), left: d.left, right: d.right })} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(v)}>
              <div className="dim-fill" style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
            <span className="right">{d.right}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Financial bar chart (SEC XBRL data only) ----------
export function FinancialChart({ title, series, unit = 'USD', secondary, secondaryLabel, sourceLabel, sourceUrl }) {
  const { t } = useTranslation();
  const W = 720;
  const H = 300;
  const pad = { l: 64, r: 16, t: 16, b: 40 };
  const all = [...series.map((p) => p.value), ...(secondary?.map((p) => p.value) || [])];
  const max = Math.max(0, ...all);
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const nice = (v) => {
    const p = 10 ** Math.floor(Math.log10(Math.abs(v) || 1));
    return Math.ceil(v / p) * p;
  };
  const top = nice(max);
  const bottom = min < 0 ? -nice(-min) : 0;
  const y = (v) => pad.t + ((top - v) / (top - bottom || span)) * (H - pad.t - pad.b);
  const n = series.length;
  const band = (W - pad.l - pad.r) / n;
  const bw = Math.min(42, band * (secondary ? 0.36 : 0.6));
  const ticks = Array.from({ length: 5 }, (_, i) => bottom + ((top - bottom) * i) / 4);
  const secByPeriod = Object.fromEntries((secondary || []).map((p) => [p.period, p.value]));
  return (
    <figure style={{ margin: 0 }} dir="ltr">
      <figcaption className="row between wrap gap-3" style={{ marginBottom: 'var(--s3)' }}>
        <span className="h3">{title}</span>
        <span className="legend meta">
          <span className="row gap-2"><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> {t('content.chart.revenue', { unit })}</span>
          {secondary && <span className="row gap-2"><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--text-3)', display: 'inline-block' }} /> {t('content.chart.series', { label: secondaryLabel, unit })}</span>}
        </span>
      </figcaption>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${series.map((p) => `${p.period.slice(0, 4)}: ${compactMoney(p.value, unit)}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end">
              {compactMoney(t, unit)}
            </text>
          </g>
        ))}
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
        {series.map((p, i) => {
          const cx = pad.l + band * i + band / 2;
          const s = secByPeriod[p.period];
          return (
            <g key={p.period}>
              <rect className="bar" x={secondary ? cx - bw - 2 : cx - bw / 2} y={Math.min(y(p.value), y(0))} width={bw} height={Math.abs(y(p.value) - y(0))} rx="2">
                <title>{t('content.chart.fyTooltip', { period: p.period, value: compactMoney(p.value, unit), form: p.form, filed: p.filed })}</title>
              </rect>
              {secondary && s != null && (
                <rect className="bar alt" x={cx + 2} y={Math.min(y(s), y(0))} width={bw} height={Math.abs(y(s) - y(0))} rx="2">
                  <title>{t('content.chart.fySecondary', { label: secondaryLabel, period: p.period, value: compactMoney(s, unit) })}</title>
                </rect>
              )}
              <text x={cx} y={H - pad.b + 18} textAnchor="middle">
                {t('content.chart.fyShort', { yy: p.period.slice(2, 4) })}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-caption">
        <span>{t('content.chart.caption', { unit })}</span>
        <span>
          {t('content.chart.source')}{' '}
          <a className="link" href={safeUrl(sourceUrl)} target="_blank" rel="noreferrer">
            {sourceLabel}
          </a>
        </span>
      </div>
    </figure>
  );
}
