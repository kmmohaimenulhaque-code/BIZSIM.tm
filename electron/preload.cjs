// Exposes a small, safe API to the BIZSIM page for desktop-only settings.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bizsimDesktop', {
  getPaths: () => ipcRenderer.invoke('bizsim:get-paths'),
  chooseDownloadFolder: () => ipcRenderer.invoke('bizsim:choose-download-folder'),
  resetDownloadFolder: () => ipcRenderer.invoke('bizsim:reset-download-folder'),
  chooseDataFolder: () => ipcRenderer.invoke('bizsim:choose-data-folder'),
  resetDataFolder: () => ipcRenderer.invoke('bizsim:reset-data-folder'),
  openFolder: (p) => ipcRenderer.invoke('bizsim:open-folder', p),
  relaunch: () => ipcRenderer.invoke('bizsim:relaunch'),
  // Season reports in scripts the built-in PDF fonts cannot shape (Bengali,
  // Arabic, Hindi, CJK...) are rendered by Chromium. Returns the PDF bytes.
  htmlToPdf: (html) => ipcRenderer.invoke('bizsim:html-to-pdf', html),
  // .bizsim files opened from the file manager (file association) arrive here.
  onOpenPackage: (cb) => {
    const h = (_e, text) => typeof text === 'string' && cb(text);
    ipcRenderer.on('bizsim:open-package', h);
    ipcRenderer.send('bizsim:renderer-ready');
    return () => ipcRenderer.removeListener('bizsim:open-package', h);
  },
});
