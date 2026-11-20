# BIZSIM 1.6 implementation plan

Written after reading the code, before changing it. The code is the source of truth.

## What exists (inspected)

| Area | Where | Notes |
| --- | --- | --- |
| Client | `client/src` (React 18, Vite, react-router) | BrowserRouter on web/desktop, HashRouter in the phone apps |
| Local state | `client/src/lib/store.js`, key `bizsim.state.v1` in localStorage | runs, profile, myCases, savedCompanies, researchHistory, library |
| Simulation | `client/src/lib/sim.js`, `shared/episodes.js` | runs keyed by checkpoint id; one active run per season |
| Content | `shared/catalogue*.js`, `shared/seasons/*`, `shared/cases/*`, `shared/seasons/extras/*` | 200 seasons, 4 episodes, 1,600 decisions, compiled at import time |
| Validation | `shared/validate.js`, `scripts/validate-content.mjs` (`npm run check`) | structure, sources, spoiler words |
| Server | `server/src/index.js` (Express) | localhost listener; research, chat builder, background jobs, keys |
| Pairing | `server/src/share.js` | second listener on 0.0.0.0, one static token per share session sent as `?t=` |
| QR progress | `client/src/components/Transfer.jsx` | `BZS1|session|i|n|chunk` frames, deflate + base64url, camera or photos |
| Desktop | `electron/main.cjs` | starts the server on 127.0.0.1, opens a window |
| Phones | Capacitor 7, `android/`, `ios/` | `androidScheme: http`, cleartext allowed, no native plugins |
| Tests | none automated apart from `npm run check`; ad-hoc Playwright harnesses used during development | |

## Weaknesses found

1. Pairing token never expires, is reused for every request, travels in the URL (logged by proxies), and anyone who sees one request can replay it.
2. The phone's own AI keys are sent to the computer in a header, in clear text, over the LAN.
3. `importState` (backup restore) replaces the whole state with unchecked JSON; QR merge accepts unchecked cases.
4. Source links from imported or generated cases are rendered as `href` without a protocol check (`javascript:` would be possible).
5. On Android, blob downloads (backup, export) do nothing inside the WebView.
6. The homepage hero image depended on an online image search whose call broke when `useOpenImage` changed signature in 1.4; it now never appears.
7. `.gitignore` ignores the whole `android/` folder, so a git clone could not build the Android app.
8. Content classes are only HISTORICAL / LIVE / HYPOTHETICAL; scriptural narratives are labelled "Historical season".

## Phases (each validated before the next)

1. **Trust and security**: content classes (documented, scriptural, live, counterfactual), per-claim evidence status from a source checker, new pairing protocol (one-time code with an out-of-band secret in the QR fragment, signed requests with timestamp and nonce, expiring sessions, rotation, revocation, rate limits, private-network only), encrypted device keys over LAN, URL sanitising, `.gitignore` and source packaging cleanup.
2. **`.bizsim` packages**: versioned spec, export episode / season / AI case / custom season, import from QR (existing multipart frames, new `BZP1` prefix), file, drag and drop, desktop file open; preview, integrity check, duplicate handling.
3. **Collections and Case of the Day**, plus the homepage background restored as a bundled image.
4. **Notification centre**: opt-in only, categories, frequency, quiet hours, local scheduling on Android and iPhone, in-app and desktop notifications elsewhere.
5. **Replay and reports**: practice attempts that never overwrite the original, side-by-side comparison, learning profile with sample sizes, PDF report.
6. **Tests and release**: `node --test` suite, Playwright harnesses, all builds, verification matrix, security summary.

## Compatibility rules

- Never change the WebView origin (`androidScheme`) because localStorage would be lost.
- Old runs, cases and backups keep loading; new fields are optional.
- The curated library works with no server, no network and no key.
