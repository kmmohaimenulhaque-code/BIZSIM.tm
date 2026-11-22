// Device-to-device progress transfer with QR codes, fully offline, no account.
// The sender shows a cycling sequence of QR codes; the receiver scans them with
// its camera (or reads photos/screenshots, or pastes a transfer code).
//
// Frame format: BZS1|<session>|<index>|<count>|<chunk>. The payload is JSON,
// gzip-compressed with fflate (works on every WebView, no CompressionStream
// needed), then base64url encoded. Frames are small (about 300 characters) and
// use medium error correction so phone cameras read them reliably off a screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';
import { QrCode, ScanLine, Copy, X, ImageUp, ClipboardPaste, Check, Smartphone, Laptop, Wifi, Pause, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Callout, Dialog, toast } from './ui.jsx';
import { transferPayload, mergeState } from '../lib/store.js';
import { getShare, setShare, newShareCode, revokeShareDevice, pairFromUrl, parsePairLink, pairing, unpair } from '../lib/api.js';
import { refreshStatus } from '../lib/useStatus.js';
import { useTranslation, Trans, t } from '../i18n/index.js';
import { formatInteger, formatList, formatRelative, formatDate } from '../i18n/format.js';

const PREFIX = 'BZS1';
export const CHUNK = 300;
const CYCLE_MS = 750;

