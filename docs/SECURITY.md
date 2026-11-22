# BIZSIM security model (1.7.3)

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

## Public website & production deployment (1.7.3)

* **Network topology & TLS.** Desktop builds bind strictly to `127.0.0.1`. For a public website deployment, run BIZSIM behind an HTTPS reverse proxy (Nginx, Caddy, Cloudflare, or cloud load balancer) that terminates TLS, forwards client IPs cleanly, and enforces edge request limits.
* **Server-side AI keys.** On a public website, configure provider keys server-side via environment variables (`.env` / container secrets) rather than asking visitors to paste personal API keys into a public browser origin.
* **Strict CORS.** Production must never default to `*`. Set `CORS_ORIGINS` explicitly to your exact origin(s), e.g. `CORS_ORIGINS=https://bizsim.example.com`. When `CORS_ORIGINS` is unset, only local desktop/mobile origins (`localhost`, `127.0.0.1`, `capacitor://localhost`, `ionic://localhost`) are allowed.
* **Layered rate limiting.** All `/api/*` traffic is protected by a bounded in-memory global limiter (120 requests/minute/IP) plus stricter per-route limits: Research (`<= 8/min`), Chat (`<= 10/min`), Image generation (`<= 4/min`), Image search (`<= 30/min`), Key testing (`<= 12/min`), and key/share mutators (`<= 30/min`). Exceeded limits return `429` with `Retry-After`.
  * *Single vs. multi-instance scaling:* The built-in bounded in-memory limiter (`createBoundedRateLimiter`) is safe for a single Node process (capped key table, automatic stale-entry pruning). If you scale horizontally across multiple replicas or face distributed abuse, add reverse-proxy/edge rate limits or a shared Redis-backed store in front of BIZSIM.
* **Zero API keys in logs.** Startup logs report only provider status (on/off and model name) and never print full or partial keys. All Express JSON responses, global error handlers, uncaught-exception/unhandled-rejection handlers, SSE failure events, and background job event payloads pass through `redactSecrets` / `redactSecretsDeep` (`server/src/lib/http.js`), which scrubs Gemini (`AIza...`, `AQ....`), OpenAI (`sk-...`), Anthropic (`sk-ant-...`), NVIDIA (`nvapi-...`), Groq (`gsk_...`), xAI (`xai-...`), `Bearer` tokens, API key headers, and `key=`/`token=` query parameters.
* **Public AI access-control modes (`BIZSIM_PUBLIC_AI_TOKEN`).**
  * *Standard public site (token unset):* Supply server-side AI keys in `.env` and rely on layered edge + in-memory rate limits (`8/min` research, `10/min` chat, `4/min` image gen) for cost control.
  * *Locked-down / edge-authenticated mode (token set):* When `BIZSIM_PUBLIC_AI_TOKEN` is set, expensive AI routes (`/api/research*`, `/api/jobs/research`, `/api/chat`, `/api/jobs/chat`, `/api/images/generate`) intentionally return `401` to unauthenticated browsers unless `X-BizSim-Public-Token` (or `Authorization: Bearer <token>`) matches via `crypto.timingSafeEqual`. Inject this header from an authenticating reverse proxy (e.g. Cloudflare Access, OAuth2 Proxy, Nginx auth) or authorized backend clients. **Never** embed `BIZSIM_PUBLIC_AI_TOKEN` in `VITE_*` variables or frontend JavaScript bundles.
