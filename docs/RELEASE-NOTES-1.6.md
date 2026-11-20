# BIZSIM 1.6.0 release notes

1.6 is about trust: knowing what kind of account a season is, how well its claims match its sources, and that your devices, keys and data are safe. It also adds season sharing, collections, a Case of the Day and opt-in notifications. All 1.5 progress, seasons and settings carry over.

## New

* **Share any season or episode.** *Share* on a season makes a `.bizsim` file or a sequence of QR codes, for curated seasons and for seasons from live research and the chat builder. *My cases → Import a season* scans the codes (camera or photos), opens the file, or takes a dropped file; desktop apps open `.bizsim` files directly. A preview shows what is inside before anything is saved, duplicates are detected, and a different version is never overwritten without asking. QR imports can be resumed after closing the dialog. Format: [docs/PACKAGE-FORMAT.md](PACKAGE-FORMAT.md).
* **Notifications (off until you turn them on).** A daily **Case of the Day**, a reminder to resume a season you started, a weekly goal, a note when a season is complete and when background research finishes, and your own reminders. Per-category switches, daily time, frequency, quiet hours, weekly goal, mark read, clear, turn everything off. Scheduled on the device: on Android and iPhone they arrive with the app closed; on desktop and web they appear while BIZSIM is open, and anything missed shows up in the inbox. No account, no push service.
* **Case of the Day** on the home screen: the same season for everyone on a given date, chosen by your local date, works offline, with *Explore another*. AI-written seasons of your own are listed separately and labelled.
* **Collections and bookmarks.** Save seasons, episodes, decisions, principles and companies. Default collections (Startup Strategy, Crisis Management, Leadership, Finance, Marketing, Historical Business Cases) with suggested seasons, plus your own; rename, remove, search. References only, included in backups and transfers.
* **Replay and compare.** *Try a different path* keeps your earlier attempt; the Outcome step compares up to four attempts side by side with history, labelling counterfactual paths.
* **PDF report** of an attempt: the case, every decision, what the sources record, process quality, principles, episode insights, sources and your own reflection. Missing information is stated as missing.
* **Your reflection** after each season, saved with the attempt.
* **Homepage image restored**, now bundled in the app (works offline, on phones and in the desktop app).

## Trust and evidence

* Every season shows its **kind of account**: documented history, scriptural narrative (Prophet Yusuf/Joseph, Sulayman/Solomon), live business scenario or counterfactual analysis, plus an **AI-written** label with the model for AI seasons. The 1.5 badge “Historical · source-verified” overstated what was checked and has been removed.
* **Evidence status on every outcome and evidence figure**: *Verified against source*, *Source available, claim not independently verified*, *Reference inaccessible*, or *Insufficient evidence*. For the 200 built-in seasons all 358 cited sources were fetched on 18 Nov 2026 and each claim's dates, figures and names were looked for in the cited text: 1,421 claims matched, 706 could not be confirmed this way and are labelled so. AI seasons are checked the same way against the material they were written from. The app explains that this shows source support for details, not historical truth.
* Sources are labelled primary, secondary or reference work. Queen Amina's season carries a note on its oral-tradition sources. Non-historical options are labelled “Counterfactual estimate” instead of “Likely consequence”.
* The learning profile now shows sample sizes and 95% ranges, separates process quality from matching history, says where each number comes from (your decisions, historical outcomes, derived metrics, AI interpretations) and states that it is not a psychological assessment.

## Security

* New Wi-Fi pairing: one-time 5-minute codes, secret never sent over the network, signed requests with replay protection, expiring and rotating sessions, device list with remove, rate limits, private networks only. AI keys sent by a phone over Wi-Fi are encrypted. Pair your phone again after updating: 1.5 pairing links no longer work.
* Web pages in your browser can no longer read the pairing code or change saved keys through the desktop app's local server.
* Backups, transfers, packages and AI output are validated and sanitised before use; every link and image from data is checked.
* Provider keys are masked in any error text.
* Electron 45 (from 33), electron-builder 26, iOS exception for arbitrary HTTP loads removed, Android `allowMixedContent` removed.
* Details: [docs/SECURITY.md](SECURITY.md).

## Fixes

* Android: *Download backup* and file exports did nothing inside the app (blob downloads are ignored by the WebView); they now open the share sheet.
* *Replay this case* deleted an unfinished attempt; attempts are now kept.
* The home screen counted “1,600 decisions” as 8 per season; it now counts the real decisions.
* Dialogs keep keyboard focus inside and return it on close.
* `.gitignore` no longer ignores the whole Android project or the lockfile, so a fresh clone builds.

## Upgrade notes

* Data: nothing to do. New fields are added on first use; older backups restore normally.
* Pairing: turn phone access on in the desktop app and scan the new code.
* Android: installs over 1.5 (same signing key, versionCode 10600) and keeps progress.
