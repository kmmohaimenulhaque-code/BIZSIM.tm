// Native in-app desktop updater for Electron (Linux AppImage, Windows NSIS, macOS DMG/PKG).
// Zero external dependencies. Security guarantees:
// - Strict HTTPS-only GitHub release URL + repository prefix allowlist on every redirect hop
// - Strict asset filename allowlist (no path traversal, no unexpected extensions)
// - Hard 400 MB streaming byte cap
// - Streaming SHA-256 verification against the release's SHA256SUMS.txt (timing-safe)
// - Atomic in-place AppImage swap + detached relaunch (shell: false) on Linux
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const DEFAULT_REPO = 'kmmohaimenulhaque-code/BIZSIM.tm';
const ALLOWED_REDIRECT_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
]);
const ALLOWED_ASSET_RE = /^BIZSIM-[A-Za-z0-9._-]+\.(AppImage|exe|dmg|pkg|zip|tar\.gz)$/i;
const MAX_DOWNLOAD_BYTES = 400 * 1024 * 1024; // 400 MB hard cap
const MAX_CHECKSUM_BYTES = 256 * 1024; // 256 KB
const MAX_REDIRECTS = 6;

/** Validate an initial release download URL belongs strictly to our GitHub repo over HTTPS. */
function validateInitialReleaseUrl(rawUrl, repo = DEFAULT_REPO) {
  try {
    const u = new URL(String(rawUrl || '').trim());
    if (u.protocol !== 'https:') return null;
    if (u.hostname.toLowerCase() !== 'github.com') return null;
    if (u.username || u.password) return null;
    const prefix = `/${repo}/releases/download/`;
    if (!u.pathname.startsWith(prefix)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Validate any redirect target is strictly HTTPS on GitHub's official release CDN hosts. */
function validateRedirectUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || '').trim());
    if (u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    if (!ALLOWED_REDIRECT_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Validate and return a safe basename for a downloadable installer asset. */
function sanitizeAssetName(rawName) {
  if (typeof rawName !== 'string') return null;
  const base = path.basename(rawName.trim());
  if (base !== rawName.trim()) return null;
  if (base.includes('..') || !ALLOWED_ASSET_RE.test(base)) return null;
  return base;
}

/** Parse SHA256SUMS.txt and return the expected lowercase 64-hex SHA-256 for assetName. */
function parseSha256Sums(text, assetName) {
  const target = String(assetName || '').trim();
  if (!target) return null;
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line.trim());
    if (!m) continue;
    const file = path.basename(m[2].trim());
    if (file === target) return m[1].toLowerCase();
  }
  return null;
}

/** Timing-safe comparison of two 64-hex SHA-256 digests. */
function sha256Matches(actualHex, expectedHex) {
  if (typeof actualHex !== 'string' || typeof expectedHex !== 'string') return false;
  const a = actualHex.trim().toLowerCase();
  const b = expectedHex.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Resolve the enclosing .app bundle path on macOS (e.g. /Applications/BIZSIM.app), or null. */
function macAppBundlePath(execPath = process.execPath) {
  const p = String(execPath || '');
  const idx = p.indexOf('.app/Contents/MacOS/');
  return idx > 0 ? p.slice(0, idx + 4) : null;
}

/** Perform a streaming HTTPS GET following validated GitHub CDN redirects. */
function httpsGetStream(initialUrl, { maxRedirects = MAX_REDIRECTS, timeoutMs = 30_000, onReq } = {}) {
  return new Promise((resolve, reject) => {
    let hops = 0;
    const go = (currentUrl) => {
      const u = new URL(currentUrl);
      const req = https.request(
        {
          protocol: 'https:',
          hostname: u.hostname,
          port: 443,
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: {
            'User-Agent': 'BIZSIM/1.7 (https://github.com/kmmohaimenulhaque-code/BIZSIM.tm; desktop-updater)',
            Accept: '*/*',
          },
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            if (++hops > maxRedirects) return reject(new Error('Too many redirects while downloading update.'));
            const nextUrl = validateRedirectUrl(new URL(res.headers.location, currentUrl).toString());
            if (!nextUrl) return reject(new Error('Blocked redirect to non-GitHub host.'));
            return go(nextUrl);
          }
          if (status < 200 || status >= 300) {
            res.resume();
            return reject(new Error(`Download failed (HTTP ${status}).`));
          }
          resolve({ res, req });
        },
      );
      req.on('timeout', () => {
        req.destroy(new Error('Update download timed out.'));
      });
      req.on('error', reject);
      onReq?.(req);
      req.end();
    };
    go(initialUrl);
  });
}

async function fetchSmallText(url, repo = DEFAULT_REPO) {
  const safe = validateInitialReleaseUrl(url, repo);
  if (!safe) throw new Error('Invalid checksum URL.');
  const { res } = await httpsGetStream(safe, { timeoutMs: 15_000 });
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    res.on('data', (c) => {
      total += c.length;
      if (total > MAX_CHECKSUM_BYTES) {
        res.destroy(new Error('Checksum file too large.'));
        return;
      }
      chunks.push(c);
    });
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    res.on('error', reject);
  });
}