// ---------- encoding ----------
const toB64url = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (str) => {
  const clean = str.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const b = atob(clean + '==='.slice((clean.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
export async function encodeProgress(obj) {
  return `G${toB64url(gzipSync(strToU8(JSON.stringify(obj)), { level: 9, mtime: 0 }))}`;
}
export async function decodeProgress(code) {
  return decodeProgressSync(code);
}
export function toFrames(code) {
  const sid = Math.random().toString(36).slice(2, 7);
  const n = Math.max(1, Math.ceil(code.length / CHUNK));
  return Array.from({ length: n }, (_, i) => `${PREFIX}|${sid}|${i}|${n}|${code.slice(i * CHUNK, (i + 1) * CHUNK)}`);
}
export function parseFrame(text) {
  const m = /^BZS1\|([a-z0-9]+)\|(\d+)\|(\d+)\|(.*)$/s.exec(String(text || '').trim());
  if (!m) return null;
  const f = { sid: m[1], i: +m[2], n: +m[3], data: m[4] };
  return f.n > 0 && f.i < f.n ? f : null;
}

/** Read a QR code from a video frame or image: centre crop first (sharper), then the whole picture. */
export function readQr(canvas, source, sw, sh) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tries = [];
  const side = Math.min(sw, sh);
  const centre = { sx: (sw - side) / 2, sy: (sh - side) / 2, sW: side, sH: side };
  // Several sizes: downscaling averages out camera noise, larger sizes keep dense codes sharp.
  tries.push({ ...centre, out: Math.min(side, 720) });
  tries.push({ ...centre, out: Math.min(side, 480) });
  tries.push({ sx: 0, sy: 0, sW: sw, sH: sh, out: Math.min(Math.max(sw, sh), 1280) });
  tries.push({ ...centre, out: Math.min(side, 1000) });
  for (const t of tries) {
    const scale = t.out / Math.max(t.sW, t.sH);
    const w = Math.max(1, Math.round(t.sW * scale));
    const h = Math.max(1, Math.round(t.sH * scale));
    canvas.width = w;
    canvas.height = h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, t.sx, t.sy, t.sW, t.sH, 0, 0, w, h);
    const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

// short: without the "use a photo or the transfer code" hint (for the pairing dialog).
function cameraProblem(e, short = false) {
  const s = short ? 'Short' : '';
  if (!navigator.mediaDevices?.getUserMedia) return t(`transfer.cam.noApi${s}`);
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return t(`transfer.cam.denied${s}`);
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return t(`transfer.cam.notFound${s}`);
  if (e?.name === 'NotReadableError') return t('transfer.cam.busy');
  return t(`transfer.cam.other${s}`, { message: e?.message || t('transfer.cam.unknown') });
}

async function openCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera API'), { name: 'NoApi' });
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) {
    if (e?.name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    throw e;
  }
}

function summary(p) {
  const decisions = (p.runs || []).reduce((a, r) => a + (r.choices?.length || 0), 0);
  const lib = p.library || {};
  const own = (lib.principles || []).length + (lib.books || []).length;
  const tagged = Object.keys(lib.tags || {}).length;
  const parts = [t('transfer.summary.decisions', { count: decisions }), t('transfer.summary.cases', { count: (p.myCases || []).length }), t('transfer.summary.companies', { count: (p.savedCompanies || []).length })];
  if (own) parts.push(t('transfer.summary.library', { count: own }));
  if (tagged) parts.push(t('transfer.summary.tagged', { count: tagged }));
  return formatList(parts);
}

function decodeProgressSync(code) {
  const kind = code[0];
  if (kind !== 'G' && kind !== 'J') throw new Error(t('transfer.notCode'));
  let obj;
  try {
    const bytes = fromB64url(code.slice(1));
    obj = JSON.parse(kind === 'G' ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes));
  } catch {
    throw new Error(t('transfer.damaged'));
  }
  if (!obj || typeof obj !== 'object') throw new Error(t('transfer.empty'));
  return obj;
}
const readyState = (v) => v.readyState >= 2;
// Camera loops see the same wrong code many times a second: warn once every few seconds.
let lastWarn = 0;
const warnOnce = (msg) => {
  if (Date.now() - lastWarn < 4000) return;
  lastWarn = Date.now();
  toast(msg, 'error');
};
export async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to an <img> element */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ---------- sender ----------
function SendDialog({ onClose }) {
  useTranslation();
  const [includeCases, setIncludeCases] = useState(true);
  const [frames, setFrames] = useState([]);
  const [code, setCode] = useState('');
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(null);
  const payload = useMemo(() => transferPayload({ includeCases }), [includeCases]);

  useEffect(() => {
    let alive = true;
    setFrames([]);
    (async () => {
      try {
        const c = await encodeProgress(payload);
        const texts = toFrames(c);
        const urls = [];
        for (const t of texts) urls.push(await QRCode.toDataURL(t, { errorCorrectionLevel: 'M', margin: 2, width: 720, color: { dark: '#000000', light: '#ffffff' } }));
        if (alive) {
          setCode(`${PREFIX}:${c}`);
          setFrames(urls);
          setIdx(0);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [payload]);

  useEffect(() => {
    if (frames.length < 2 || paused) return;
    const timer = setInterval(() => setIdx((i) => (i + 1) % frames.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [frames, paused]);

  const step = (d) => {
    setPaused(true);
    setIdx((i) => (i + d + frames.length) % frames.length);
  };

  return (
    <Dialog title={t('transfer.send.title')} onClose={onClose}>
      <p className="muted">
        <Trans i18nKey="transfer.send.intro" components={{ strong: <strong /> }} />
      </p>
      {error && <Callout tone="warning">{t('transfer.send.prepFailed', { error })}</Callout>}
      <div className="qr-frame qr-white">{frames[idx] ? <img src={frames[idx]} alt={t('transfer.send.qrAlt', { i: formatInteger(idx + 1), n: formatInteger(frames.length) })} /> : <div className="skeleton" style={{ width: 280, height: 280 }} />}</div>
      {frames.length > 1 && (
        <div className="row center gap-2" dir="ltr">
          <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label={t('transfer.send.prev')} onClick={() => step(-1)} />
          <Button size="sm" icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
            {paused ? t('transfer.send.resume') : t('transfer.send.pause')}
          </Button>
          <Button size="sm" variant="ghost" icon={ChevronRight} aria-label={t('transfer.send.next')} onClick={() => step(1)} />
        </div>
      )}
      <div className="row between wrap gap-2 meta num">
        <span>{frames.length > 1 ? t(paused ? 'transfer.send.codeOfPaused' : 'transfer.send.codeOf', { i: formatInteger(idx + 1), n: formatInteger(frames.length) }) : t('transfer.send.single')}</span>
        <span>{summary(payload)}</span>
      </div>
      <label className="row gap-2" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={includeCases} onChange={(e) => setIncludeCases(e.target.checked)} />
        <span>{t('transfer.send.includeCases')}</span>
      </label>
      <div className="row wrap gap-2">
        <Button
          icon={Copy}
          disabled={!code}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast(t('transfer.send.copied'));
            } catch {
              toast(t('transfer.send.copyBlocked'), 'error');
            }
          }}
        >
          {t('transfer.send.copy')}
        </Button>
      </div>
      <p className="meta">{t('transfer.send.privacy')}</p>
    </Dialog>
  );
}

// ---------- receiver ----------
function ReceiveDialog({ onClose }) {
  useTranslation();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const partsRef = useRef({ sid: null, n: 0, got: new Map() });
  const [count, setCount] = useState({ got: 0, n: 0 });
  const [camError, setCamError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(null);
  const [paste, setPaste] = useState('');

  const finish = (code) => {
    try {
      const p = decodeProgressSync(code);
      mergeState(p);
      setDone(summary(p));
      setScanning(false);
      toast(t('transfer.receive.merged'));
      return true;
    } catch (e) {
      partsRef.current = { sid: null, n: 0, got: new Map() };
      setCount({ got: 0, n: 0 });
      toast(t('transfer.receive.tryAgain', { message: e.message }), 'error');
      return false;
    }
  };

  /** Returns true when the transfer is complete. Never throws. */
  const accept = (raw) => {
    const text = String(raw || '').trim();
    if (!text) return false;
    if (text.startsWith(`${PREFIX}:`)) return finish(text.slice(PREFIX.length + 1));
    const f = parseFrame(text);
    if (!f) {
      if (/^https?:\/\/.*[#?&]pair=/.test(text)) warnOnce(t('transfer.receive.isPairing'));
      else if (text.startsWith('BZP1|')) warnOnce(t('transfer.receive.isSeason'));
      return false;
    }
    if (partsRef.current.sid !== f.sid || partsRef.current.n !== f.n) partsRef.current = { sid: f.sid, n: f.n, got: new Map() };
    if (!partsRef.current.got.has(f.i)) {
      partsRef.current.got.set(f.i, f.data);
      setCount({ got: partsRef.current.got.size, n: f.n, missing: Array.from({ length: f.n }, (_, i) => i).filter((i) => !partsRef.current.got.has(i)) });
      navigator.vibrate?.(15);
    }
    if (partsRef.current.got.size === f.n) return finish(Array.from({ length: f.n }, (_, i) => partsRef.current.got.get(i)).join(''));
    return false;
  };

  useEffect(() => {
    if (!scanning) return;
    let stream;
    let timer;
    let stopped = false;
    (async () => {
      try {
        stream = await openCamera();
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const tick = () => {
          if (stopped) return;
          try {
            if (v.videoWidth && readyState(v)) {
              const text = readQr(canvasRef.current, v, v.videoWidth, v.videoHeight);
              if (text && accept(text)) return;
            }
          } catch {
            /* a bad frame: keep scanning */
          }
          timer = setTimeout(tick, 140);
        };
        tick();
      } catch (e) {
        setCamError(cameraProblem(e));
        setScanning(false);
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const fromImages = async (files) => {
    let found = 0;
    for (const file of files) {
      try {
        const src = await loadImage(file);
        const text = readQr(canvasRef.current, src, src.width, src.height);
        if (!text) {
          toast(t('transfer.receive.noQr', { name: file.name }), 'error');
          continue;
        }
        found++;
        if (accept(text)) return;
      } catch {
        toast(t('transfer.receive.cantOpen', { name: file.name }), 'error');
      }
    }
    if (found && partsRef.current.n) toast(t('transfer.receive.partial', { got: formatInteger(partsRef.current.got.size), n: formatInteger(partsRef.current.n) }));
  };

  return (
    <Dialog title={t('transfer.receive.title')} onClose={onClose}>
      {done ? (
        <Callout icon={Check}>{t('transfer.receive.done', { summary: done })}</Callout>
      ) : (
        <>
          <p className="muted">
            <Trans i18nKey="transfer.receive.intro" components={{ strong: <strong /> }} />
          </p>
          {scanning ? (
            <div className="scan-wrap">
              <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label={t('transfer.cam.preview')} />
              <span className="scan-target" aria-hidden="true" />
              <Button size="sm" className="scan-stop" onClick={() => setScanning(false)}>
                {t('transfer.receive.stop')}
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" icon={ScanLine} onClick={() => { setCamError(null); setScanning(true); }}>
              {t('transfer.receive.scan')}
            </Button>
          )}
          {count.n > 0 && (
            <div className="stack gap-2">
              <div className="row between meta num">
                <span>{t('transfer.receive.captured')}</span>
                <span dir="ltr">
                  {formatInteger(count.got)} / {formatInteger(count.n)}
                </span>
              </div>
              {count.missing?.length > 0 && count.missing.length <= 12 && <span className="meta num">{t('transfer.receive.stillNeeded', { list: formatList(count.missing.map((i) => formatInteger(i + 1))) })}</span>}
              <div className="progress-track" dir="ltr" role="progressbar" aria-valuemin={0} aria-valuemax={count.n} aria-valuenow={count.got}>
                <div className="progress-fill" style={{ width: `${(100 * count.got) / count.n}%` }} />
              </div>
            </div>
          )}
          {camError && <Callout tone="warning">{camError}</Callout>}
          <div className="row wrap gap-2">
            <label className="btn">
              <ImageUp aria-hidden="true" /> {t('transfer.receive.fromPhotos')}
              <input type="file" accept="image/*" multiple hidden onChange={(e) => fromImages([...e.target.files])} />
            </label>
          </div>
          <div className="field">
            <label htmlFor="paste-code">{t('transfer.receive.paste')}</label>
            <textarea id="paste-code" dir="ltr" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="BZS1:…" />
            <Button
              icon={ClipboardPaste}
              disabled={!paste.trim().startsWith(`${PREFIX}:`)}
              onClick={() => accept(paste.trim())}
            >
              {t('transfer.receive.import')}
            </Button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} hidden />
    </Dialog>
  );
}

export function TransferPanel() {
  useTranslation();
  const [mode, setMode] = useState(null);
  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="tr-h">
      <h2 id="tr-h" className="section-title">
        {t('transfer.panel.title')}
      </h2>
      <p className="muted">{t('transfer.panel.intro')}</p>
      <div className="row wrap gap-2">
        <Button icon={QrCode} onClick={() => setMode('send')}>
          {t('transfer.panel.send')}
        </Button>
        <Button icon={ScanLine} onClick={() => setMode('receive')}>
          {t('transfer.panel.receive')}
        </Button>
        <Button variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('bizsim:import', { detail: { manual: true } }))}>
          {t('transfer.panel.importSeason')}
        </Button>
      </div>
      <p className="meta">{t('transfer.panel.single')}</p>
      {mode === 'send' && <SendDialog onClose={() => setMode(null)} />}
      {mode === 'receive' && <ReceiveDialog onClose={() => setMode(null)} />}
    </section>
  );
}

// ---------- Wi-Fi pairing: phone uses the computer's BIZSIM as its server ----------
export function useCameraScan(active, onText) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!active) return;
    let stream;
    let timer;
    let stopped = false;
    (async () => {
      try {
        stream = await openCamera();
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const tick = () => {
          if (stopped) return;
          try {
            if (v.videoWidth && readyState(v)) {
              const text = readQr(canvasRef.current, v, v.videoWidth, v.videoHeight);
              if (text && onText(text)) return;
            }
          } catch {
            /* keep scanning */
          }
          timer = setTimeout(tick, 150);
        };
        tick();
      } catch (e) {
        setError(cameraProblem(e, true));
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { videoRef, canvasRef, error };
}

function PairScanDialog({ onClose }) {
  useTranslation();
  const [manual, setManual] = useState('');
  const [state, setState] = useState({ phase: 'scan' }); // scan | connecting | done | error
  const connect = (text) => {
    setState({ phase: 'connecting' });
    pairFromUrl(text)
      .then((origin) => {
        refreshStatus();
        setState({ phase: 'done', origin });
        toast(t('transfer.pair.connected'));
      })
      .catch((e) => setState({ phase: 'error', error: e.message }));
  };
  const tryPair = (text) => {
    const v = String(text).trim();
    if (v.startsWith('BZS1') || v.startsWith('BZP1')) {
      warnOnce(t('transfer.pair.isTransfer'));
      return false;
    }
    try {
      parsePairLink(v);
    } catch (e) {
      if (e.code === 'oldCode') warnOnce(e.message);
      return false;
    }
    connect(v);
    return true;
  };
  const { videoRef, canvasRef, error } = useCameraScan(state.phase === 'scan', tryPair);
  return (
    <Dialog title={t('transfer.pair.title')} onClose={onClose}>
      {state.phase === 'done' ? (
        <Callout icon={Check}>{t('transfer.pair.done', { origin: state.origin })}</Callout>
      ) : state.phase === 'connecting' ? (
        <p className="muted" role="status">
          {t('transfer.pair.connecting')}
        </p>
      ) : (
        <>
          {state.phase === 'error' && (
            <Callout tone="warning">
              {state.error}{' '}
              <button type="button" className="link-btn" onClick={() => setState({ phase: 'scan' })}>
                {t('transfer.pair.scanAgain')}
              </button>
            </Callout>
          )}
          <p className="muted">
            <Trans i18nKey="transfer.pair.intro" components={{ strong: <strong /> }} />
          </p>
          {state.phase === 'scan' && (
            <>
              <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label={t('transfer.cam.preview')} />
              <canvas ref={canvasRef} hidden />
            </>
          )}
          {error && <Callout tone="warning">{t('transfer.pair.pasteInstead', { problem: error })}</Callout>}
          <div className="field">
            <label htmlFor="pair-url">{t('transfer.pair.pasteLabel')}</label>
            <input id="pair-url" dir="ltr" className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder={t('transfer.pair.placeholder')} inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} />
            <Button
              disabled={!manual.includes('pair=')}
              onClick={() => {
                try {
                  parsePairLink(manual);
                  connect(manual.trim());
                } catch (e) {
                  toast(e.message, 'error');
                }
              }}
            >
              {t('transfer.pair.connect')}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

const ago = (ms) => formatRelative(ms);

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  return until ? Math.max(0, Math.round((until - now) / 1000)) : 0;
}

export function PhonePanel({ status }) {
  useTranslation();
  const [share, setShareState] = useState(null);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const left = useCountdown(share?.enabled ? share.expiresAt : 0);

  useEffect(() => {
    if (!status?.desktop) return undefined;
    let stop = false;
    const load = () => getShare().then((s) => !stop && setShareState(s)).catch(() => {});
    load();
    // Keep the device list and code fresh while this panel is open.
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [status?.desktop]);
  useEffect(() => {
    if (share?.enabled && share.urls?.[0]) QRCode.toDataURL(share.urls[0], { margin: 1, width: 520, errorCorrectionLevel: 'M' }).then(setQr);
    else setQr(null);
  }, [share?.enabled, share?.urls?.[0]]);

  if (status?.desktop) {
    const act = async (fn) => {
      setBusy(true);
      try {
        setShareState(await fn());
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    };
    const devices = share?.devices || [];
    return (
      <section className="panel panel-pad stack gap-4" aria-labelledby="ph-h">
        <h2 id="ph-h" className="section-title row gap-2">
          <Wifi size={16} aria-hidden="true" /> {t('transfer.phone.title')}
        </h2>
        <p className="muted">{t('transfer.phone.intro')}</p>
        <div className="row wrap gap-2">
          <Button variant={share?.enabled ? 'default' : 'primary'} icon={Smartphone} loading={busy} onClick={() => act(() => setShare(!share?.enabled))}>
            {share?.enabled ? t('transfer.phone.turnOff') : t('transfer.phone.turnOn')}
          </Button>
          {share?.enabled && (
            <Button variant="ghost" disabled={busy} onClick={() => act(newShareCode)}>
              {t('transfer.phone.newCode')}
            </Button>
          )}
        </div>
        {share?.enabled && (
          <>
            {share.urls?.length ? (
              <>
                <div className="qr-frame">{qr && <img src={qr} alt={t('transfer.phone.qrAlt')} />}</div>
                <p className="meta" role="status" aria-live="polite">
                  {left > 0 ? t('transfer.phone.expires', { time: `${formatInteger(Math.floor(left / 60))}:${String(left % 60).padStart(2, '0')}` }) : t('transfer.phone.refreshing')}
                </p>
                <p className="muted">
                  <Trans i18nKey="transfer.phone.scanWith" components={{ strong: <strong /> }} />
                </p>
                <div>
                  <button type="button" className="link-btn" onClick={() => setShowLink((v) => !v)} aria-expanded={showLink}>
                    {showLink ? t('transfer.phone.hideLink') : t('transfer.phone.showLink')}
                  </button>
                  {showLink && (
                    <ul className="stack gap-1 meta" dir="ltr" style={{ margin: 'var(--s2) 0 0', paddingInlineStart: 'var(--s4)', overflowWrap: 'anywhere' }}>
                      {share.urls.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="meta">{t('transfer.phone.firewall')}</p>
              </>
            ) : (
              <Callout tone="warning">{t('transfer.phone.noNetwork')}</Callout>
            )}
          </>
        )}
        <div className="stack gap-2">
          <h3 className="section-title" style={{ fontSize: 'var(--t-13)' }}>{t('transfer.phone.paired')}</h3>
          {devices.length ? (
            <>
              <ul className="device-list">
                {devices.map((d) => (
                  <li key={d.fullId} className="row gap-2 between">
                    <span>
                      <strong dir="auto">{d.device}</strong>
                      <span className="meta">{t('transfer.phone.lastUsed', { when: ago(d.lastSeen) })}</span>
                    </span>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revokeShareDevice(d.fullId))} aria-label={t('transfer.phone.removeDevice', { device: d.device })}>
                      {t('transfer.phone.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
              <div>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revokeShareDevice('all'))}>
                  {t('transfer.phone.removeAll')}
                </Button>
              </div>
            </>
          ) : (
            <p className="meta">{t('transfer.phone.none')}</p>
          )}
        </div>
      </section>
    );
  }

  const p = pairing();
  const paired = Boolean(p);
  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="ph-h">
      <h2 id="ph-h" className="section-title row gap-2">
        <Laptop size={16} aria-hidden="true" /> {t('transfer.computer.title')}
      </h2>
      <p className="muted">{t('transfer.computer.intro')}</p>
      {paired && <p className="meta">{t('transfer.computer.pairedWith', { base: p.base, date: formatDate(p.pairedAt) })}</p>}
      <div className="row wrap gap-2">
        <Button icon={ScanLine} onClick={() => setScan(true)}>
          {paired ? t('transfer.computer.pairAgain') : t('transfer.computer.scan')}
        </Button>
        {paired && (
          <Button
            variant="ghost"
            onClick={async () => {
              await unpair();
              refreshStatus();
              toast(t('transfer.computer.disconnected'));
              setScan(false);
            }}
          >
            {t('transfer.computer.disconnect')}
          </Button>
        )}
      </div>
      {scan && <PairScanDialog onClose={() => setScan(false)} />}
    </section>
  );
}
