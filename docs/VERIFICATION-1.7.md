# Verification of 1.7.0

What was actually run for this release, and what was not. Run on Linux (Node 22, Chrome via
Playwright, Electron 45.3.4 under Xvfb) on 18 to 19 November 2026.

## Automated, passed

| Check | Result |
|---|---|
| `npm test` (unit and integration, includes the two new i18n test files) | 46 / 46 pass |
| `npm run i18n:check` (placeholders, markup, plural forms for each language, arrays, missing keys, unused keys, hard-coded text scan, season overlays) | 0 errors, 0 warnings |
| `node scripts/validate-content.mjs` | all curated content passed |
| `tests/e2e/i18n.py`, browser, desktop 1280 × 900 and phone 390 × 844 viewports | 86 / 86 checks |
| `tests/e2e/web.py` (1.6 regression suite) | 42 / 43; the one failure is an HTTP 429 rate limit returned by en.wikipedia.org to the test machine, not an app error |
| `tests/e2e/desktop.py` (Linux app, Electron 45) including two new 1.7 checks | 10 / 10 |
| Hard-coded text scanner sanity check (a planted English string was reported) | detected |

What the browser checks cover: language detection from the system language (bn-BD, en-GB, en-US,
nl-NL, ar-EG, pt-PT), searching and choosing a language in Settings, switching without reload,
progress byte-for-byte unchanged after switching, the choice surviving a reload, English season text
marked `lang="en"` inside a translated interface, Arabic `lang`/`dir`/computed direction and the
sidebar on the right, switching back to English, switching offline after the picker has been opened,
the Bengali season overlay and its machine-translation notice, and for all 16 language codes on six
pages at both viewport sizes: no raw translation keys visible and no horizontal page overflow.
96 screenshots were saved (16 languages × 3 pages × 2 sizes) plus RTL and overlay shots.

The desktop checks add: the Bengali interface after a page restart inside the app, and a Bengali and
Arabic HTML report converted to a real PDF by the app's offline Chromium engine, with a remote image
in the HTML blocked.

## Builds

Windows installer, macOS zips (x64, arm64, ad-hoc signed), Linux AppImage and tar.gz, Android APK
(versionCode 10700, signed with the same key as 1.6, so it installs over 1.6). Version 1.7.0 in each.
The iOS project is set to 1.7.0 (build 5); as before, the `.ipa` is built by GitHub Actions on macOS.

## Found and fixed during verification

- The six-step method bar on the home page overflowed the window by 52 px at 1280 px wide in
  English (and up to 217 px in French). It now wraps. This bug was already present in 1.6.
- Two test-script problems in the 1.6 e2e suite (an outdated button name and a typo) were fixed.

## Not verified

- **No translation has been reviewed by a native or fluent speaker.** Translations were checked
  only mechanically (placeholders, tags, plural forms, no leaked keys, no overflow). Wording,
  tone and terminology may be wrong. Every language is marked "machine-assisted, not yet reviewed".
- The Windows, macOS, Android and iOS builds were not run on real devices or emulators for this
  release. The phone checks used a 390 px mobile browser viewport, not the Capacitor apps.
- Screen readers were not tested with any language; `lang` and `dir` attributes were checked.
- AI output in other languages was not tested against a live AI provider (no provider key in the
  test environment). The language instruction and the locale plumbing are covered by unit tests.
- Glyph quality of PDF reports in CJK scripts depends on fonts installed on the user's device and
  was not inspected visually.
- Visual review of the screenshots was a spot check (English, Arabic, German, Bengali), not an
  exhaustive review of all 96.
