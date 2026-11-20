# BIZSIM 1.6.0 verification report

Everything below was run on 18 Nov 2026 on a Linux build machine. “Not verified” means exactly that: the feature is implemented but was not run on that platform. Nothing here was assumed from a build succeeding.

## Platform matrix

| Platform | Built | How it was tested | Result |
|---|---|---|---|
| Web (Chrome, desktop size, dark) | Yes | Automated browser run against the production server: `tests/e2e/web.py`, 43 checks | 42 passed. The one failure was an HTTP 429 from Wikipedia's API during a cover lookup for an imported season (rate limit outside BIZSIM; the app fell back to its pattern cover). |
| Web (mobile size 390×844, light) | Yes | Same run: home, collections, notifications, a scriptural season | No horizontal overflow, no page errors |
| Linux desktop (AppImage, tar.gz) | Yes | Real app under Xvfb, driven over the DevTools protocol: `tests/e2e/desktop.py` | 8 of 8: Electron 45.3.4, no Node in the page, `.bizsim` file passed on the command line opens the import preview and imports, homepage image, phone-access controls, notification permission |
| Linux upgrade 1.5 → 1.6 | Yes | 1.5.0 AppImage made a decision, then 1.6.0 started on the same profile: `tests/e2e/upgrade.py` | Progress carried over (Electron 33 → 45 storage) |
| Wi-Fi pairing | Yes | Desktop-mode server plus a second browser as the phone: `tests/e2e/pairing.py` | 16 of 16 (see Security below) |
| Android | APK built and signed (v2/v3, versionCode 10600) | The built web bundle in a phone-sized Chrome with the native shell simulated (a simulated-shell sweep of 16 screens with and without a server). This found and fixed a real crash: returning a Capacitor plugin from an async function. Manifest checked: POST_NOTIFICATIONS, `.bizsim` intent filter, notification icon | Simulated shell: no crashes, no page errors. **Not verified on an Android device or emulator**: notification delivery with the app closed, the share sheet, “Open with BIZSIM”, the camera. |
| Windows | Installer built (NSIS, x64) | Contents checked (1.6 server, crypto, packages, homepage image, main process changes present) | **Not run.** No Windows machine was available. |
| macOS (Intel, Apple Silicon) | Zips built, ad-hoc signed with rcodesign | Bundle and Info.plist (`.bizsim` document type) inspected | **Not run.** No Mac available. Electron 45 needs macOS 12 or later. |
| iPhone / iPad | Xcode project synced (4 plugins, Info.plist: local networking only, `.bizsim` document type, MARKETING_VERSION 1.6.0, build 4) | None | **Not built, not run.** Apple only builds iOS apps on a Mac; the GitHub Actions job builds an unsigned `.ipa`. |

## Automated tests (`npm test`, Node test runner)

26 tests, 26 passed. They cover:

* **Content**: 200 seasons, unique season and decision ids, 2 to 4 decisions per episode; every curated season passes the import sanitiser unchanged.
* **Packages**: round trip for a season, an episode and an AI season; all 200 seasons export and re-import, as does every episode of 30 seasons; single and multipart QR in any order with repeats; missing parts; resume from saved state; frames from another package; corrupted frames; tampered, truncated, oversized, newer-schema, wrong-format, bad-kind and bad-id packages rejected; hostile content with a valid checksum still sanitised; duplicate, identical and conflicting imports; no secret or personal fields in packages.
* **Pairing**: pure-JS SHA-256 and HMAC equal Node's crypto on 10 sizes up to 70 KB; sealed keys round trip and detect any flipped bit or wrong key; valid, single-use, expired, wrong-secret, replayed and clock-skewed claims; valid, replayed, altered-body, altered-path, unknown, expired, revoked and rotated sessions with the grace period; sessions persist with file mode 0600; private-address filter; a real HTTP listener end to end (pairing, signed calls, sealed keys, plain keys refused, foreign origin refused, oversized body refused, phone ends its session, interrupted claim, lockout after repeated failures); secret redaction.
* **Storage**: backups with the wrong app or version refused; partial damage dropped and reported; links and image sources filtered; collections deduplicated; runs keep their decisions.
* **Notifications**: off by default; per-category switches; weekday and weekly frequency; quiet hours (no notification inside them); identical ids on re-planning (no duplicates); resume, custom days; past times skipped; immediate events respect switches and quiet hours.
* **Case of the Day**: deterministic per date, varies across days, “explore another” visits every season once per cycle, local date follows the time zone (UTC, Asia/Dhaka, America/Los_Angeles).

`npm run check` (content quality gates): all 200 seasons pass.

## Season playthrough

All 200 seasons were played start to finish in the production build (`tests/e2e/play-all.py`): every one had 8 decisions and 4 episode outcomes and showed the insight step. Two seasons timed out on the first try while three builds ran on the same machine; both passed when re-run.

## Source check

`scripts/check-sources.mjs` fetched all 358 cited sources (358 reachable) and checked 2,127 claims: 1,421 *verified against source*, 706 *source available, claim not independently verified*, 0 inaccessible, 0 insufficient.

## Security checks performed (browser, `tests/e2e/pairing.py`)

Pairing link carries the secret only after `#`; code expiry; countdown shown; a page on another origin gets 403 when reading the pairing code or changing keys; the secret is removed from the address bar; the phone stores a session, not the secret; unsigned calls refused (401); signed calls work; a captured request sent again is refused (“Repeated request refused”); the computer lists the device and can remove it; the removed phone is told and forgets the pairing; a used code is refused; *New code* rotates the secret; turning phone access off closes the listener.

## Clean clone

The source archive was unpacked into an empty folder, then `npm ci`, `npm test`, `npm run check` and `npm run build` were run there: dependencies installed from the lockfile, 26 of 26 tests passed, all 200 seasons passed the content checks, and the client built.

## Not verified

* Notification delivery on Android and iOS with the app closed, and after a reboot.
* Android share sheet, “Open with BIZSIM” from a file manager, camera scanning on a real phone.
* Anything on Windows, macOS, iPhone or iPad beyond the build.
* Screen-reader use (structure, labels and focus handling were implemented and reviewed in code, not tested with NVDA, VoiceOver or TalkBack).
