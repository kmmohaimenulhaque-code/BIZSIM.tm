# BIZSIM security model (1.6.0)

BIZSIM has no accounts, no tracking and no cloud service of its own. Data stays on the user's devices. This document describes what is protected, how, and what is not.

## Data on the device

| Data | Where | Leaves the device? |
|---|---|---|
| Progress, own seasons, collections, notification inbox and settings | Browser storage (`bizsim.state.v1`) | Only when the user exports a backup, sends a QR progress transfer or shares a season package. |
| The user's own AI keys on a phone or browser | Browser storage (`bizsim.deviceKeys`) | Sent to the BIZSIM server the device uses, to make AI calls. Over Wi-Fi pairing they are encrypted (below). Never in backups, transfers or packages. |
| AI keys saved on the desktop/server | `data/settings.json` on the computer | Only to the AI provider. Never sent to phones. |
| Pairing sessions (desktop) | `data/pairing.json`, file mode 0600 | Never. |

Backups, QR progress transfers and `.bizsim` packages never include keys, pairing data or passwords. Tests check this.

## Wi-Fi pairing (desktop to phone)

1.5 used a static token in the URL query (`?t=`), sent with every request and valid until sharing was turned off. 1.6 replaces it:

* **Out-of-band secret.** The QR encodes `http://IP:PORT/#pair=CODE.SECRET`. Browsers never send the part after `#`, so the 24-byte secret only exists in the QR image and on the two devices.
* **One-time, expiring codes.** A code works once, expires after 5 minutes, and a new one appears automatically or with *New code*.
* **Proof without disclosure.** The phone proves it has the secret with `HMAC(secret, "claim|code|ts|nonce")`. The secret is never transmitted. The computer answers with a session id; both sides derive `key = HMAC(secret, "session|id")`.
* **Signed requests.** Every API call carries `X-Bizsim-Session`, `-Ts`, `-Nonce` and `-Sig = HMAC(key, method, path+query, ts, nonce, SHA-256(body))`. Altered requests fail the signature; requests older than 2 minutes or with a nonce already seen are refused (**replay protection**).
* **Sessions** expire after 30 idle days. The phone **rotates** its key every 7 days (old key valid for 2 more minutes for requests in flight). The phone can **end** its session (*Disconnect*); the computer lists paired devices and can **remove** one or all.
* **Rate limits.** 10 pairing attempts per minute per address; 20 failed attempts lock the address out for 5 minutes.
* **Minimal exposure.** The listener only runs while *Phone access* is on, accepts connections from private-network addresses only (10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, IPv6 ULA and link-local, loopback), answers CORS only for the app's own origins, caps request bodies at 300 KB, and closes every connection when turned off. Key management and share controls are never available over Wi-Fi.
* **AI keys over Wi-Fi** are sealed with encrypt-then-MAC built from HMAC-SHA-256 (counter-mode keystream, random 16-byte IV, 32-byte tag) under a key derived from the session key. Plain key headers are refused on the Wi-Fi listener. Phone browsers on a plain `http://` address have no WebCrypto, which is why a small pure-JS SHA-256/HMAC is used (`shared/sha256.js`, cross-checked against Node's crypto in `tests/pairing.test.mjs`).

**Limitations, stated plainly:** traffic on the Wi-Fi is signed but not encrypted (except AI keys). Someone on the same network can read research results and seasons as they travel, but cannot forge, alter or replay requests, read the pairing secret or the keys. Use phone access on networks you trust. HTTPS on the LAN would need a certificate users would have to trust manually, so it is not used. The Android app keeps `usesCleartextTraffic` because it must reach a computer at an arbitrary private IP over `http://`; Android cannot restrict cleartext to an IP range. iOS uses only `NSAllowsLocalNetworking` (the 1.5 `NSAllowsArbitraryLoads` exception was removed).

## The desktop app's local server

* Listens on `127.0.0.1` only.
* **Cross-site protection (new in 1.6).** Any web page open in the user's browser can send requests to `localhost`. The key-management and phone-access endpoints now require a `localhost` Host header (defeats DNS rebinding), a same-origin `Origin` if present, and `Sec-Fetch-Site` of `same-origin`/`none`. A test confirms a page on another origin gets 403.
* Electron: context isolation, sandbox, no Node in the page; external links open only for `http`, `https` and `mailto`; navigation away from the app is blocked; `<webview>` is blocked; the folder-opening bridge only opens BIZSIM's own data and download folders; `.bizsim` files opened from the file manager are size-limited and validated like any import.
* Electron upgraded from 33 (end of life) to 45.

## Untrusted input

* **Season packages and QR codes**: see [PACKAGE-FORMAT.md](PACKAGE-FORMAT.md). Validation, integrity check, whitelist sanitising, preview and explicit confirmation before anything is stored. The checksum is not treated as proof of authenticity.
* **Backups and progress transfers**: rebuilt field by field (`shared/stateSchema.js`), unknown or malformed items dropped and counted in a preview; unsupported versions refused; restore is *merge* by default, *replace* only after confirmation; restored notification settings start switched off.
* **AI output**: validated on the server, then sanitised again on the device before it is stored.
* **Rendering**: React escapes all text; there is no `dangerouslySetInnerHTML`. Every link from data passes `safeUrl` (http/https only); every image source passes `safeImageSrc`. In-app navigation requests (notification taps) accept only same-app paths (no `//host`, no backslashes), which also neutralises the React Router open-redirect advisory GHSA-wrjc-x8rr-h8h6.
* **Secrets in errors**: error texts sent to the app or written to job streams pass through `redactSecrets`, which masks Gemini, OpenAI, Anthropic, NVIDIA, Groq and xAI key patterns, bearer tokens and `key=`/`token=` query values. The server logs nothing but its startup lines.

## Notifications

Off until the user turns them on. Scheduled locally (Android/iOS system scheduler, or in-app while open on desktop and web). No push service, no account, nothing sent anywhere.

## Dependencies (`npm audit`, 18 Nov 2026)

* Runtime dependencies of the server (`express`, `jsonrepair`): **0 vulnerabilities**.
* Remaining advisories are in build and development tools only: `esbuild` (Vite dev server, not used in releases), `picomatch`/`minimatch` (build-time globbing in electron-builder), and `react-router` 6 (open redirect via backslash paths, mitigated as above; the SSR advisory does not apply because BIZSIM has no server rendering). Upgrading React Router to 7 is a breaking change planned separately.
* `jspdf` 4.2.1 (latest) is used for PDF reports, on the device only, with built-in fonts and no file system access.

## Outstanding concerns

1. Wi-Fi traffic other than AI keys is not encrypted (see above).
2. `data/pairing.json` stores session keys in a file readable only by the user's account; it is not encrypted with an OS keychain.
3. Windows and macOS builds are not code-signed with a paid certificate (macOS builds are ad-hoc signed), so the OS warns on first launch, and users cannot verify the publisher cryptographically.
4. Android release builds are signed with a project key generated for this release line; publish its fingerprint where users download the APK.
5. Imported seasons are only as trustworthy as whoever shared them. The app labels them, shows their sources and never presents an imported checksum as authorship.

Report security problems privately to the maintainers rather than in a public issue.
