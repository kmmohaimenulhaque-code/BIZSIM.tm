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

function cameraProblem(e) {
  if (!navigator.mediaDevices?.getUserMedia) return 'This device or browser does not give BIZSIM camera access here. Use a photo or the transfer code below.';
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'Camera permission was denied. Allow camera access for BIZSIM in the phone settings, or use a photo or the transfer code below.';
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'No usable camera was found. Use a photo or the transfer code below.';
  if (e?.name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return `Camera unavailable (${e?.message || 'unknown error'}). Use a photo or the transfer code below.`;
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
  return `${decisions} decisions, ${(p.myCases || []).length} cases, ${(p.savedCompanies || []).length} saved companies${own ? `, ${own} library items` : ''}${tagged ? `, ${tagged} tagged seasons` : ''}`;
}

function decodeProgressSync(code) {
  const kind = code[0];
  if (kind !== 'G' && kind !== 'J') throw new Error('This is not a BIZSIM transfer code.');
  let obj;
  try {
    const bytes = fromB64url(code.slice(1));
    obj = JSON.parse(kind === 'G' ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes));
  } catch {
    throw new Error('The transfer code is incomplete or damaged.');
  }
  if (!obj || typeof obj !== 'object') throw new Error('The transfer code holds no BIZSIM data.');
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
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [frames, paused]);

  const step = (d) => {
    setPaused(true);
    setIdx((i) => (i + d + frames.length) % frames.length);
  };

  return (
    <Dialog title="Send progress to another device" onClose={onClose}>
      <p className="muted">
        On the other device open BIZSIM, Settings, <strong>Receive progress</strong>, and point the camera at this screen. Turn the brightness up and keep both devices steady until every code is captured.
      </p>
      {error && <Callout tone="warning">Could not prepare the codes: {error}</Callout>}
      <div className="qr-frame qr-white">{frames[idx] ? <img src={frames[idx]} alt={`Transfer QR code ${idx + 1} of ${frames.length}`} /> : <div className="skeleton" style={{ width: 280, height: 280 }} />}</div>
      {frames.length > 1 && (
        <div className="row center gap-2">
          <Button size="sm" variant="ghost" icon={ChevronLeft} aria-label="Previous code" onClick={() => step(-1)} />
          <Button size="sm" icon={paused ? Play : Pause} onClick={() => setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button size="sm" variant="ghost" icon={ChevronRight} aria-label="Next code" onClick={() => step(1)} />
        </div>
      )}
      <div className="row between wrap gap-2 meta num">
        <span>{frames.length > 1 ? `Code ${idx + 1} of ${frames.length}${paused ? ' (paused)' : ', cycling automatically'}` : 'Single code'}</span>
        <span>{summary(payload)}</span>
      </div>
      <label className="row gap-2" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={includeCases} onChange={(e) => setIncludeCases(e.target.checked)} />
        <span>Include generated and built cases (more codes)</span>
      </label>
      <div className="row wrap gap-2">
        <Button
          icon={Copy}
          disabled={!code}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast('Transfer code copied. Paste it on the other device.');
            } catch {
              toast('Copy is blocked here. Use the QR codes instead.', 'error');
            }
          }}
        >
          Copy transfer code
        </Button>
      </div>
      <p className="meta">Nothing is uploaded. Codes contain only your BIZSIM progress and library, compressed.</p>
    </Dialog>
  );
}

