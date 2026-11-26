// Universal update UI components:
// - UpdateToast: gentle, auto-dismissing "Update to version x.x.x" banner in Shell
// - HomeUpdateBar: compact update strip/card on the Overview homescreen
// - UpdatesPanel: full universal update controls inside Settings
// On Desktop (Electron), downloads inside BIZSIM's own GUI, verifies SHA-256,
// and installs/restarts natively without opening a browser or cluttering Downloads.
import { Link } from 'react-router-dom';
import { ArrowUpCircle, CheckCircle2, Download, ExternalLink, RefreshCw, RotateCw, ShieldCheck, X } from 'lucide-react';
import { Badge, Button, toast } from './ui.jsx';
import {
  APP_VERSION,
  cancelNativeUpdate,
  checkForUpdates,
  dismissUpdateToast,
  installNativeUpdate,
  pauseUpdateToast,
  setUpdatePrefs,
  skipVersion,
  startNativeUpdate,
  useUpdateState,
} from '../lib/updater.js';
import { relTime } from '../lib/format.js';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Shared native download/verify/install controls for Desktop Electron GUI. */
function NativeUpdateControls({ u, r, compact = false }) {
  const d = u.download;
  const isBusy = d && (d.phase === 'downloading' || d.phase === 'verifying' || d.phase === 'installing');
  const isReady = d?.phase === 'ready' && d.version === r.latestVersion;

  const onStart = async () => {
    try {
      await startNativeUpdate();
    } catch (e) {
      toast(e?.message || 'Update download failed.', 'error');
    }
  };

  const onInstall = async () => {
    try {
      const res = await installNativeUpdate();
      if (res?.needsPermission) {
        toast('Allow "Install unknown apps" for BIZSIM, then tap Install again.');
      } else if (res?.mode === 'opened-installer') {
        toast('Verified installer opened. Follow the prompt to finish updating.');
      }
    } catch (e) {
      toast(e?.message || 'Could not install update.', 'error');
    }
  };

  if (d?.phase === 'downloading' || d?.phase === 'verifying') {
    const pct = d.phase === 'verifying' ? 100 : d.percent || 0;
    return (
      <div className="update-progress-wrap stack gap-2" style={{ minWidth: compact ? 220 : 280 }}>
        <div className="row between gap-2 meta num" style={{ alignItems: 'center' }}>
          <span>
            {d.phase === 'verifying'
              ? 'Verifying SHA-256 checksum…'
              : `Downloading v${r.latestVersion}… ${pct}%${d.total ? ` (${formatBytes(d.received)} / ${formatBytes(d.total)})` : ''}`}
          </span>
          {d.phase === 'downloading' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancelNativeUpdate} style={{ padding: '2px 8px', height: 'auto' }}>
              Cancel
            </button>
          )}
        </div>
        <div className="update-progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="update-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  if (d?.phase === 'installing') {
    return (
      <Button size="sm" variant="primary" loading disabled>
        Installing &amp; restarting…
      </Button>
    );
  }

  if (isReady) {
    return (
      <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
        <Button size="sm" variant="primary" icon={RotateCw} onClick={onInstall}>
          {d.canAutoRestart ? `Restart & install v${r.latestVersion}` : `Install v${r.latestVersion}`}
        </Button>
        {d.verified && (
          <span className="meta row gap-1" style={{ alignItems: 'center' }}>
            <ShieldCheck size={13} aria-hidden="true" /> SHA-256 verified
          </span>
        )}
      </div>
    );
  }

  return (
    <Button size="sm" variant="primary" icon={Download} loading={isBusy} onClick={onStart}>
      Update now
    </Button>
  );
}

