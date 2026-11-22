// BIZSIM desktop app (Windows, macOS, Linux).
// Runs the BIZSIM server inside the app on a fixed local port and opens the UI.
const { app, BrowserWindow, shell, Menu, ipcMain, dialog, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// ---------- Where BIZSIM keeps its data ----------
// The default folder (e.g. ~/.config/bizsim) always holds a small "location.json"
// pointer. If the user chose another data folder in Settings, everything else, // progress, keys, built seasons, images, lives there instead.
const DEFAULT_USER_DATA = app.getPath('userData');
const POINTER = path.join(DEFAULT_USER_DATA, 'location.json');
const readJson = (f, fallback = {}) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fallback;
  }
};
const pointer = readJson(POINTER);
if (pointer.userData && pointer.userData !== DEFAULT_USER_DATA) {
  try {
    fs.mkdirSync(pointer.userData, { recursive: true });
    app.setPath('userData', pointer.userData);
  } catch {
    /* folder unavailable (e.g. unplugged drive): fall back to the default */
  }
}
const prefsFile = () => path.join(DEFAULT_USER_DATA, 'desktop-preferences.json');
const prefs = () => readJson(prefsFile());
const savePrefs = (p) => {
  fs.mkdirSync(DEFAULT_USER_DATA, { recursive: true });
  fs.writeFileSync(prefsFile(), JSON.stringify({ ...prefs(), ...p }, null, 2));
};

// Optional API keys: KEY=value lines in bizsim.env (default folder or chosen data folder).
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

let win;
let serverPort;

// ---------- .bizsim files opened from the file manager ----------
// Files are read here (size-limited) and handed to the page as text; the page
// validates them like any other import. Queued until the page is ready.
const pendingPackages = [];
let rendererReady = false;
function packageFromPath(p) {
  try {
    if (typeof p !== 'string' || !/\.bizsim$/i.test(p)) return;
    const st = fs.statSync(p);
    if (!st.isFile() || st.size > 2_000_000) return;
    const text = fs.readFileSync(p, 'utf8');
    if (rendererReady && win) win.webContents.send('bizsim:open-package', text);
    else pendingPackages.push(text);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  } catch {
    /* unreadable file: ignore */
  }
}
ipcMain.on('bizsim:renderer-ready', (e) => {
  if (!win || e.sender !== win.webContents) return;
  rendererReady = true;
  while (pendingPackages.length) win.webContents.send('bizsim:open-package', pendingPackages.shift());
});
app.on('open-file', (e, p) => {
  e.preventDefault();
  packageFromPath(p);
});
process.argv.slice(1).forEach(packageFromPath);

// ---------- Bridge for Settings → Storage locations ----------
ipcMain.handle('bizsim:get-paths', () => ({
  dataFolder: app.getPath('userData'),
  defaultDataFolder: DEFAULT_USER_DATA,
  downloadFolder: prefs().downloadFolder || null,
  systemDownloads: app.getPath('downloads'),
  platform: process.platform,
}));

ipcMain.handle('bizsim:choose-download-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose where BIZSIM saves downloads', properties: ['openDirectory', 'createDirectory'], defaultPath: prefs().downloadFolder || app.getPath('downloads') });
  if (r.canceled || !r.filePaths[0]) return null;
  savePrefs({ downloadFolder: r.filePaths[0] });
  return r.filePaths[0];
});

ipcMain.handle('bizsim:reset-download-folder', () => {
  savePrefs({ downloadFolder: null });
  return true;
});

ipcMain.handle('bizsim:choose-data-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose a folder for BIZSIM data', properties: ['openDirectory', 'createDirectory'], defaultPath: app.getPath('userData') });
  if (r.canceled || !r.filePaths[0]) return { changed: false };
  const target = path.join(r.filePaths[0], 'BIZSIM');
  const current = app.getPath('userData');
  if (path.resolve(target) === path.resolve(current)) return { changed: false };
  await session.defaultSession.flushStorageData();
  fs.mkdirSync(target, { recursive: true });
  // Copy everything except Chromium lock and cache files, then point to the new folder.
  fs.cpSync(current, target, {
    recursive: true,
    force: true,
    filter: (src) => !/(^|[\\/])(SingletonLock|SingletonCookie|SingletonSocket|lockfile|LOCK|Cache|Code Cache|GPUCache|DawnCache|GrShaderCache|ShaderCache|location\.json)$/.test(src),
  });
  fs.writeFileSync(POINTER, JSON.stringify({ userData: target }, null, 2));
  return { changed: true, folder: target };
});

ipcMain.handle('bizsim:reset-data-folder', async () => {
  const current = app.getPath('userData');
  if (path.resolve(current) !== path.resolve(DEFAULT_USER_DATA)) {
    await session.defaultSession.flushStorageData();
    fs.cpSync(current, DEFAULT_USER_DATA, { recursive: true, force: true, filter: (src) => !/(^|[\\/])(SingletonLock|SingletonCookie|SingletonSocket|lockfile|LOCK|Cache|Code Cache|GPUCache|DawnCache|GrShaderCache|ShaderCache|location\.json)$/.test(src) });
  }
  fs.writeFileSync(POINTER, JSON.stringify({}, null, 2));
  return { changed: true, folder: DEFAULT_USER_DATA };
});

