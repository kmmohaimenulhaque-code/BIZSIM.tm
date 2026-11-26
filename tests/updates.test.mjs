import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSemver,
  compareSemver,
  isNewerVersion,
  safeReleaseUrl,
  detectPlatform,
  selectReleaseAsset,
  normalizeRelease,
  releaseFromRedirectUrl,
} from '../shared/updateCheck.js';
import { planNotifications, DEFAULT_SETTINGS } from '../shared/notifyPlan.js';

const MOCK_RELEASE = {
  tag_name: 'v1.8.0',
  html_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/tag/v1.8.0',
  published_at: '2026-12-01T10:00:00Z',
  body: '### Highlights\n- Faster Live Research and new update checker.',
  assets: [
    { name: 'BIZSIM-Setup-1.8.0-windows-x64.exe', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-Setup-1.8.0-windows-x64.exe', size: 149000000 },
    { name: 'BIZSIM-1.8.0-mac-arm64.zip', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-1.8.0-mac-arm64.zip', size: 150000000 },
    { name: 'BIZSIM-1.8.0-mac-arm64.dmg', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-1.8.0-mac-arm64.dmg', size: 152000000 },
    { name: 'BIZSIM-1.8.0-mac-x64.zip', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-1.8.0-mac-x64.zip', size: 151000000 },
    { name: 'BIZSIM-1.8.0-mac-x64.dmg', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-1.8.0-mac-x64.dmg', size: 154000000 },
    { name: 'BIZSIM-1.8.0-linux-x86_64.AppImage', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-1.8.0-linux-x86_64.AppImage', size: 158000000 },
    { name: 'BIZSIM-v1.8.0-android.apk', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-v1.8.0-android.apk', size: 29500000 },
    { name: 'BIZSIM-v1.8.0-ios-unsigned.ipa', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/BIZSIM-v1.8.0-ios-unsigned.ipa', size: 26500000 },
    { name: 'SHA256SUMS.txt', browser_download_url: 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.8.0/SHA256SUMS.txt', size: 1024 },
    { name: 'evil.exe', browser_download_url: 'https://evil.example/evil.exe', size: 100 },
  ],
};

test('semver parsing and comparison handles v-prefix and prereleases', () => {
  assert.deepEqual(parseSemver('v1.7.3'), { major: 1, minor: 7, patch: 3, pre: [] });
  assert.equal(compareSemver('1.7.4', '1.7.3'), 1);
  assert.equal(compareSemver('v1.7.3', '1.7.3'), 0);
  assert.equal(compareSemver('1.7.2', '1.7.3'), -1);
  assert.equal(compareSemver('1.8.0', '1.8.0-rc.1'), 1);
  assert.equal(isNewerVersion('v1.8.0', '1.7.3'), true);
  assert.equal(isNewerVersion('v1.7.3', '1.7.3'), false);
});

test('safeReleaseUrl blocks non-HTTPS and non-GitHub hosts', () => {
  assert.ok(safeReleaseUrl('https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/latest'));
  assert.equal(safeReleaseUrl('http://github.com/foo/bar'), null);
  assert.equal(safeReleaseUrl('https://evil.example/BIZSIM.exe'), null);
  assert.equal(safeReleaseUrl('javascript:alert(1)'), null);
});

test('detectPlatform identifies all 6 native targets and web', () => {
  assert.equal(detectPlatform({ capacitorPlatform: 'android' }).id, 'android');
  assert.equal(detectPlatform({ capacitorPlatform: 'ios' }).id, 'ios');
  assert.equal(detectPlatform({ desktopPlatform: 'win32', desktopArch: 'x64' }).id, 'windows-x64');
  assert.equal(detectPlatform({ desktopPlatform: 'darwin', desktopArch: 'arm64' }).id, 'mac-arm64');
  assert.equal(detectPlatform({ desktopPlatform: 'darwin', desktopArch: 'x64' }).id, 'mac-x64');
  assert.equal(detectPlatform({ desktopPlatform: 'linux', desktopArch: 'x64' }).id, 'linux-x64');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0' }).id, 'web');
});

test('normalizeRelease matches exact platform asset and strips untrusted hosts', () => {
  const win = normalizeRelease(MOCK_RELEASE, '1.7.3', 'windows-x64');
  assert.equal(win.updateAvailable, true);
  assert.equal(win.latestVersion, '1.8.0');
  assert.equal(win.asset.name, 'BIZSIM-Setup-1.8.0-windows-x64.exe');
  assert.ok(win.checksumUrl.endsWith('SHA256SUMS.txt'));
  assert.equal(win.assets.some((a) => a.name === 'evil.exe'), false);

  assert.equal(selectReleaseAsset(win.assets, 'mac-arm64').name, 'BIZSIM-1.8.0-mac-arm64.zip');
  assert.equal(selectReleaseAsset(win.assets, 'mac-x64').name, 'BIZSIM-1.8.0-mac-x64.zip');
  assert.equal(selectReleaseAsset(win.assets, 'linux-x64').name, 'BIZSIM-1.8.0-linux-x86_64.AppImage');
  assert.equal(selectReleaseAsset(win.assets, 'android').name, 'BIZSIM-v1.8.0-android.apk');
  assert.equal(selectReleaseAsset(win.assets, 'ios').name, 'BIZSIM-v1.8.0-ios-unsigned.ipa');
});

test('planNotifications schedules daily appUpdate reminders when an update is pending', () => {
  const settings = {
    ...DEFAULT_SETTINGS,
    enabled: true,
    time: '10:00',
    categories: { caseOfDay: false, resume: false, weeklyGoal: false, seasonDone: false, researchDone: false, custom: false, appUpdate: true },
  };
  const plan = planNotifications(settings, {
    now: new Date(2026, 11, 1, 8, 0, 0),
    curatedIds: [],
    pendingUpdate: { version: '1.8.0', currentVersion: '1.7.3' },
  });
  const updates = plan.filter((n) => n.category === 'appUpdate');
  assert.equal(updates.length, 7);
  assert.equal(updates[0].title, 'Update to version 1.8.0');
  assert.equal(updates[0].link, '/settings');
});

test('releaseFromRedirectUrl extracts version from GitHub redirect URL without API quota', () => {
  const r = releaseFromRedirectUrl(
    'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/tag/v1.7.5',
    '1.7.4',
    'linux-x64',
  );
  assert.equal(r.latestVersion, '1.7.5');
  assert.equal(r.updateAvailable, true);
  assert.equal(r.releaseUrl, 'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/tag/v1.7.5');
  assert.equal(releaseFromRedirectUrl('https://evil.example/releases/tag/v9.9.9', '1.7.4'), null);
});
