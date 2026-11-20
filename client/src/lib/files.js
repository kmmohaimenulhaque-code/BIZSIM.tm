// Saving and sharing files on every platform. Browsers and the desktop app use
// a normal download. Inside the Android and iPhone apps a blob download does
// nothing, so the file is written to the app's cache and handed to the system
// share sheet, where the user can save it to Files or Drive, or send it.
import { isNativeApp } from './api.js';

const toBase64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Save text or bytes (Uint8Array) under a file name. */
export async function saveFile(name, text, mime = 'application/json') {
  const safeName = String(name).replace(/[^\w.-]+/g, '-').slice(0, 120) || 'bizsim-file';
  const binary = text instanceof Uint8Array;
  if (isNativeApp()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile(binary ? { path: safeName, data: toBase64(text), directory: Directory.Cache, recursive: true } : { path: safeName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    try {
      await Share.share({ title: safeName, dialogTitle: 'Save or send', files: [res.uri] });
    } catch (e) {
      // Closing the share sheet is not an error.
      if (!/cancel/i.test(String(e?.message || e))) throw e;
      return 'cancelled';
    }
    return 'shared';
  }
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'downloaded';
}

/** Share a file through the system share sheet when available, else download it. */
export async function shareFile(name, text, mime = 'application/json') {
  if (!isNativeApp() && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([text], name, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      }
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  return saveFile(name, text, mime);
}

/** Read a user-chosen file as text with a size limit. */
export async function readFileText(file, maxBytes) {
  if (!file) throw new Error('No file chosen.');
  if (file.size > maxBytes) throw new Error(`That file is too large (${Math.round(file.size / 1024)} KB). The limit is ${Math.round(maxBytes / 1024)} KB.`);
  return file.text();
}