/**
 * Create a stateful desktop updater bound to the Electron app lifecycle.
 */
function createDesktopUpdater({ userDataDir, repo = DEFAULT_REPO, onProgress }) {
  const updatesDir = path.join(userDataDir, 'updates');
  let activeReq = null;
  let activeWrite = null;
  let canceled = false;
  let staged = null; // { filePath, assetName, version, sha256, verified }

  const emit = (payload) => {
    try {
      onProgress?.(payload);
    } catch {
      /* ignore closed window */
    }
  };

  function cancel() {
    canceled = true;
    try {
      activeReq?.destroy();
    } catch {
      /* ignore */
    }
    try {
      activeWrite?.destroy();
    } catch {
      /* ignore */
    }
    activeReq = null;
    activeWrite = null;
    emit({ phase: 'canceled', percent: 0 });
    return { canceled: true };
  }

  async function download({ url, assetName, version, checksumUrl }) {
    const safeUrl = validateInitialReleaseUrl(url, repo);
    if (!safeUrl) throw new Error('Blocked update URL: only official GitHub release downloads are allowed.');
    const safeName = sanitizeAssetName(assetName);
    if (!safeName) throw new Error('Invalid update package filename.');

    canceled = false;
    staged = null;
    fs.mkdirSync(updatesDir, { recursive: true });

    // Clean up older staged installers before starting
    for (const f of fs.readdirSync(updatesDir)) {
      if (f !== safeName) fs.rmSync(path.join(updatesDir, f), { force: true });
    }

    const finalPath = path.join(updatesDir, safeName);
    const partPath = `${finalPath}.part`;
    fs.rmSync(partPath, { force: true });

    emit({ phase: 'downloading', percent: 0, received: 0, total: 0, version, assetName: safeName });

    try {
      const { res } = await httpsGetStream(safeUrl, {
        timeoutMs: 45_000,
        onReq: (req) => {
          activeReq = req;
        },
      });
      const total = Number(res.headers['content-length'] || 0);
      const hash = crypto.createHash('sha256');
      const ws = fs.createWriteStream(partPath, { mode: 0o600 });
      activeWrite = ws;

      let received = 0;
      let lastEmit = 0;

      await new Promise((resolve, reject) => {
        const fail = (err) => {
          res.destroy();
          ws.destroy();
          reject(err);
        };
        res.on('data', (chunk) => {
          if (canceled) return fail(new Error('Update download canceled.'));
          received += chunk.length;
          if (received > MAX_DOWNLOAD_BYTES) {
            return fail(new Error('Update file exceeded maximum allowed size (400 MB).'));
          }
          hash.update(chunk);
          if (!ws.write(chunk)) {
            res.pause();
            ws.once('drain', () => res.resume());
          }
          const now = Date.now();
          if (now - lastEmit >= 120) {
            lastEmit = now;
            const percent = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0;
            emit({ phase: 'downloading', percent, received, total, version, assetName: safeName });
          }
        });
        res.on('end', () => ws.end());
        res.on('error', fail);
        ws.on('error', fail);
        ws.on('finish', resolve);
      });

      activeReq = null;
      activeWrite = null;

      if (canceled) {
        fs.rmSync(partPath, { force: true });
        return { ok: false, canceled: true };
      }

      const actualSha = hash.digest('hex');
      let verified = false;

      if (checksumUrl) {
        emit({ phase: 'verifying', percent: 100, received, total: total || received, version, assetName: safeName });
        const sumsText = await fetchSmallText(checksumUrl, repo);
        const expectedSha = parseSha256Sums(sumsText, safeName);
        if (!expectedSha) {
          fs.rmSync(partPath, { force: true });
          throw new Error(`Could not find ${safeName} in SHA256SUMS.txt.`);
        }
        if (!sha256Matches(actualSha, expectedSha)) {
          fs.rmSync(partPath, { force: true });
          throw new Error('Integrity check failed: downloaded file SHA-256 does not match SHA256SUMS.txt.');
        }
        verified = true;
      }

      fs.renameSync(partPath, finalPath);
      if (process.platform === 'linux' && /\.AppImage$/i.test(safeName)) {
        fs.chmodSync(finalPath, 0o755);
      }

      staged = { filePath: finalPath, assetName: safeName, version, sha256: actualSha, verified };
      emit({
        phase: 'ready',
        percent: 100,
        received,
        total: total || received,
        version,
        assetName: safeName,
        verified,
        canAutoRestart: Boolean(
          (process.platform === 'linux' && process.env.APPIMAGE && /\.AppImage$/i.test(safeName)) ||
            (process.platform === 'win32' && /\.exe$/i.test(safeName)) ||
            (process.platform === 'darwin' && /\.zip$/i.test(safeName) && Boolean(macAppBundlePath())),
        ),
      });
      return { ok: true, ...staged };
    } catch (e) {
      activeReq = null;
      activeWrite = null;
      fs.rmSync(partPath, { force: true });
      if (canceled) return { ok: false, canceled: true };
      const msg = e?.message || 'Update download failed.';
      emit({ phase: 'error', error: msg, version, assetName: safeName });
      throw new Error(msg);
    }
  }

  /**
   * Apply the verified staged update natively and restart/quit the app.
   */
  async function installAndRestart({ app, shell, session }) {
    if (!staged || !fs.existsSync(staged.filePath)) {
      throw new Error('No downloaded update is ready to install.');
    }
    const { filePath, assetName, version } = staged;
    emit({ phase: 'installing', percent: 100, version, assetName });

    try {
      await session?.defaultSession?.flushStorageData?.();
    } catch {
      /* best effort */
    }

    // 1. Linux AppImage: atomic in-place self-replacement + detached relaunch
    if (process.platform === 'linux' && /\.AppImage$/i.test(assetName)) {
      const currentAppImage = process.env.APPIMAGE ? path.resolve(process.env.APPIMAGE) : null;
      if (currentAppImage && fs.existsSync(currentAppImage)) {
        const targetDir = path.dirname(currentAppImage);
        const tempSwap = path.join(targetDir, `.${path.basename(currentAppImage)}.update-${Date.now()}`);
        try {
          fs.copyFileSync(filePath, tempSwap);
          fs.chmodSync(tempSwap, 0o755);
          fs.renameSync(tempSwap, currentAppImage); // Atomic POSIX replace
          fs.rmSync(filePath, { force: true });
        } catch (err) {
          fs.rmSync(tempSwap, { force: true });
          throw new Error(`Could not replace AppImage (${err.message}). Make sure the folder is writable.`);
        }
        const child = spawn(currentAppImage, [], {
          detached: true,
          stdio: 'ignore',
          shell: false,
          env: { ...process.env },
        });
        child.unref();
        setTimeout(() => app.exit(0), 250);
        return { ok: true, mode: 'appimage-relaunch' };
      }
      // Running from source (`npm run desktop`) or extracted tar.gz: launch the new AppImage directly
      fs.chmodSync(filePath, 0o755);
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore', shell: false });
      child.unref();
      setTimeout(() => app.exit(0), 250);
      return { ok: true, mode: 'appimage-launch' };
    }

    // 2. Windows NSIS installer: launch detached and exit so installer replaces files & relaunches
    if (process.platform === 'win32' && /\.exe$/i.test(assetName)) {
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore', shell: false });
      child.unref();
      setTimeout(() => app.quit(), 300);
      return { ok: true, mode: 'windows-installer' };
    }

    // 3. macOS (.zip): extract verified BIZSIM.app with ditto, atomically swap bundle, and relaunch
    if (process.platform === 'darwin' && /\.zip$/i.test(assetName)) {
      const currentApp = macAppBundlePath();
      if (currentApp && fs.existsSync(currentApp)) {
        const parentDir = path.dirname(currentApp);
        let writable = false;
        try {
          fs.accessSync(parentDir, fs.constants.W_OK);
          writable = true;
        } catch {
          writable = false;
        }
        if (writable) {
          const extractDir = path.join(updatesDir, `mac-stage-${Date.now()}`);
          fs.mkdirSync(extractDir, { recursive: true });
          try {
            execFileSync('/usr/bin/ditto', ['-xk', filePath, extractDir], { timeout: 60_000 });
            const newApp = path.join(extractDir, 'BIZSIM.app');
            if (!fs.existsSync(newApp)) throw new Error('BIZSIM.app not found inside update archive.');
            try {
              execFileSync('/usr/bin/xattr', ['-cr', newApp], { timeout: 10_000 });
            } catch {
              /* xattr optional */
            }
            const backupApp = `${currentApp}.old-${Date.now()}`;
            // Detached swap helper waits for current Electron PID to exit, swaps bundle, relaunches via `open`
            const swapScript = [
              'PID="$1"; CUR="$2"; NEW="$3"; BAK="$4"; STAGE="$5"; ZIP="$6"',
              'for i in $(seq 1 60); do kill -0 "$PID" 2>/dev/null || break; sleep 0.25; done',
              'mv "$CUR" "$BAK" && mv "$NEW" "$CUR" && rm -rf "$BAK" "$STAGE" "$ZIP" && /usr/bin/open -n "$CUR"',
              'if [ ! -d "$CUR" ] && [ -d "$BAK" ]; then mv "$BAK" "$CUR"; fi',
            ].join('; ');
            const child = spawn('/bin/sh', ['-c', swapScript, '_', String(process.pid), currentApp, newApp, backupApp, extractDir, filePath], {
              detached: true,
              stdio: 'ignore',
              shell: false,
            });
            child.unref();
            setTimeout(() => app.exit(0), 250);
            return { ok: true, mode: 'mac-relaunch' };
          } catch {
            fs.rmSync(extractDir, { recursive: true, force: true });
            /* fall back to opening the verified archive natively */
          }
        }
      }
    }

    // 4. Fallback (read-only macOS /Applications, .dmg/.pkg, or Linux .tar.gz): open verified file natively
    const errMsg = await shell.openPath(filePath);
    if (errMsg) throw new Error(errMsg);
    return { ok: true, mode: 'opened-installer', filePath };
  }

  return {
    download,
    cancel,
    installAndRestart,
    getStaged: () => staged,
  };
}

module.exports = {
  DEFAULT_REPO,
  validateInitialReleaseUrl,
  validateRedirectUrl,
  sanitizeAssetName,
  parseSha256Sums,
  sha256Matches,
  macAppBundlePath,
  createDesktopUpdater,
};
