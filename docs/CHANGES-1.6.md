# Files changed in 1.6.0

Compared with the 1.5.0 source release. Generated with a content hash comparison; build outputs and dependencies are not listed.

## Added (40)

* `client/public/hero/hero-800.webp`
* `client/public/hero/hero.webp`
* `client/src/components/CaseShare.jsx`
* `client/src/components/Collections.jsx`
* `client/src/components/evidence.jsx`
* `client/src/components/trust.jsx`
* `client/src/lib/files.js`
* `client/src/lib/native.js`
* `client/src/lib/notify.js`
* `client/src/lib/report.js`
* `client/src/lib/safe.js`
* `client/src/pages/Notifications.jsx`
* `docs/PACKAGE-FORMAT.md`
* `docs/PLAN-1.6.md`
* `docs/RELEASE-NOTES-1.6.md`
* `docs/SECURITY.md`
* `docs/VERIFICATION-1.6.md`
* `mobile/android-res/drawable/ic_stat_bizsim.xml`
* `scripts/check-sources.mjs`
* `shared/caseOfDay.js`
* `shared/caseSchema.js`
* `shared/contentClass.js`
* `shared/evidenceCheck.js`
* `shared/evidenceData.js`
* `shared/notifyPlan.js`
* `shared/package.js`
* `shared/sealed.js`
* `shared/sha256.js`
* `shared/stateSchema.js`
* `tests/daily.test.mjs`
* `tests/e2e/README.md`
* `tests/e2e/desktop.py`
* `tests/e2e/make-fixtures.mjs`
* `tests/e2e/pairing.py`
* `tests/e2e/play-all.py`
* `tests/e2e/upgrade.py`
* `tests/e2e/web.py`
* `tests/package.test.mjs`
* `tests/pairing.test.mjs`
* `tests/schema.test.mjs`

## Changed (36)

* `.gitignore`
* `README.md`
* `capacitor.config.json`
* `client/public/sw.js`
* `client/src/App.jsx`
* `client/src/components/Keys.jsx`
* `client/src/components/Shell.jsx`
* `client/src/components/Transfer.jsx`
* `client/src/components/content.jsx`
* `client/src/components/ui.jsx`
* `client/src/lib/api.js`
* `client/src/lib/chatStore.js`
* `client/src/lib/jobHandlers.js`
* `client/src/lib/sim.js`
* `client/src/lib/store.js`
* `client/src/main.jsx`
* `client/src/pages/CasePlayer.jsx`
* `client/src/pages/Dashboard.jsx`
* `client/src/pages/Research.jsx`
* `client/src/pages/Workspace.jsx`
* `client/src/styles/app.css`
* `client/vite.config.js`
* `electron/main.cjs`
* `electron/preload.cjs`
* `package-lock.json`
* `package.json`
* `scripts/prepare-mobile.mjs`
* `server/src/ai/caseSynth.js`
* `server/src/ai/chatBuilder.js`
* `server/src/config.js`
* `server/src/index.js`
* `server/src/jobs.js`
* `server/src/lib/http.js`
* `server/src/research/sources.js`
* `server/src/share.js`
* `shared/wikiImage.js`

## Native projects (11)

* `android/app/build.gradle`
* `android/app/capacitor.build.gradle`
* `android/app/src/main/AndroidManifest.xml`
* `android/app/src/main/assets/capacitor.config.json`
* `android/app/src/main/assets/capacitor.plugins.json`
* `android/capacitor.settings.gradle`
* `ios/App/App.xcodeproj/project.pbxproj`
* `ios/App/App/Info.plist`
* `ios/App/App/capacitor.config.json`
* `ios/App/CapApp-SPM/Package.swift`
* `android/app/src/main/res/drawable/ic_stat_bizsim.xml`

Nothing was removed.

# Known limitations

* Wi-Fi pairing traffic is signed but not encrypted, apart from AI keys (see docs/SECURITY.md). Use phone access on trusted networks.
* On desktop and in browsers, scheduled notifications are only shown while BIZSIM is open; missed ones appear in the inbox at the next start. Android and iPhone use the system scheduler but this was not tested on a device.
* iOS allows at most 64 pending local notifications; BIZSIM schedules up to 48 (about two weeks) and tops up whenever the app is opened.
* Android “Open with BIZSIM” only appears when the sending app labels the file `application/vnd.bizsim+json`; otherwise use *Import a season → Open .bizsim file*. Receiving a file shared to BIZSIM through the Android share sheet is not supported yet.
* A full season needs about 35 QR codes; sending the `.bizsim` file is faster.
* Evidence statuses come from matching dates, figures and names in the cited text. Paraphrased claims that use different wording are marked *not independently verified* even when the source supports them; a matching detail does not prove the claim. Most cited sources are Wikipedia articles (reference works).
* PDF reports use the built-in PDF fonts: letters outside Western European scripts are transliterated where possible and otherwise shown as “?”.
* React Router 6 is kept (the fix for an advisory needs the breaking upgrade to 7); in-app navigation from data is restricted to same-app paths as a mitigation.
* Windows, macOS and iOS builds were not run on their platforms for this release (docs/VERIFICATION-1.6.md).