ipcMain.handle('bizsim:relaunch', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.handle('bizsim:open-folder', (e, p) => {
  // Only the data and download folders BIZSIM itself reports may be opened.
  const allowed = [app.getPath('userData'), DEFAULT_USER_DATA, prefs().downloadFolder, app.getPath('downloads')].filter(Boolean).map((x) => path.resolve(x));
  if (typeof p !== 'string' || !allowed.includes(path.resolve(p)) || !fs.existsSync(p)) return 'Folder not found';
  return shell.openPath(p);
});

// ---------- Reports: HTML to PDF ----------
// The page sends a self-contained report (text escaped, fonts as data URLs).
// It is printed in a hidden window with JavaScript off and every network
// request blocked, so the HTML can only ever be laid out, never run.
let pdfSessionReady = false;
ipcMain.handle('bizsim:html-to-pdf', async (e, html) => {
  if (!win || e.sender !== win.webContents) throw new Error('Not allowed');
  if (typeof html !== 'string' || html.length > 12_000_000) throw new Error('Report too large');
  const os = require('node:os');
  const crypto = require('node:crypto');
  const file = path.join(os.tmpdir(), `bizsim-report-${crypto.randomBytes(8).toString('hex')}.html`);
  fs.writeFileSync(file, html, 'utf8');
  const partition = 'bizsim-report';
  if (!pdfSessionReady) {
    const ses = session.fromPartition(partition);
    ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !(d.url.startsWith('data:') || (d.url.startsWith('file:') && /bizsim-report-[a-f0-9]{16}\.html$/.test(d.url))) }));
    ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
    pdfSessionReady = true;
  }
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false, partition } });
  pdfWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pdfWin.webContents.on('will-navigate', (ev) => ev.preventDefault());
  try {
    await pdfWin.loadFile(file);
    const buf = await pdfWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true });
    return new Uint8Array(buf);
  } finally {
    pdfWin.destroy();
    fs.rm(file, { force: true }, () => {});
  }
});

// ---------- Window ----------
async function createWindow() {
  const userData = app.getPath('userData');
  loadEnvFile(path.join(DEFAULT_USER_DATA, 'bizsim.env'));
  loadEnvFile(path.join(userData, 'bizsim.env'));
  process.env.BIZSIM_DATA_DIR = path.join(userData, 'data');
  process.env.BIZSIM_DESKTOP = '1';
  process.env.BIZSIM_CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

  const { startServer } = await import(pathToFileURL(path.join(__dirname, '..', 'server', 'src', 'index.js')).href);
  // A FIXED port matters: saved progress lives in browser storage, which is
  // keyed by origin (http://127.0.0.1:PORT). A random port would mean an
  // empty workspace on every launch.
  let server;
  for (const candidate of [47821, 47822, 47823, 47824, 47825]) {
    try {
      server = await startServer({ port: candidate, host: '127.0.0.1' });
      break;
    } catch (e) {
      if (e.code !== 'EADDRINUSE') throw e;
    }
  }
  if (!server) server = await startServer({ port: 0, host: '127.0.0.1' });
  serverPort = server.address().port;

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0B0C0E',
    title: 'BIZSIM',
    icon: path.join(__dirname, '..', 'client', 'public', 'icons', 'icon-512.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') },
  });
  // External links open in the system browser; only web and mail links.
  const openOutside = (url) => {
    try {
      if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) shell.openExternal(url);
    } catch {
      /* not a URL */
    }
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${serverPort}/`) && url !== `http://127.0.0.1:${serverPort}`) {
      e.preventDefault();
      openOutside(url);
    }
  });
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  win.webContents.on('did-start-navigation', (_e, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) rendererReady = false;
  });
  await win.loadURL(`http://127.0.0.1:${serverPort}/`);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    argv.slice(1).forEach(packageFromPath);
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  // Camera access for QR transfer and pairing.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(['media', 'clipboard-sanitized-write', 'fullscreen', 'notifications'].includes(permission)));
  // Downloads: save to the folder chosen in Settings, or ask every time.
  session.defaultSession.on('will-download', (event, item) => {
    const folder = prefs().downloadFolder;
    if (folder && fs.existsSync(folder)) {
      const parsed = path.parse(item.getFilename());
      let target = path.join(folder, parsed.base);
      for (let i = 1; fs.existsSync(target); i++) target = path.join(folder, `${parsed.name} (${i})${parsed.ext}`);
      item.setSavePath(target);
    } else {
      item.setSaveDialogOptions({ title: 'Save BIZSIM file', defaultPath: path.join(app.getPath('downloads'), item.getFilename()) });
    }
  });
});

if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
// Write progress to disk before quitting (Chromium writes storage lazily).
app.on('before-quit', () => {
  try {
    session.defaultSession.flushStorageData();
  } catch {
    /* nothing to flush */
  }
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