* **Zero-key-logging vs. BYOK transmission.** Zero-key-logging guarantees the server never writes API keys to logs, error responses, SSE streams, or exports. It is **not** zero-key-transmission: when a browser user enters a device key against a hosted server, that key is stored in `localStorage`, sent to that server in `X-BizSim-Keys` (over HTTPS on a properly configured site, or HMAC-CTR sealed over Wi-Fi pairing), held in request-scoped `AsyncLocalStorage` only while forwarding the upstream provider call, and then discarded. This is why personal BYOK belongs in the official Desktop/Mobile apps or a private self-hosted instance.
* **SSE concurrency & timeouts.** Long-lived SSE streams (`/api/research/stream`, `/api/chat`, `/api/jobs/:id/events`) are capped at **3 concurrent connections per IP** (returning `429` with `Retry-After`), with a 5-minute idle timeout and 10-minute max duration. Active stream entries are never evicted when the bounded table fills (the limiter fails closed instead, preventing IP-churn bypasses).
* **Background job IDs.** Job IDs are generated with 192 bits of CSPRNG entropy (`crypto.randomBytes(24).toString('base64url')`), auto-pruned after 1 hour, and never include API keys or raw credentials in event payloads. *Residual note:* job event reads rely on high-entropy unguessable IDs rather than user accounts; keep job URLs private.
* **Security headers & payload caps.** The server sets `Content-Security-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: SAMEORIGIN`, and caps JSON bodies at `200kb`.
* **In-app Privacy Policy & Terms.** Accessible directly from the sidebar under **About BIZSIM** (top-level tabs for Overview, Privacy Policy, and Terms & Conditions), explaining local-first storage, user API key responsibility, and encouraging native Desktop/Mobile app downloads for BYOK and SEC EDGAR.
* **HTML-to-text extraction.** `server/src/research/sources.js` (`pageText`) uses a single-pass state-machine parser to extract plain text from `h1`/`h2`/`h3`/`p`/`li` blocks while discarding comments and `script`/`style`/`noscript`/`svg`/`nav`/`footer`/`header`/`form` containers (capped at 4,000 characters). Its output is plain text only and is never rendered as HTML.

### Example reverse proxy configuration (Nginx)

For a public website deployment, terminate HTTPS at your reverse proxy, forward real client IPs, enforce edge rate limits for general and expensive AI routes, disable buffering with a long read timeout for SSE streams, and cap request body sizes:

```nginx
# General API traffic (~120 req/min/IP) and stricter zone for expensive AI routes
limit_req_zone $binary_remote_addr zone=bizsim_api:10m rate=2r/s;
limit_req_zone $binary_remote_addr zone=bizsim_ai:10m rate=8r/m;
limit_conn_zone $binary_remote_addr zone=bizsim_conn:10m;

server {
  listen 443 ssl http2;
  server_name bizsim.example.com;

  # ssl_certificate     /etc/letsencrypt/live/bizsim.example.com/fullchain.pem;
  # ssl_certificate_key /etc/letsencrypt/live/bizsim.example.com/privkey.pem;

  # DDoS, Slowloris & bandwidth controls
  client_max_body_size 512k;
  client_header_timeout 10s;
  client_body_timeout 15s;
  limit_conn bizsim_conn 20;
  gzip on;
  gzip_types application/json text/css application/javascript image/svg+xml;

  # Frontend SPA & static assets (match PORT in .env, default 8787)
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # General API routes + SSE job event streams (/api/jobs/:id/events)
  location /api/ {
    limit_req zone=bizsim_api burst=20 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;       # required for SSE event streams
    proxy_read_timeout 300s;   # keep long-running SSE streams open
  }

  # Stricter edge limit on expensive AI routes
  # Covers: /api/research, /api/research/stream, /api/jobs/research,
  #         /api/chat, /api/jobs/chat, /api/images/generate
  location ~ ^/api/(research(/stream)?|jobs/(research|chat)|chat|images/generate)$ {
    limit_req zone=bizsim_ai burst=4 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;       # required for SSE (/api/research/stream, /api/chat)
    proxy_read_timeout 300s;   # allow multi-season builds & live research to finish
  }
}
```

#### Matching application environment (`.env`)

```dotenv
NODE_ENV=production
PORT=8787
CORS_ORIGINS=https://bizsim.example.com
TRUST_PROXY=1
# Supply AI provider keys server-side on public sites (do not rely on visitors pasting personal keys in the browser):
GEMINI_API_KEY=...
```

* **`TRUST_PROXY` guidance** (parsed by `parseTrustProxy()` in `server/src/config.js`):
  * `loopback` (default): use when Nginx/Caddy runs on the **same host** (`127.0.0.1`).
  * `1` (or exact hop count `2`, etc.): use when deployed behind a **non-loopback** reverse proxy or cloud load balancer (e.g., AWS ALB, Cloudflare + Nginx = `2`).
  * CIDR subnet (e.g., `10.0.0.0/8`): use when your load balancer sits in a known private VPC range.
* **Residual operational risks**:
  * The built-in bounded rate limiter is **in-memory per Node process**. For multi-replica horizontal scaling or distributed abuse, enforce rate limits at the reverse proxy/CDN edge or back them with a shared Redis store.
  * `TRUST_PROXY` must match your real proxy topology; setting it too narrow collapses all visitors onto the proxy's IP, while setting it too broad (`true` without a trusted edge) allows clients to spoof `X-Forwarded-For` and bypass per-IP rate limits.
