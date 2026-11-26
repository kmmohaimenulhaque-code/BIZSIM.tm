import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  validateInitialReleaseUrl,
  validateRedirectUrl,
  sanitizeAssetName,
  parseSha256Sums,
  sha256Matches,
  macAppBundlePath,
} = require('../electron/updater.cjs');

test('validateInitialReleaseUrl allows only official repo HTTPS release download URLs', () => {
  assert.ok(
    validateInitialReleaseUrl(
      'https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.8/BIZSIM-1.7.8-linux-x86_64.AppImage',
    ),
  );
  assert.equal(
    validateInitialReleaseUrl(
      'http://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.8/BIZSIM-1.7.8-linux-x86_64.AppImage',
    ),
    null,
  );
  assert.equal(
    validateInitialReleaseUrl('https://github.com/attacker/BIZSIM.tm/releases/download/v1.7.8/BIZSIM.AppImage'),
    null,
  );
  assert.equal(validateInitialReleaseUrl('https://127.0.0.1/BIZSIM.AppImage'), null);
  assert.equal(validateInitialReleaseUrl('https://evil.example/BIZSIM.exe'), null);
  assert.equal(validateInitialReleaseUrl('javascript:alert(1)'), null);
});

test('validateRedirectUrl restricts redirects to HTTPS GitHub CDN hosts', () => {
  assert.ok(validateRedirectUrl('https://objects.githubusercontent.com/github-production-release-asset-123/file'));
  assert.ok(validateRedirectUrl('https://release-assets.githubusercontent.com/some-asset'));
  assert.equal(validateRedirectUrl('http://objects.githubusercontent.com/file'), null);
  assert.equal(validateRedirectUrl('https://169.254.169.254/latest/meta-data/'), null);
  assert.equal(validateRedirectUrl('https://evil.example/redirect'), null);
});

test('sanitizeAssetName blocks path traversal, shell characters, and disallowed extensions', () => {
  assert.equal(sanitizeAssetName('BIZSIM-1.7.8-linux-x86_64.AppImage'), 'BIZSIM-1.7.8-linux-x86_64.AppImage');
  assert.equal(sanitizeAssetName('BIZSIM-Setup-1.7.8-windows-x64.exe'), 'BIZSIM-Setup-1.7.8-windows-x64.exe');
  assert.equal(sanitizeAssetName('BIZSIM-1.7.8-mac-arm64.dmg'), 'BIZSIM-1.7.8-mac-arm64.dmg');
  assert.equal(sanitizeAssetName('../BIZSIM-1.7.8-linux-x86_64.AppImage'), null);
  assert.equal(sanitizeAssetName('sub/BIZSIM-1.7.8-linux-x86_64.AppImage'), null);
  assert.equal(sanitizeAssetName('BIZSIM-1.7.8.sh'), null);
  assert.equal(sanitizeAssetName('BIZSIM-1.7.8;rm -rf.AppImage'), null);
});

test('parseSha256Sums and sha256Matches verify exact hashes with timing-safe comparison', () => {
  const hashA = 'a'.repeat(64);
  const hashB = 'b'.repeat(64);
  const sums = `${hashA}  BIZSIM-1.7.8-linux-x86_64.AppImage\n${hashB} *BIZSIM-Setup-1.7.8-windows-x64.exe\n`;
  assert.equal(parseSha256Sums(sums, 'BIZSIM-1.7.8-linux-x86_64.AppImage'), hashA);
  assert.equal(parseSha256Sums(sums, 'BIZSIM-Setup-1.7.8-windows-x64.exe'), hashB);
  assert.equal(parseSha256Sums(sums, 'missing.exe'), null);

  assert.equal(sha256Matches(hashA, hashA.toUpperCase()), true);
  assert.equal(sha256Matches(hashA, hashB), false);
  assert.equal(sha256Matches('short', hashA), false);
});

test('macAppBundlePath resolves enclosing .app bundle on macOS and returns null elsewhere', () => {
  assert.equal(macAppBundlePath('/Applications/BIZSIM.app/Contents/MacOS/BIZSIM'), '/Applications/BIZSIM.app');
  assert.equal(macAppBundlePath('/Users/alice/Apps/BIZSIM.app/Contents/MacOS/BIZSIM'), '/Users/alice/Apps/BIZSIM.app');
  assert.equal(macAppBundlePath('/usr/bin/node'), null);
});