// ---------- receiver ----------
function ReceiveDialog({ onClose }) {
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
      toast('Progress received and merged');
      return true;
    } catch (e) {
      partsRef.current = { sid: null, n: 0, got: new Map() };
      setCount({ got: 0, n: 0 });
      toast(`${e.message} Try again.`, 'error');
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
      if (/^https?:\/\/.*[#?&]pair=/.test(text)) warnOnce('That is a pairing code. Use Connect to a computer for it.');
      else if (text.startsWith('BZP1|')) warnOnce('That is a shared season. Use Import a season (in My cases or Settings) for it.');
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
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
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
      stream?.getTracks().forEach((t) => t.stop());
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
          toast(`No QR code found in ${file.name}`, 'error');
          continue;
        }
        found++;
        if (accept(text)) return;
      } catch {
        toast(`Could not open ${file.name}`, 'error');
      }
    }
    if (found && partsRef.current.n) toast(`${partsRef.current.got.size} of ${partsRef.current.n} codes captured. Add the rest.`);
  };

  return (
    <Dialog title="Receive progress" onClose={onClose}>
      {done ? (
        <Callout icon={Check}>
          Merged into this device: {done}. Nothing on this device was deleted.
        </Callout>
      ) : (
        <>
          <p className="muted">On the other device open Settings → <strong>Send progress</strong>, then scan the moving QR codes here.</p>
          {scanning ? (
            <div className="scan-wrap">
              <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label="Camera preview" />
              <span className="scan-target" aria-hidden="true" />
              <Button size="sm" className="scan-stop" onClick={() => setScanning(false)}>
                Stop
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="lg" icon={ScanLine} onClick={() => { setCamError(null); setScanning(true); }}>
              Scan with camera
            </Button>
          )}
          {count.n > 0 && (
            <div className="stack gap-2">
              <div className="row between meta num">
                <span>Codes captured</span>
                <span>
                  {count.got} / {count.n}
                </span>
              </div>
              {count.missing?.length > 0 && count.missing.length <= 12 && <span className="meta num">Still needed: {count.missing.map((i) => i + 1).join(', ')}</span>}
              <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={count.n} aria-valuenow={count.got}>
                <div className="progress-fill" style={{ width: `${(100 * count.got) / count.n}%` }} />
              </div>
            </div>
          )}
          {camError && <Callout tone="warning">{camError}</Callout>}
          <div className="row wrap gap-2">
            <label className="btn">
              <ImageUp aria-hidden="true" /> From photos or screenshots
              <input type="file" accept="image/*" multiple hidden onChange={(e) => fromImages([...e.target.files])} />
            </label>
          </div>
          <div className="field">
            <label htmlFor="paste-code">Or paste a transfer code</label>
            <textarea id="paste-code" className="input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="BZS1:…" />
            <Button
              icon={ClipboardPaste}
              disabled={!paste.trim().startsWith(`${PREFIX}:`)}
              onClick={() => accept(paste.trim())}
            >
              Import code
            </Button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} hidden />
    </Dialog>
  );
}

export function TransferPanel() {
  const [mode, setMode] = useState(null);
  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="tr-h">
      <h2 id="tr-h" className="section-title">
        Move to another device
      </h2>
      <p className="muted">Switching between phone, tablet and computer? Transfer your decisions, profile, saved companies and cases with QR codes, offline, no account. Progress is merged, never overwritten.</p>
      <div className="row wrap gap-2">
        <Button icon={QrCode} onClick={() => setMode('send')}>
          Send progress
        </Button>
        <Button icon={ScanLine} onClick={() => setMode('receive')}>
          Receive progress
        </Button>
        <Button variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent('bizsim:import', { detail: { manual: true } }))}>
          Import a shared season
        </Button>
      </div>
      <p className="meta">To share a single season or episode, open it and choose Share.</p>
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
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
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
        setError(cameraProblem(e));
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  return { videoRef, canvasRef, error };
}

