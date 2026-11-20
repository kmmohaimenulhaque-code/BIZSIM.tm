import { MARK } from './logoMark.js';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export function Button({ variant = 'default', size, icon: Icon, iconRight: IconRight, loading, block, className = '', children, ...rest }) {
  const cls = ['btn', variant !== 'default' && `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', !children && Icon && 'btn-icon', className].filter(Boolean).join(' ');
  return (
    <button className={cls} data-loading={loading ? 'true' : undefined} aria-busy={loading || undefined} {...rest}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
      {IconRight && <IconRight aria-hidden="true" />}
    </button>
  );
}

export function Badge({ tone, icon: Icon, children, title }) {
  return (
    <span className={`badge${tone ? ` badge-${tone}` : ''}`} title={title}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Empty({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="empty">
      <Icon aria-hidden="true" />
      {title && <div className="title">{title}</div>}
      {children && <div className="meta" style={{ fontSize: 'var(--t-13)', maxWidth: '44ch' }}>{children}</div>}
      {action}
    </div>
  );
}

export function Callout({ tone, icon: Icon = Info, children }) {
  return (
    <div className={`callout${tone ? ` ${tone}` : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} aria-hidden="true" />;
}

export function Tabs({ tabs, value, onChange, label }) {
  const onKey = (e, i) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          role="tab"
          className="tab"
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.count != null && <span className="count num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, active, children }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="page-enter">
      {children}
    </div>
  );
}

export function QualityBars({ value, label = 'Decision quality' }) {
  return (
    <span className="quality" role="img" aria-label={`${label}: ${value} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= value ? 'on' : ''} />
      ))}
    </span>
  );
}

// ---------- Toasts ----------
let toasts = [];
const toastListeners = new Set();
const emitToasts = () => toastListeners.forEach((l) => l());
export function toast(message, tone = 'success') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, message, tone }];
  emitToasts();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, 4200);
}
export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => {
      toastListeners.add(cb);
      return () => toastListeners.delete(cb);
    },
    () => toasts,
  );
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'error' ? <AlertTriangle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useMediaQuery(q) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

export function Logo({ size = 30 }) {
  // The BIZSIM "B" monogram, filled with the champagne-gold gradient of the theme.
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox={`0 0 ${MARK.w} ${MARK.h}`} height={size} width={(size * MARK.w) / MARK.h} aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--gold-1)" />
          <stop offset=".5" stopColor="var(--gold-2)" />
          <stop offset="1" stopColor="var(--gold-3)" />
        </linearGradient>
      </defs>
      <g transform={MARK.transform} fill={`url(#lg${id})`}>
        <path d={MARK.d} />
      </g>
    </svg>
  );
}

/**
 * Accessible modal dialog: rendered at the document root, focus moves inside on
 * open, Tab stays inside, Escape closes, and focus returns to where it was.
 */
export function Dialog({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    const focusables = () => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
    (focusables()[1] || focusables()[0] || el).focus?.();
    const k = (e) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.removeEventListener('keydown', k);
      prev?.focus?.();
    };
  }, []);
  // Rendered at the document root so panels with their own stacking contexts
  // can never paint over the dialog.
  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className={`dialog stack gap-4${wide ? ' dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h2 className="h3">{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
