// Native-app integration (Android and iPhone only): .bizsim files opened from
// other apps, and taps on BIZSIM notifications. Web and desktop do nothing here.
import { isNativeApp } from './api.js';

const MAX = 2_000_000;

async function openPackageUrl(url) {
  if (!/^(content|file):\/\//i.test(String(url || ''))) return;
  try {
    const { Filesystem, Encoding } = await import('@capacitor/filesystem');
    const r = await Filesystem.readFile({ path: url, encoding: Encoding.UTF8 });
    const text = typeof r.data === 'string' ? r.data : await r.data.text();
    if (text.length > MAX) throw new Error('too large');
    window.dispatchEvent(new CustomEvent('bizsim:import', { detail: { text } }));
  } catch {
    window.dispatchEvent(new CustomEvent('bizsim:import', { detail: { manual: true } }));
  }
}

export async function initNative() {
  if (!isNativeApp()) return;
  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', ({ url }) => openPackageUrl(url));
    const launch = await App.getLaunchUrl();
    if (launch?.url) openPackageUrl(launch.url);
  } catch {
    /* plugin unavailable in this build */
  }
}