function PairScanDialog({ onClose }) {
  const [manual, setManual] = useState('');
  const [state, setState] = useState({ phase: 'scan' }); // scan | connecting | done | error
  const connect = (text) => {
    setState({ phase: 'connecting' });
    pairFromUrl(text)
      .then((origin) => {
        refreshStatus();
        setState({ phase: 'done', origin });
        toast('Connected to your computer');
      })
      .catch((e) => setState({ phase: 'error', error: e.message }));
  };
  const tryPair = (text) => {
    const t = String(text).trim();
    if (t.startsWith('BZS1') || t.startsWith('BZP1')) {
      warnOnce('That is a transfer code, not a pairing code. Use Receive for it.');
      return false;
    }
    try {
      parsePairLink(t);
    } catch (e) {
      if (/older BIZSIM/.test(e.message)) warnOnce(e.message);
      return false;
    }
    connect(t);
    return true;
  };
  const { videoRef, canvasRef, error } = useCameraScan(state.phase === 'scan', tryPair);
  return (
    <Dialog title="Connect to a computer" onClose={onClose}>
      {state.phase === 'done' ? (
        <Callout icon={Check}>Connected to BIZSIM at {state.origin}. Live research and case building now run on your computer while both devices are on the same Wi‑Fi. You can remove this device on the computer at any time.</Callout>
      ) : state.phase === 'connecting' ? (
        <p className="muted" role="status">Connecting securely to your computer…</p>
      ) : (
        <>
          {state.phase === 'error' && (
            <Callout tone="warning">
              {state.error}{' '}
              <button type="button" className="link-btn" onClick={() => setState({ phase: 'scan' })}>
                Scan again
              </button>
            </Callout>
          )}
          <p className="muted">On your computer open BIZSIM → Settings → <strong>Use on your phone</strong>, turn it on, and scan the code it shows. Each code works once and expires after five minutes.</p>
          {state.phase === 'scan' && (
            <>
              <video ref={videoRef} className="scan-video" playsInline muted autoPlay aria-label="Camera preview" />
              <canvas ref={canvasRef} hidden />
            </>
          )}
          {error && <Callout tone="warning">{error.replace('Use a photo or the transfer code below.', '')} Paste the pairing link shown on the computer instead.</Callout>}
          <div className="field">
            <label htmlFor="pair-url">Or paste the pairing link</label>
            <input id="pair-url" className="input" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="http://192.168.1.5:47830/#pair=…" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} />
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
              Connect
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.round((until - now) / 1000)) : 0;
}

export function PhonePanel({ status }) {
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
    const t = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(t);
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
          <Wifi size={16} aria-hidden="true" /> Use on your phone
        </h2>
        <p className="muted">Let your phone or tablet use this computer’s BIZSIM (live research, case building and your API keys) over the same Wi‑Fi. Each pairing code works once and expires after five minutes. Paired devices sign every request; you can remove them here at any time.</p>
        <div className="row wrap gap-2">
          <Button variant={share?.enabled ? 'default' : 'primary'} icon={Smartphone} loading={busy} onClick={() => act(() => setShare(!share?.enabled))}>
            {share?.enabled ? 'Turn off phone access' : 'Turn on phone access'}
          </Button>
          {share?.enabled && (
            <Button variant="ghost" disabled={busy} onClick={() => act(newShareCode)}>
              New code
            </Button>
          )}
        </div>
        {share?.enabled && (
          <>
            {share.urls?.length ? (
              <>
                <div className="qr-frame">{qr && <img src={qr} alt="Pairing QR code for your phone" />}</div>
                <p className="meta" role="status" aria-live="polite">
                  {left > 0 ? `Code expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}. A new one appears automatically.` : 'Refreshing the code…'}
                </p>
                <p className="muted">
                  Scan with the <strong>BIZSIM phone app</strong> (Settings → Connect to a computer), or with the phone’s camera to open BIZSIM in its browser.
                </p>
                <div>
                  <button type="button" className="link-btn" onClick={() => setShowLink((v) => !v)} aria-expanded={showLink}>
                    {showLink ? 'Hide pairing link' : 'Show pairing link to copy'}
                  </button>
                  {showLink && (
                    <ul className="stack gap-1 meta" style={{ margin: 'var(--s2) 0 0', paddingLeft: 'var(--s4)', overflowWrap: 'anywhere' }}>
                      {share.urls.map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="meta">If the phone cannot connect, allow BIZSIM through your computer’s firewall when asked. Traffic on your Wi‑Fi is signed but not encrypted, so use phone access on networks you trust.</p>
              </>
            ) : (
              <Callout tone="warning">This computer is not connected to a private network (home or office Wi‑Fi).</Callout>
            )}
          </>
        )}
        <div className="stack gap-2">
          <h3 className="section-title" style={{ fontSize: 'var(--t-13)' }}>Paired devices</h3>
          {devices.length ? (
            <>
              <ul className="device-list">
                {devices.map((d) => (
                  <li key={d.fullId} className="row gap-2 between">
                    <span>
                      <strong>{d.device}</strong>
                      <span className="meta"> · last used {ago(d.lastSeen)}</span>
                    </span>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revokeShareDevice(d.fullId))} aria-label={`Remove ${d.device}`}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <div>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => revokeShareDevice('all'))}>
                  Remove all devices
                </Button>
              </div>
            </>
          ) : (
            <p className="meta">No devices paired.</p>
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
        <Laptop size={16} aria-hidden="true" /> Connect to a computer
      </h2>
      <p className="muted">Running BIZSIM on a computer too? Pair with it to use its live research and case building from this device over Wi‑Fi.</p>
      {paired && <p className="meta">Paired with {p.base} since {new Date(p.pairedAt).toLocaleDateString()}.</p>}
      <div className="row wrap gap-2">
        <Button icon={ScanLine} onClick={() => setScan(true)}>
          {paired ? 'Pair again' : 'Scan pairing code'}
        </Button>
        {paired && (
          <Button
            variant="ghost"
            onClick={async () => {
              await unpair();
              refreshStatus();
              toast('Disconnected from the computer');
              setScan(false);
            }}
          >
            Disconnect
          </Button>
        )}
      </div>
      {scan && <PairScanDialog onClose={() => setScan(false)} />}
    </section>
  );
}