/** Gentle, auto-dismissing toast shown when a newer BIZSIM release is available. */
export function UpdateToast() {
  const { toast: tItem } = useUpdateState();
  if (!tItem) return null;
  return (
    <div
      className="update-toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => pauseUpdateToast(true)}
      onMouseLeave={() => pauseUpdateToast(false)}
    >
      <ArrowUpCircle className="update-toast-icon" aria-hidden="true" />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="update-toast-title">Update to version {tItem.version}</div>
        <div className="meta">A new BIZSIM release is ready.</div>
      </div>
      <div className="row gap-2" style={{ flex: 'none' }}>
        <Link to="/settings#updates" className="btn btn-primary btn-sm" onClick={dismissUpdateToast}>
          Update
        </Link>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={dismissUpdateToast} aria-label="Dismiss update message">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Compact update option on the Overview homescreen. */
export function HomeUpdateBar() {
  const u = useUpdateState();
  const r = u.release;
  const hasUpdate = Boolean(r?.updateAvailable && u.skippedVersion !== r.latestVersion);

  const onCheck = async () => {
    const res = await checkForUpdates({ manual: true });
    if (!res) toast('Could not reach GitHub Releases right now.', 'error');
    else if (!res.updateAvailable) toast(`You are on the latest version (${APP_VERSION}).`);
  };

  if (hasUpdate) {
    const downloadHref = r.asset?.url || r.releaseUrl;
    const canNative = Boolean(u.nativeUpdater && r.asset?.url && r.asset?.name);
    return (
      <section className="panel update-home-bar has-update mt-5" aria-label="App update available">
        <div className="row between wrap gap-3" style={{ alignItems: 'center' }}>
          <div className="row gap-3" style={{ alignItems: 'center', minWidth: 0 }}>
            <ArrowUpCircle size={20} className="update-accent-icon" aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
                <strong style={{ fontWeight: 600 }}>Update to version {r.latestVersion}</strong>
                <Badge tone="accent">{u.platform.label}</Badge>
              </div>
              <div className="meta">
                Running v{APP_VERSION}
                {r.asset?.size ? ` · ${formatBytes(r.asset.size)}` : ''}
              </div>
              {u.download?.phase === 'error' && (
                <div className="meta" style={{ color: 'var(--danger)' }}>{u.download.error}</div>
              )}
            </div>
          </div>
          <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
            {canNative ? (
              <NativeUpdateControls u={u} r={r} compact />
            ) : (
              <a href={downloadHref} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                <Download size={14} aria-hidden="true" /> {r.asset ? `Download for ${u.platform.label}` : 'Get update'}
              </a>
            )}
            <Link to="/settings#updates" className="btn btn-ghost btn-sm">
              Settings
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="update-home-strip row between wrap gap-3 mt-4" aria-label="App version and updates">
      <span className="meta row gap-2" style={{ alignItems: 'center' }}>
        <CheckCircle2 size={14} aria-hidden="true" className="faint" />
        <span>
          BIZSIM v{APP_VERSION} · {u.platform.label}
          {u.lastCheckedAt ? ` · Checked ${relTime(u.lastCheckedAt)}` : ''}
        </span>
      </span>
      <div className="row gap-2">
        <Button size="sm" variant="ghost" icon={RefreshCw} loading={u.checking} onClick={onCheck}>
          {u.checking ? 'Checking…' : 'Check for updates'}
        </Button>
        <Link to="/settings#updates" className="btn btn-ghost btn-sm">
          Update settings
        </Link>
      </div>
    </div>
  );
}

/** Full universal update management panel inside Settings. */
export function UpdatesPanel() {
  const u = useUpdateState();
  const r = u.release;
  const hasUpdate = Boolean(r?.updateAvailable);
  const isSkipped = Boolean(hasUpdate && u.skippedVersion === r.latestVersion);
  const downloadHref = r?.asset?.url || r?.releaseUrl;
  const canNative = Boolean(hasUpdate && u.nativeUpdater && r?.asset?.url && r?.asset?.name);

  const onCheck = async () => {
    const res = await checkForUpdates({ manual: true });
    if (!res) toast('Could not reach GitHub Releases. Check your internet connection.', 'error');
    else if (res.updateAvailable) toast(`Update available: version ${res.latestVersion}`);
    else toast(`BIZSIM v${APP_VERSION} is up to date.`);
  };

  return (
    <section id="updates" className="panel panel-pad stack gap-4" aria-labelledby="upd-h">
      <div className="row between wrap gap-2" style={{ alignItems: 'center' }}>
        <h2 id="upd-h" className="section-title">
          App Updates
        </h2>
        {hasUpdate ? (
          <Badge tone="accent">Update available · v{r.latestVersion}</Badge>
        ) : (
          <Badge>v{APP_VERSION}</Badge>
        )}
      </div>

      <div className="row between wrap gap-3" style={{ alignItems: 'center' }}>
        <div className="stack gap-1">
          <div style={{ fontWeight: 500 }}>
            {hasUpdate
              ? `Version ${r.latestVersion} is available (installed: v${APP_VERSION})`
              : `BIZSIM v${APP_VERSION} is installed`}
          </div>
          <div className="meta">
            Platform: {u.platform.label}
            {u.lastCheckedAt ? ` · Last checked ${relTime(u.lastCheckedAt)}` : ' · Not checked yet'}
          </div>
        </div>
        <Button icon={RefreshCw} loading={u.checking} onClick={onCheck}>
          {u.checking ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>

      {u.error && <p className="meta" style={{ color: 'var(--danger)' }}>{u.error}</p>}

      {hasUpdate && (
        <div className="callout stack gap-3" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="row between wrap gap-2" style={{ alignItems: 'center' }}>
            <strong>Update to version {r.latestVersion}</strong>
            {r.asset?.name && (
              <span className="meta num">
                {r.asset.name}
                {r.asset.size ? ` (${formatBytes(r.asset.size)})` : ''}
              </span>
            )}
          </div>
          {r.summary && <p className="meta" style={{ margin: 0 }}>{r.summary}</p>}
          {u.download?.phase === 'error' && (
            <p className="meta" style={{ color: 'var(--danger)', margin: 0 }}>{u.download.error}</p>
          )}
          <div className="row wrap gap-2" style={{ alignItems: 'center' }}>
            {canNative ? (
              <NativeUpdateControls u={u} r={r} />
            ) : (
              <a href={downloadHref} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                <Download size={14} aria-hidden="true" />{' '}
                {r.asset ? `Download for ${u.platform.label}` : 'Open latest release'}
              </a>
            )}
            {u.platform.id === 'ios' && (
              <a
                href="altstore://source?url=https%3A%2F%2Fgithub.com%2Fkmmohaimenulhaque-code%2FBIZSIM.tm%2Freleases%2Flatest%2Fdownload%2Faltstore-source.json"
                className="btn btn-sm"
              >
                Add to AltStore <ExternalLink size={13} aria-hidden="true" />
              </a>
            )}
            <a href={r.releaseUrl} target="_blank" rel="noreferrer" className="btn btn-sm">
              Release notes <ExternalLink size={13} aria-hidden="true" />
            </a>
            {canNative && (
              <a href={downloadHref} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                Manual download
              </a>
            )}
            {r.checksumUrl && (
              <a href={r.checksumUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                <ShieldCheck size={14} aria-hidden="true" /> SHA256SUMS
              </a>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                skipVersion(isSkipped ? null : r.latestVersion);
                toast(isSkipped ? `Reminders resumed for v${r.latestVersion}` : `Skipped reminders for v${r.latestVersion}`);
              }}
            >
              {isSkipped ? 'Resume reminders' : 'Skip this version'}
            </Button>
          </div>
        </div>
      )}

      <div className="stack gap-2">
        <label className="row gap-3" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={u.autoCheck}
            onChange={(e) => setUpdatePrefs({ autoCheck: e.target.checked })}
            style={{ marginBlockStart: 3 }}
          />
          <span className="grow">
            <strong>Check for updates automatically</strong>
            <span className="meta" style={{ display: 'block' }}>
              Shows a brief “Update to version x.x.x” message when a new GitHub release is published.
            </span>
          </span>
        </label>

        <label className="row gap-3" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={u.dailyReminder}
            onChange={(e) => setUpdatePrefs({ dailyReminder: e.target.checked })}
            style={{ marginBlockStart: 3 }}
          />
          <span className="grow">
            <strong>Daily reminder if an update is ignored</strong>
            <span className="meta" style={{ display: 'block' }}>
              Sends one gentle daily notification until you update or skip that version. Respects quiet hours.
            </span>
          </span>
        </label>
      </div>

      <p className="meta" style={{ margin: 0 }}>
        Universal release check via GitHub Releases—downloads verify SHA-256 checksums automatically with no account or tracking.
      </p>
    </section>
  );
}
