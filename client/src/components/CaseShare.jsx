// Share one season or episode as a .bizsim file or a sequence of QR codes, and
// import them on another device. Works offline; nothing is uploaded.
// Packages are validated, integrity-checked and sanitised before a preview is
// shown, and nothing is stored or overwritten until the user confirms.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Share2, Download, ScanLine, ImageUp, FileUp, ClipboardPaste, Pause, Play, ChevronLeft, ChevronRight, ShieldCheck, Sparkles, Check, X as XIcon } from 'lucide-react';
import { Button, Callout, Dialog, Badge, toast } from './ui.jsx';
import { createPackage, packageToFrames, packageToText, packageFileName, readPackage, duplicateStatus, FrameCollector, MAX_FILE_BYTES } from '@shared/package.js';
import { episodesOf } from '@shared/episodes.js';
import { CASES } from '@shared/cases/index.js';
import { getState, importCase } from '../lib/store.js';
import { saveFile, shareFile, readFileText } from '../lib/files.js';
import { useCameraScan, readQr, loadImage } from './Transfer.jsx';
import { useTranslation, Trans, errorText } from '../i18n/index.js';
import { formatInteger, formatList, formatDateTime } from '../i18n/format.js';

const classShort = (t, id) => (id ? t(`contentClass.${id}.short`, { defaultValue: '' }) : '') || t('import.season');
const classLabel = (t, id) => (id ? t(`contentClass.${id}.label`, { defaultValue: id }) : '');

const CYCLE_MS = 800;
const RESUME_KEY = 'bizsim.pkgScan';
const BUILT_IN = new Set(CASES.map((c) => c.id));
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

