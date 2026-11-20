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
import { CONTENT_CLASSES } from '@shared/contentClass.js';
import { episodesOf } from '@shared/episodes.js';
import { CASES } from '@shared/cases/index.js';
import { getState, importCase } from '../lib/store.js';
import { saveFile, shareFile, readFileText } from '../lib/files.js';
import { useCameraScan, readQr, loadImage } from './Transfer.jsx';

const CYCLE_MS = 800;
const RESUME_KEY = 'bizsim.pkgScan';
const BUILT_IN = new Set(CASES.map((c) => c.id));
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

// ---------- share ----------
export function ShareCaseDialog({ c, onClose }) {
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
      return { pkg: null, error: e.message };
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
        for (const t of texts) urls.push(await QRCode.toDataURL(t, { errorCorrectionLevel: 'M', margin: 2, width: 720, color: { dark: '#000000', light: '#ffffff' } }));
        if (alive) setFrames(urls);
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [pkg]);

  useEffect(() => {
    if (frames.length < 2 || paused) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [frames, paused]);

  const step = (d) => {
    setPaused(true);
    setIdx((i) => (i + d + frames.length) % frames.length);
  };
  const file = async (how) => {
    if (!pkg) return;
    try {
      const r = await (how === 'share' ? shareFile : saveFile)(packageFileName(pkg), packageToText(pkg), 'application/vnd.bizsim+json');
      if (r === 'downloaded') toast('Season file saved');
    } catch (e) {
      toast(`Could not save the file: ${e.message}`, 'error');
    }
  };

  return (
    <Dialog title="Share this season" onClose={onClose}>
      <div className="field">
        <label htmlFor="share-scope">What to share</label>
        <select id="share-scope" className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="season">Whole season ({eps.length} episodes)</option>
          {eps.map((e) => (
            <option key={e.n} value={e.n}>
              Episode {e.roman}: {e.title}
            </option>
          ))}
        </select>
      </div>
      {error && <Callout tone="warning">{error}</Callout>}
      {pkg && (
        <>
          <p className="muted">
            On the other device open <strong>My cases → Import a season</strong> and scan these codes, or send the .bizsim file. Only the season content is shared: never your progress, keys or settings.
          </p>
          <div className="qr-frame qr-white">{frames[idx] ? <img src={frames[idx]} alt={`Season QR code ${idx + 1} of ${frames.length}`} /> : <div className="skeleton" style={{ width: 280, height: 280 }} />}</div>
          {frames.length > 1 && (
            <div className="row center gap-2">
              <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Previous code" onClick={() => step(-1)} />
              <Button size="sm" icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
                {paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Next code" onClick={() => step(1)} />
            </div>
          )}
          <p className="meta num" aria-live="polite">
            {frames.length > 1 ? `Code ${idx + 1} of ${frames.length}${paused ? ' (paused)' : ', cycling automatically'}` : frames.length ? 'Single code' : 'Preparing codes…'}
          </p>
          <div className="row wrap gap-2">
            <Button icon={Share2} onClick={() => file('share')}>
              Share file
            </Button>
            <Button variant="ghost" icon={Download} onClick={() => file('save')}>
              Save .bizsim file
            </Button>
          </div>
          <p className="meta">
            Package {pkg.id.slice(0, 8)} · {CONTENT_CLASSES[pkg.classification]?.label}
            {pkg.ai.generated ? ' · AI-written' : ''}. The integrity check detects damaged transfers; it does not prove who made a file or that its content is accurate.
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
      setError(e.message);
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
        setError(e.message);
        resetScan();
        return true;
      }
    }
    if (r === 'other-package') {
      setError('These codes belong to a different season than the ones already scanned. Finish the first one, or cancel to start again.');
      return false;
    }
    if (r === 'corrupt') return false; // a misread: the camera will catch the code again
    if (text.startsWith('BZS1')) setError('That is a progress transfer, not a season. Use Settings → Receive progress.');
    else if (/[#?&]pair=/.test(text)) setError('That is a pairing code. Use Settings → Connect to a computer.');
    return false;
  };
  const { videoRef, canvasRef: camCanvas, error: camError } = useCameraScan(scanning, accept);

  const fromImages = async (files) => {
    for (const f of files) {
      try {
        const img = await loadImage(f);
        const t = readQr(canvasRef.current, img, img.width, img.height);
        if (t && accept(t)) break;
      } catch {
        /* skip unreadable pictures */
      }
    }
  };
  const fromFile = async (f) => {
    try {
      toPreview(await readFileText(f, MAX_FILE_BYTES));
    } catch (e) {
      setError(e.message);
    }
  };

  const doImport = (mode) => {
    const { case: c, dup } = preview;
    if (mode === 'replace' && !window.confirm(`Replace your copy of “${dup.existing.title}” with the imported version? Your earlier runs stay in your history.`)) return;
    const id = importCase(c, { mode });
    toast(mode === 'copy' ? 'Imported as a copy' : 'Season imported');
    onClose();
    navigate(`/cases/${encodeURIComponent(id)}`);
  };

  if (preview) {
    const { pkg, case: c, warnings, dup } = preview;
    const eps = episodesOf(c);
    return (
      <Dialog title="Import a season" onClose={onClose}>
        <div className="stack gap-2">
          <div className="badges">
            <Badge icon={ShieldCheck} tone="success" title="The package structure and integrity check passed. This does not prove who made it or that it is accurate.">
              File intact
            </Badge>
            <Badge>{CONTENT_CLASSES[c.contentClass || (c.classification === 'LIVE' ? 'live' : 'documented')]?.short || 'Season'}</Badge>
            {(pkg.ai.generated || c.aiGenerated) && (
              <Badge tone="ai" icon={Sparkles}>
                AI-written{pkg.ai.model ? ` · ${pkg.ai.model}` : ''}
              </Badge>
            )}
          </div>
          <h3 className="h3">{c.title}</h3>
          <p className="meta">
            {c.company} · {c.yearLabel} · {eps.length} episode{eps.length === 1 ? '' : 's'}, {c.checkpoints.length} decisions · {c.sources.length} sources
          </p>
          <p className="muted">{c.situation.headline}</p>
          <p className="meta">
            {pkg.kind === 'episode' ? 'A single episode' : 'A full season'}, shared {pkg.createdAt ? new Date(pkg.createdAt).toLocaleString() : ''}
            {pkg.appVersion ? ` from BIZSIM ${pkg.appVersion}` : ''}. Imported seasons come from whoever shared them: check the sources before relying on them.
          </p>
          {warnings.length > 0 && (
            <details>
              <summary className="meta">{warnings.length} item(s) were cleaned during the check</summary>
              <ul className="meta">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {dup.status === 'builtin' ? (
          <>
            <Callout icon={Check}>This season is already built into BIZSIM. Nothing needs importing.</Callout>
            <div className="row gap-2 wrap">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/cases/${encodeURIComponent(c.id)}`);
                }}
              >
                Open it
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : dup.status === 'identical' ? (
          <>
            <Callout icon={Check}>You already have this exact season.</Callout>
            <div className="row gap-2 wrap">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  navigate(`/cases/${encodeURIComponent(dup.existing.id)}`);
                }}
              >
                Open it
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : dup.status === 'conflict' ? (
          <>
            <Callout tone="warning">You have a different version of this season (“{dup.existing.title}”). Keep both, or replace yours. Nothing changes until you choose.</Callout>
            <div className="row gap-2 wrap">
              <Button variant="primary" onClick={() => doImport('copy')}>
                Keep both
              </Button>
              <Button onClick={() => doImport('replace')}>Replace mine</Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="row gap-2 wrap">
            <Button variant="primary" onClick={() => doImport('new')}>
              Import season
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        )}
      </Dialog>
    );
  }

  return (
    <Dialog title="Import a season" onClose={onClose}>
      <p className="muted">Scan the codes shown on the other device (Share this season), or open a .bizsim file. Imported files are checked before anything is saved.</p>
      {error && (
        <Callout tone="warning">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => setError(null)}>
            Dismiss
          </button>
        </Callout>
      )}
      {scanning ? (
        <div className="scan-wrap">
          <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label="Camera preview" />
          <span className="scan-target" aria-hidden="true" />
          <Button size="sm" className="scan-stop" onClick={() => setScanning(false)}>
            Stop
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
            {count.got ? 'Continue scanning' : 'Scan codes'}
          </Button>
          <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
            Open .bizsim file
          </Button>
          <label className="btn btn-ghost">
            <ImageUp aria-hidden="true" /> From photos
            <input type="file" accept="image/*" multiple hidden onChange={(e) => fromImages([...e.target.files])} />
          </label>
          <input ref={fileRef} type="file" accept=".bizsim,application/json,application/vnd.bizsim+json" hidden onChange={(e) => e.target.files?.[0] && fromFile(e.target.files[0])} />
        </div>
      )}
      {camError && <Callout tone="warning">{camError}</Callout>}
      {count.n > 0 && (
        <div className="stack gap-2">
          <div className="row between meta num">
            <span>Codes captured{loadResume() && !scanning && count.got < count.n ? ' (saved, you can continue later)' : ''}</span>
            <span>
              {count.got} / {count.n}
            </span>
          </div>
          {count.missing?.length > 0 && count.missing.length <= 12 && <span className="meta num">Still needed: {count.missing.map((i) => i + 1).join(', ')}</span>}
          <div className="progress-track" role="progressbar" aria-label="Codes captured" aria-valuemin={0} aria-valuemax={count.n} aria-valuenow={count.got}>
            <div className="progress-fill" style={{ width: `${(100 * count.got) / count.n}%` }} />
          </div>
          <div>
            <Button size="sm" variant="ghost" icon={XIcon} onClick={resetScan}>
              Cancel and start over
            </Button>
          </div>
        </div>
      )}
      <details>
        <summary className="meta">Paste package text instead</summary>
        <div className="field mt-3">
          <label htmlFor="pkg-paste">Package text (starts with {'{'})</label>
          <textarea id="pkg-paste" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} />
          <Button icon={ClipboardPaste} disabled={!paste.trim().startsWith('{')} onClick={() => toPreview(paste.trim())}>
            Check package
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
        toast(err.message, 'error');
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
