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
import { sourceKind, KIND_LABEL } from '@shared/evidenceCheck.js';
import { BookmarkButton } from './Collections.jsx';

// ---------- Case cover: chosen image > the season's own Wikipedia image > typographic fallback ----------
// Built-in seasons use a pre-checked list (the lead image of each season's own
// Wikipedia article, free licences only), so the picture always matches the topic.
// Live and chat-built seasons look up their article's image once and cache it.
const imageCache = new Map();
const LS = 'bizsim.wikiImages.v1';
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
    return hit && Date.now() - hit.at < 30 * 864e5 ? hit.img : undefined;
  };
  const [img, setImg] = useState(initial);
  useEffect(() => {
    const now = initial();
    setImg(now ?? null);
    if (now !== undefined || !key) return;
    let alive = true;
    (c.wiki ? wikiLeadImage(c.wiki) : wikiImageForQuery(c.imageQuery))
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
  const chosen = useStore((s) => s.caseImages[c.id]);
  const open = useOpenImage(chosen ? null : c);
  const img = chosen || open;
  const [loaded, setLoaded] = useState(false);
  const [useRemote, setUseRemote] = useState(false);
  useEffect(() => {
    setLoaded(false);
    setUseRemote(false);
  }, [img?.url]);
  const src = img ? safeImageSrc(assetUrl(useRemote && img.remote ? img.remote : img.url)) : null;
  return (
    <div className={`cover ${className}`}>
      {!loaded && (
        <div className="cover-fallback">
          <Pattern seed={c.id} />
          <span className="num">{c.yearLabel}</span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt=""
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
          <Sparkles aria-hidden="true" /> AI image
        </span>
      )}
    </div>
  );
}

export function ImageCredit({ img }) {
  if (!img) return null;
  if (img.aiGenerated) return <span className="meta">AI-generated illustration ({img.provider}). Not a photograph of real events.</span>;
  return (
    <span className="meta">
      Image: {img.landingUrl ? <a className="link" href={safeUrl(img.landingUrl)} target="_blank" rel="noreferrer">{img.title}</a> : img.title} by {img.creator}
      {img.license && (
        <>
          {' · '}
          {img.licenseUrl ? <a className="link" href={safeUrl(img.licenseUrl)} target="_blank" rel="noreferrer">{img.license}</a> : img.license}
        </>
      )}
      {' · '}
      {img.article ? `from the Wikipedia article "${img.article}"` : `via ${img.provider || 'Wikimedia Commons'}`}
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
            <a href={safeUrl(s.url)} target="_blank" rel="noreferrer">
              {s.title} <ExternalLink size={12} style={{ display: 'inline', verticalAlign: '-1px' }} aria-hidden="true" />
            </a>
            <div className="meta">
              {[s.publisher, KIND_LABEL[sourceKind(s)], s.date && fmtDate(s.date)].filter(Boolean).join(' · ')}
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
    <a className="fn num" href={`#src-${id}`} aria-label={`Source ${i + 1}: ${sources[i].title}`} title={sources[i].title}>
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
          {value}
          {delta ? <span className={delta > 0 ? 'pos' : 'neg'} style={{ marginLeft: 6, fontSize: 'var(--t-12)' }}>{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}</span> : null}
        </span>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className="meter-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function DimensionBars({ dims, compact = false }) {
  return (
    <div className="stack gap-5">
      {DIMENSIONS.map((d) => {
        const v = dims[d.id] || 0;
        const left = v < 0 ? 50 + v / 2 : 50;
        const width = Math.abs(v) / 2;
        return (
          <div key={d.id} className="dim">
            {!compact && <div className="dim-name">{d.name}</div>}
            <span className="left">{d.left}</span>
            <div className="dim-track" role="meter" aria-label={`${d.name}: ${Math.round(v)} (from ${d.left} −100 to ${d.right} +100)`} aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(v)}>
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
    <figure style={{ margin: 0 }}>
      <figcaption className="row between wrap gap-3" style={{ marginBottom: 'var(--s3)' }}>
        <span className="h3">{title}</span>
        <span className="legend meta">
          <span className="row gap-2"><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> Revenue ({unit})</span>
          {secondary && <span className="row gap-2"><i style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--text-3)', display: 'inline-block' }} /> {secondaryLabel} ({unit})</span>}
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
                <title>{`FY ending ${p.period}: ${compactMoney(p.value, unit)} (${p.form}, filed ${p.filed})`}</title>
              </rect>
              {secondary && s != null && (
                <rect className="bar alt" x={cx + 2} y={Math.min(y(s), y(0))} width={bw} height={Math.abs(y(s) - y(0))} rx="2">
                  <title>{`${secondaryLabel}, FY ending ${p.period}: ${compactMoney(s, unit)}`}</title>
                </rect>
              )}
              <text x={cx} y={H - pad.b + 18} textAnchor="middle">
                {`FY${p.period.slice(2, 4)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="chart-caption">
        <span>Fiscal years, as reported in annual filings (10-K / 20-F). Values in {unit}, not inflation-adjusted.</span>
        <span>
          Source:{' '}
          <a className="link" href={safeUrl(sourceUrl)} target="_blank" rel="noreferrer">
            {sourceLabel}
          </a>
        </span>
      </div>
    </figure>
  );
}