// ---------- share ----------
export function ShareCaseDialog({ c, onClose }) {
  const { t } = useTranslation();
  const eps = useMemo(() => episodesOf(c), [c]);
  const [scope, setScope] = useState('season');
  const [frames, setFrames] = useState([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [frameError, setError] = useState(null);
  const built = useMemo(() => {
    try {
      return { pkg: createPackage(c, { episode: scope === 'season' ? undefined : Number(scope), appVersion: APP_VERSION }), error: null };
    } catch (e) {
      return { pkg: null, error: errorText(e) };
    }
  }, [c, scope]);
  const pkg = built.pkg;
  const error = built.error || frameError;

  useEffect(() => {
    let alive = true;
    setFrames([]);
    setIdx(0);
    setError(null);
    if (!pkg) return undefined;
    (async () => {
      try {
        const texts = packageToFrames(pkg);
        const urls = [];
        for (const x of texts) urls.push(await QRCode.toDataURL(x, { errorCorrectionLevel: 'M', margin: 2, width: 720, color: { dark: '#000000', light: '#ffffff' } }));
        if (alive) setFrames(urls);
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [pkg]);

  useEffect(() => {
    if (frames.length < 2 || paused) return undefined;
    const timer = setInterval(() => setIdx((i) => (i + 1) % frames.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [frames, paused]);

  const step = (d) => {
    setPaused(true);
    setIdx((i) => (i + d + frames.length) % frames.length);
  };
  const file = async (how) => {
    if (!pkg) return;
    try {
      const r = await (how === 'share' ? shareFile : saveFile)(packageFileName(pkg), packageToText(pkg), 'application/vnd.bizsim+json');
      if (r === 'downloaded') toast(t('share.saved'));
    } catch (e) {
      toast(t('share.saveFailed', { message: e.message }), 'error');
    }
  };

  return (
    <Dialog title={t('share.title')} onClose={onClose}>
      <div className="field">
        <label htmlFor="share-scope">{t('share.what')}</label>
        <select id="share-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="season">{t('share.whole', { count: eps.length })}</option>
          {eps.map((e) => (
            <option key={e.n} value={e.n}>
              {t('share.episode', { roman: e.roman, title: e.title })}
            </option>
          ))}
        </select>
      </div>
      {error && <Callout tone="warning">{error}</Callout>}
      {pkg && (
        <>
          <p className="muted">
            <Trans i18nKey="share.intro" components={{ strong: <strong /> }} />
          </p>
          <div className="qr-frame qr-white">{frames[idx] ? <img src={frames[idx]} alt={t('share.qrAlt', { i: formatInteger(idx + 1), n: formatInteger(frames.length) })} /> : <div className="skeleton" style={{ width: 280, height: 280 }} />}</div>
          {frames.length > 1 && (
            <div className="row center gap-2" dir="ltr">
              <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label={t('transfer.send.prev')} onClick={() => step(-1)} />
              <Button size="sm" icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
                {paused ? t('transfer.send.resume') : t('transfer.send.pause')}
              </Button>
              <Button size="sm" variant="ghost" icon={ChevronRight} aria-label={t('transfer.send.next')} onClick={() => step(1)} />
            </div>
          )}
          <p className="meta num" aria-live="polite">
            {frames.length > 1 ? t(paused ? 'transfer.send.codeOfPaused' : 'transfer.send.codeOf', { i: formatInteger(idx + 1), n: formatInteger(frames.length) }) : frames.length ? t('transfer.send.single') : t('share.preparing')}
          </p>
          <div className="row wrap gap-2">
            <Button icon={Share2} onClick={() => file('share')}>
              {t('share.shareFile')}
            </Button>
            <Button variant="ghost" icon={Download} onClick={() => file('save')}>
              {t('share.saveFile')}
            </Button>
          </div>
          <p className="meta">
            {t('share.packageLine', { id: pkg.id.slice(0, 8), kind: classLabel(t, pkg.classification) })}
            {pkg.ai.generated ? t('share.aiWritten') : ''}
            {t('share.integrityNote')}
          </p>
        </>
      )}
    </Dialog>
  );
}

// ---------- import ----------
function loadResume() {
  try {
    return JSON.parse(localStorage.getItem(RESUME_KEY) || 'null');
  } catch {
    return null;
  }
}
function saveResume(col) {
  try {
    if (col && col.count) localStorage.setItem(RESUME_KEY, JSON.stringify(col.toJSON()));
    else localStorage.removeItem(RESUME_KEY);
  } catch {
    /* storage full or unavailable: resume is a convenience */
  }
}

/** Opens the import flow for a file or text that arrived from outside (drop, file open). */
export function ImportCaseDialog({ onClose, initial }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const colRef = useRef(new FrameCollector(loadResume()));
  const [count, setCount] = useState({ got: colRef.current.count, n: colRef.current.n, missing: colRef.current.missing });
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null); // { pkg, case, warnings, dup }
  const [error, setError] = useState(null);
  const [paste, setPaste] = useState('');
  const fileRef = useRef(null);
  const canvasRef = useRef(null);

  const toPreview = (text) => {
    try {
      const r = readPackage(text);
      const s = getState();
      setPreview({ ...r, dup: duplicateStatus(r.case, { builtInIds: BUILT_IN, myCases: s.myCases }) });
      setError(null);
      setScanning(false);
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    }
  };
  useEffect(() => {
    if (initial) toPreview(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const sync = () => {
    const c = colRef.current;
    setCount({ got: c.count, n: c.n, missing: c.missing });
    saveResume(c);
  };
  const resetScan = () => {
    colRef.current = new FrameCollector();
    saveResume(null);
    sync();
  };
  /** Feed one scanned text. Returns true when scanning should stop. */
  const accept = (raw) => {
    const text = String(raw || '').trim();
    if (text.startsWith('{')) return toPreview(text);
    const r = colRef.current.add(text);
    if (r === 'added' || r === 'duplicate') {
      if (r === 'added') navigator.vibrate?.(15);
      sync();
      return false;
    }
    if (r === 'complete') {
      sync();
      try {
        const ok = toPreview(colRef.current.assemble());
        if (ok) resetScan();
        else resetScan();
        return true;
      } catch (e) {
        setError(errorText(e));
        resetScan();
        return true;
      }
    }
    if (r === 'other-package') {
      setError(t('import.otherPackage'));
      return false;
    }
    if (r === 'corrupt') return false; // a misread: the camera will catch the code again
    if (text.startsWith('BZS1')) setError(t('import.isProgress'));
    else if (/[#?&]pair=/.test(text)) setError(t('import.isPairing'));
    return false;
  };
  const { videoRef, canvasRef: camCanvas, error: camError } = useCameraScan(scanning, accept);

  const fromImages = async (files) => {
    for (const f of files) {
      try {
        const img = await loadImage(f);
        const text = readQr(canvasRef.current, img, img.width, img.height);
        if (text && accept(text)) break;
      } catch {
        /* skip unreadable pictures */
      }
    }
  };
  const fromFile = async (f) => {
    try {
      toPreview(await readFileText(f, MAX_FILE_BYTES));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const doImport = (mode) => {
    const { case: c, dup } = preview;
    if (mode === 'replace' && !window.confirm(t('import.confirmReplace', { title: dup.existing.title }))) return;
    const id = importCase(c, { mode });
    toast(mode === 'copy' ? t('import.copied') : t('import.imported'));
    onClose();
    navigate(`/cases/${encodeURIComponent(id)}`);
  };

  if (preview) {
    const { pkg, case: c, warnings, dup } = preview;
    const eps = episodesOf(c);
    return (
      <Dialog title={t('import.title')} onClose={onClose}>
        <div className="stack gap-2">
          <div className="badges">
            <Badge icon={ShieldCheck} tone="success" title={t('import.intactHint')}>
              {t('import.intact')}
            </Badge>
            <Badge>{classShort(t, c.contentClass || (c.classification === 'LIVE' ? 'live' : 'documented'))}</Badge>
            {(pkg.ai.generated || c.aiGenerated) && (
              <Badge tone="ai" icon={Sparkles}>
                {t('import.aiWritten')}
                {pkg.ai.model ? ` · ${pkg.ai.model}` : ''}
              </Badge>
            )}
          </div>
          <h3 className="h3" dir="auto">
            {c.title}
          </h3>
          <p className="meta">
            {t('import.meta', { company: c.company, year: c.yearLabel, episodes: t('import.episodes', { count: eps.length }), decisions: t('import.decisions', { count: c.checkpoints.length }), sources: t('import.sources', { count: c.sources.length }) })}
          </p>
          <p className="muted" dir="auto">
            {c.situation.headline}
          </p>
          <p className="meta">
            {t('import.shared', { kind: pkg.kind === 'episode' ? t('import.kindEpisode') : t('import.kindSeason'), date: pkg.createdAt ? formatDateTime(pkg.createdAt) : '' })}
            {pkg.appVersion ? t('import.from', { version: pkg.appVersion }) : ''}
            {t('import.trust')}
          </p>
          {warnings.length > 0 && (
            <details>
              <summary className="meta">{t('import.cleaned', { count: warnings.length })}</summary>
              <ul className="meta" lang="en">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {dup.status === 'builtin' ? (
          <>
            <Callout icon={Check}>{t('import.builtin')}</Callout>
            <div className="row gap-2 wrap">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/cases/${encodeURIComponent(c.id)}`);
                }}
              >
                {t('import.openIt')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t('import.close')}
              </Button>
            </div>
          </>
        ) : dup.status === 'identical' ? (
          <>
            <Callout icon={Check}>{t('import.identical')}</Callout>
            <div className="row gap-2 wrap">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/cases/${encodeURIComponent(dup.existing.id)}`);
                }}
              >
                {t('import.openIt')}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                {t('import.close')}
              </Button>
            </div>
          </>
        ) : dup.status === 'conflict' ? (
          <>
            <Callout tone="warning">{t('import.conflict', { title: dup.existing.title })}</Callout>
            <div className="row gap-2 wrap">
              <Button variant="primary" onClick={() => doImport('copy')}>
                {t('import.keepBoth')}
              </Button>
              <Button onClick={() => doImport('replace')}>{t('import.replaceMine')}</Button>
              <Button variant="ghost" onClick={onClose}>
                {t('import.cancel')}
              </Button>
            </div>
          </>
        ) : (
          <div className="row gap-2 wrap">
            <Button variant="primary" onClick={() => doImport('new')}>
              {t('import.importSeason')}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t('import.cancel')}
            </Button>
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog title={t('import.title')} onClose={onClose}>
      <p className="muted">{t('import.intro')}</p>
      {error && (
        <Callout tone="warning">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => setError(null)}>
            {t('import.dismiss')}
          </button>
        </Callout>
      )}
      {scanning ? (
        <div className="scan-wrap">
          <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label={t('transfer.cam.preview')} />
          <span className="scan-target" aria-hidden="true" />
          <Button size="sm" className="scan-stop" onClick={() => setScanning(false)}>
            {t('import.stop')}
          </Button>
        </div>
      ) : (
        <div className="row wrap gap-2">
          <Button
            variant="primary"
            icon={ScanLine}
            onClick={() => {
              setError(null);
              setScanning(true);
            }}
          >
            {count.got ? t('import.continueScan') : t('import.scan')}
          </Button>
          <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
            {t('import.openFile')}
          </Button>
          <label className="btn btn-ghost">
            <ImageUp aria-hidden="true" /> {t('import.fromPhotos')}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => fromImages([...e.target.files])} />
          </label>
          <input ref={fileRef} type="file" accept=".bizsim,application/json,application/vnd.bizsim+json" hidden onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
        </div>
      )}
      {camError && <Callout tone="warning">{camError}</Callout>}
      {count.n > 0 && (
        <div className="stack gap-2">
          <div className="row between meta num">
            <span>{loadResume() && !scanning && count.got < count.n ? t('import.capturedSaved') : t('import.captured')}</span>
            <span dir="ltr">
              {formatInteger(count.got)} / {formatInteger(count.n)}
            </span>
          </div>
          {count.missing?.length > 0 && count.missing.length <= 12 && <span className="meta num">{t('import.stillNeeded', { list: formatList(count.missing.map((i) => formatInteger(i + 1))) })}</span>}
          <div className="progress-track" dir="ltr" role="progressbar" aria-label={t('import.captured')} aria-valuemin={0} aria-valuemax={count.n} aria-valuenow={count.got}>
            <div className="progress-fill" style={{ width: `${(100 * count.got) / count.n}%` }} />
          </div>
          <div>
            <Button size="sm" variant="ghost" icon={XIcon} onClick={resetScan}>
              {t('import.startOver')}
            </Button>
          </div>
        </div>
      )}
      <details>
        <summary className="meta">{t('import.pasteInstead')}</summary>
        <div className="field mt-3">
          <label htmlFor="pkg-paste">{t('import.pasteLabel')}</label>
          <textarea id="pkg-paste" dir="ltr" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <Button icon={ClipboardPaste} disabled={!paste.trim().startsWith('{')} onClick={() => toPreview(paste.trim())}>
            {t('import.check')}
          </Button>
        </div>
      </details>
      <canvas ref={canvasRef} hidden />
      <canvas ref={camCanvas} hidden />
    </Dialog>
  );
}

/**
 * Listens for .bizsim files dropped on the window or opened from the system
 * (desktop file association, Android "open with"), and shows the import flow.
 */
export function ImportHost() {
  const [initial, setInitial] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = (text) => {
      setInitial(text);
      setOpen(true);
    };
    const onOpen = (e) => {
      if (typeof e.detail?.text === 'string') show(e.detail.text);
      else if (e.detail?.manual) {
        setInitial(null);
        setOpen(true);
      }
    };
    const isFileDrag = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    const onOver = (e) => {
      if (isFileDrag(e)) e.preventDefault();
    };
    const onDrop = async (e) => {
      const f = [...(e.dataTransfer?.files || [])].find((x) => /\.bizsim$/i.test(x.name));
      if (!f) return;
      e.preventDefault();
      try {
        show(await readFileText(f, MAX_FILE_BYTES));
      } catch (err) {
        toast(errorText(err), 'error');
      }
    };
    window.addEventListener('bizsim:import', onOpen);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    const off = window.bizsimDesktop?.onOpenPackage?.((text) => show(text));
    return () => {
      window.removeEventListener('bizsim:import', onOpen);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      off?.();
    };
  }, []);
  if (!open) return null;
  return (
    <ImportCaseDialog
      initial={initial}
      onClose={() => {
        setOpen(false);
        setInitial(null);
      }}
    />
  );
}

/** Open the import dialog from anywhere. */
export const openImport = () => window.dispatchEvent(new CustomEvent('bizsim:import', { detail: { manual: true } }));
