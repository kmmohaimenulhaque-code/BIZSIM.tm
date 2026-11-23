# BIZSIM

**Open-source business case simulation and strategic decision-making.**
Play real business history as **seasons of four episodes, each made of two or more linked decisions with its own outcome and insight**, from Hammurabi’s Babylon to OpenAI’s boardroom, and see what actually happened, with cited sources. Research any live company from public sources and turn the evidence into a playable season whose last episode is happening now, or describe the season you want in plain language and let the chat builder write it.
<img width="100%" alt="BIZSIM Overview" src="Screenshots/BIZSIM home.png" />

*Workspace overview with daily featured case, quick research bar, and recent activity.*

No accounts. No tracking. Your progress stays on your devices.

**Version 1.7.3** · Windows · macOS · Linux · Android · iPhone/iPad · Web

### New in 1.7.3

- **15 interface languages plus English (UK)**: English (US), English (UK), বাংলা, Español, Português (Brasil), Français, العربية, हिन्दी, 简体中文, 日本語, Deutsch, Русский, Bahasa Indonesia, Türkçe, 한국어, اردو. Choose in Settings → Language; switching is instant and never touches your progress. Right-to-left layout for Arabic and Urdu.
- AI-written seasons (live research, chat builder) are written in your language.
- All translations are **machine-assisted and not yet reviewed** by native speakers. Built-in seasons are English, apart from a one-season sample in Bengali and Spanish. See [docs/I18N.md](https://www.google.com/search?q=docs/I18N.md).

Full notes: [docs/RELEASE-NOTES-1.7.md](https://www.google.com/search?q=docs/RELEASE-NOTES-1.7.md).

### New in 1.6.0

- **Share a season or a single episode** as a `.bizsim` file or QR codes, including seasons from live research and the chat builder. Imports are checked, previewed and never overwrite anything without asking. See [docs/PACKAGE-FORMAT.md](https://www.google.com/search?q=docs/PACKAGE-FORMAT.md).
- **Notifications, off until you turn them on**: Case of the Day, resume reminders, a weekly goal, season and research completion, your own reminders. Quiet hours, per-category switches, an inbox. Scheduled on the device, no account.
- **Case of the Day**, **collections and bookmarks**, **replay and compare** attempts, a **PDF report** with your reflection, and the **homepage image back**.
- **Trust labels**: every season shows whether it is documented history, a scriptural narrative, a live scenario or a counterfactual, whether AI wrote it, and the evidence status of each outcome after an automated check of all 358 cited sources.
- **Security hardening**: new Wi-Fi pairing (one-time codes, signed requests, replay protection, device list), encrypted AI keys over Wi-Fi, protection against other websites, validated imports and backups, Electron 45. See [docs/SECURITY.md](https://www.google.com/search?q=docs/SECURITY.md).

Full notes: [docs/RELEASE-NOTES-1.6.md](https://www.google.com/search?q=docs/RELEASE-NOTES-1.6.md).

---

## What’s inside

| Area | What it does |
|---|---|
| **200 offline seasons** | **800 episodes · 1,600 decisions** across 6 executive pillars (Strategy, Finance, Brand, Operations, Turnarounds, Leadership) — spanning ancient statesmen, historic merchant networks, and modern operators, plus 10 hand-written signature seasons. Plays fully offline with no AI key. See [docs/CATALOGUE.md](https://www.google.com/search?q=docs/CATALOGUE.md). |
| **6-step method** | **Situation → Concept → Evidence → Episodes → Outcome → Insight.** Spoiler-free decisions compared against history, with cited outcomes and takeaways after each episode. |
| **Principles library** | 76 paraphrased principles from 30 classic strategy and business books. Add your own books, principles, and custom tags to link and filter seasons. |
| **Live research & Chat builder** | **Research a company** from Wikidata, Wikipedia, SEC EDGAR, news, and official sites to generate a 4-episode season (with Episode IV set in the present). Or use **Chat builder** to describe any custom case in plain language. |
| **AI key fallback chain** | Add keys from Gemini, NVIDIA NIM, Groq, Anthropic, OpenAI, OpenRouter, xAI, or local Ollama. Automatically tests models, repairs broken JSON, and falls back on rate limits or errors. |
| **Voice reader** | Built-in offline neural TTS (**Listen** button) powered by open-source **Piper** with 4 CC0/public-domain voices (~60 MB one-time download). |
| **QR transfer & Wi-Fi pairing** | Sync progress, cases, and principles offline via cycling QR codes (non-destructive merge), or pair your phone to the desktop app over local Wi-Fi with one-time codes and signed requests. See [docs/SECURITY.md](https://www.google.com/search?q=docs/SECURITY.md). |
| **Design, media & storage** | Dark Graphite & Gold and light Ivory themes, CC-licensed Wikipedia cover images (or optional AI illustrations), and customizable desktop install/data/download folders. |

Provenance is always visible: account type (documented, scriptural, live, counterfactual), **AI-written** labels, and per-outcome evidence status (**Verified against source** · **Source available, claim not independently verified** · **Reference inaccessible** · **Insufficient evidence**).

---

## Install

| Platform | File | Notes |
|---|---|---|
| **Windows 10/11** | [BIZSIM-Setup-1.7.3-windows-x64.exe](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-Setup-1.7.3-windows-x64.exe) | Unsigned: on the blue SmartScreen box click *More info → Run anyway*. The installer asks **just for me / all users** and lets you **choose the install folder**. Allow the firewall prompt only if you want phone access. |
| **macOS (Apple Silicon M1–M4)** | [BIZSIM-1.7.3-mac-arm64.zip](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-arm64.zip) | Unzip and put `BIZSIM.app` **in any folder you like** (Applications is usual). First launch: right-click → *Open* → *Open*. If macOS says it is damaged, run `xattr -cr /path/to/BIZSIM.app` once in Terminal. Also available as [.dmg](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-arm64.dmg) and [.pkg](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-arm64.pkg). |
| **macOS (Intel)** | [BIZSIM-1.7.3-mac-x64.zip](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-x64.zip) | Same as above. The GitHub Actions build also makes [.dmg](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-x64.dmg) (drag anywhere) and [.pkg](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-mac-x64.pkg) (installer with *Change Install Location*). |
| **Linux** | [BIZSIM-1.7.3-linux-x86\_64.AppImage](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-linux-x86_64.AppImage) or [BIZSIM-1.7.3-linux-x64.tar.gz](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-1.7.3-linux-x64.tar.gz) | AppImage: put it in any folder, `chmod +x`, run. `.tar.gz`: extract anywhere and run `./bizsim`. |
| **Android 6+** | [BIZSIM-v1.7.3-android.apk](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-v1.7.3-android.apk) | Open the file and allow *Install unknown apps* for your browser/files app. Installs over earlier versions and keeps your progress. |
| **iPhone / iPad** | [BIZSIM-v1.7.3-ios-unsigned.ipa](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-v1.7.3-ios-unsigned.ipa) · Xcode project included (`ios/`), or GitHub Actions | Apple only lets apps be compiled on a Mac. **On a Mac:** `npm install && npm run build && npx cap sync ios`, open `ios/App/App.xcodeproj`, pick your Apple ID under *Signing & Capabilities*, plug in the iPhone and press ▶ (free Apple ID: app lasts 7 days; paid developer account: TestFlight/App Store). **No Mac:** download the unsigned [.ipa](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-v1.7.3-ios-unsigned.ipa) to install with Sideloadly/AltStore. **Instant option:** open BIZSIM in Safari → Share → *Add to Home Screen*. |

**Desktop apps include the server**, so everything works out of the box. **Phone apps** run all 200 seasons, the principles library, voice and QR transfer on their own; for live research and the chat builder, pair with your computer (Settings → *Connect to a computer*) or point them at a hosted server (Settings → *Server address*).

### Choosing folders on desktop

- **Install folder**: Windows: chosen in the installer (*Browse…*). macOS: wherever you put the app. Linux: wherever you put the AppImage / extracted folder.
- **Data folder**: Settings → *Storage locations* → *Data folder* → *Change…*. BIZSIM copies your progress, saved seasons, keys and voice cache to the new folder and restarts. *Use default folder* moves it back. Defaults: `%APPDATA%\bizsim` (Windows), `~/Library/Application Support/bizsim` (macOS), `~/.config/bizsim` (Linux).
- **Downloads** (images, exported files), *Ask where to save each file*, or *Always save to a folder I choose*.

---

## Setting up AI (optional)

Everything works without keys: all 200 seasons, the simulator, the principles library, voice, verified research evidence. AI is needed only to write **live seasons**, run the **chat builder** and make **AI images**.

**Easiest:** open **Settings → AI keys**, paste a key, press **Add key**. Free options: Google Gemini (<https://aistudio.google.com/apikey>, text and images), NVIDIA NIM (<https://build.nvidia.com/settings/api-keys>, keys start with `nvapi-`) and Groq (<https://console.groq.com/keys>). Add several and BIZSIM falls back between them automatically; the default order is Anthropic, OpenAI, Gemini, NVIDIA, Groq, xAI, OpenRouter, custom, and you can reorder it. For US-company financials, enter your name and email under *SEC EDGAR* (the SEC requires it; no key).

- Desktop app: keys are saved on that computer (in the app’s data folder) and are used by phones paired with it.
- Phone or hosted server: keys stay on that device and are sent only with its own requests.

**Alternative (files):** copy `.env.example` to `.env` (server) or to `bizsim.env` in the app data folder (the default one, or the folder you chose in Settings), `~/.config/bizsim/` (Linux), `~/Library/Application Support/bizsim/` (macOS), `%APPDATA%\bizsim\` (Windows). Priority: keys from the device → keys saved in Settings → settings file.

Gemini models are picked automatically and replaced when Google retires them. NVIDIA models are chosen from the live catalogue your key can see (fast models first, larger ones as fallbacks) and each is tested with a short request before it joins the chain. Rate-limited or failing calls get one quick retry, then the next model or key takes over.

---

## Run from source

Requires **Node.js 18.17+** (22 recommended).

```bash
npm install          # add ELECTRON_SKIP_BINARY_DOWNLOAD=1 if you don't need the desktop app
npm run build
npm start            # → http://localhost:8787
npm run dev          # hot reload: UI :5173, API :8787
npm run check        # validate curated content (-- --urls to check every source link)
npm test             # unit and integration tests (node --test)
npm run check:sources  # re-fetch every cited source and refresh evidence statuses (slow, needs internet)
npm run i18n:check   # translations: placeholders, plurals, missing keys, hard-coded text, season overlays
```

### Build the apps yourself

```bash
npm run dist:linux        # AppImage + .tar.gz
npm run dist:win          # Windows installer (on Windows, or Linux with Wine)
npm run dist:mac          # macOS dmg + pkg + zip (on a Mac; see build/entitlements.mac.plist)

# The android/ and ios/ projects are in the repository.
npm run build && npx cap sync android && node scripts/prepare-mobile.mjs
cd android && ./gradlew assembleRelease     # then zipalign + apksigner with your own key

npm run build && npx cap sync ios && node scripts/prepare-mobile.mjs
npx cap open ios                             # macOS + Xcode
```

**GitHub Actions** (`.github/workflows/build.yml`) builds Windows, macOS, Linux, Android and an unsigned iOS [.ipa](https://www.google.com/search?q=https://github.com/kmmohaimenulhaque-code/BIZSIM.tm/releases/download/v1.7.3/BIZSIM-v1.7.3-ios-unsigned.ipa) on free runners, push a tag such as `v1.7.3` or run it manually, then download from the run’s *Artifacts*. For a stable Android signing key, add repository secrets `ANDROID_KEYSTORE_B64` (base64 of the `.jks`) and `ANDROID_KEYSTORE_PASSWORD`.

### Hosting a server (Docker)

```bash
docker build -t bizsim .
docker run -p 8787:8787 -e SEC_USER_AGENT="Your Name you@example.com" -e GEMINI_API_KEY=... -v bizsim-data:/data bizsim
```

Set `BIZSIM_ADMIN_TOKEN` to allow saving server-wide keys from Settings remotely (send header `X-BizSim-Admin`).

**Public website production checklist** (see [docs/SECURITY.md](https://www.google.com/search?q=docs/SECURITY.md) for full details):
- Run behind an HTTPS reverse proxy (Nginx, Caddy, Cloudflare) with TLS and edge rate limits (required if running multiple instances; the built-in bounded limiter is single-process).
- Set `CORS_ORIGINS=https://your-domain.example` explicitly (do not use `*` in production).
- Supply AI keys server-side via environment variables (and optionally set `BIZSIM_PUBLIC_AI_TOKEN` to gate expensive AI routes); for personal BYOK and SEC EDGAR usage, users should download the official Desktop or Mobile apps rather than using a public web instance.
- Built-in API limits: `120 req/min/IP` globally on `/api/*`, plus stricter limits on research (`8/min`), chat (`10/min`), image generation (`4/min`), image search (`30/min`), and key testing (`12/min`).

---

## Architecture

```mermaid
flowchart TB
    subgraph Apps["Apps & UI"]
        Desktop["electron/ · Desktop Shell"]
        Mobile["mobile/ · Android & iOS"]
        Client["client/src/ · React + Vite UI, Piper TTS, QR Transfer"]
        Desktop --> Client
        Mobile --> Client
    end

    Shared["shared/ · 200 Seasons, 76 Principles, Validator, Keychain"]

    subgraph Backend["server/src/ · Express API (No DB)"]
        API["REST & SSE Endpoints"]
        Research["research/ · Wikidata, Wikipedia, SEC EDGAR, News, Web"]
        AI["ai/ · LLM Fallback Chain, Live Case Synth, Chat Builder"]
        Share["share.js · Wi-Fi Phone Pairing"]
        API --> Research
        API --> AI
        API --> Share
    end

    Client --> Shared
    Client <-->|"HTTP / SSE"| API
    API --> Shared
```

**API:** `/api/status` · `/api/cases` · `/api/catalogue` · `POST /api/jobs/research` and `POST /api/jobs/chat` (background jobs) · `/api/jobs/:id/events?from=N` (SSE with replay) · `/api/research/stream?q=` (SSE) · `POST /api/chat` (SSE) · `/api/keys` · `POST /api/keys/test` · `POST /api/keys/chain` · `/api/images/search` · `/api/images/generate` · `/api/share` (desktop only).

## Troubleshooting

- **“Constructing the case” fails**: BIZSIM now repairs malformed JSON and falls back through every model of every key you added. If all of them fail, the message lists each model and its reason (rate limited, key rejected, model not available). Adding a second free key (Gemini, NVIDIA NIM or Groq) makes failures rare.
- **A screen goes blank or shows “This screen could not be shown”**: press *Try again* or *Reload*; your progress is safe. On Android, version 1.5.0 fixed the Settings page crashing when the phone is not paired with a computer.
- **QR transfer is slow to capture**: turn the sending screen’s brightness up, press *Pause* and step through the codes with the arrows, or photograph each code and use *From photos or screenshots*. The receiver lists which codes are still needed.
- **A season shows a plain cover**: its Wikipedia article has no freely licensed lead image, so BIZSIM shows a typographic cover rather than an unrelated photo.
- **News → 429**: news sources rate-limit heavy use; it clears by itself. Failed research is never cached, so just run it again.
- **Website → timed out / 403**: some sites block automated readers. Research continues with other sources.
- **Phone can’t reach the computer**: same Wi‑Fi network, phone access turned on, and allow BIZSIM through the computer’s firewall.

## Content standards

Historical outcomes cite sources; corrections to the original curriculum are listed in [docs/CATALOGUE.md](https://www.google.com/search?q=docs/CATALOGUE.md). Book ideas are short paraphrases, no passages reproduced. Charts show only SEC filing data. Unknowns are stated as unknowns.

## Licence

MIT. Data: Wikidata (CC0), Wikipedia (CC BY-SA), SEC EDGAR (public domain), Wikimedia Commons images (individual free licences, credited). Voice: Piper (MIT) with public-domain / CC0 voices (John, Norman, Bryce, Joe). QR: `qrcode` (MIT), `jsQR` (Apache-2.0), `fflate` (MIT). JSON repair: `jsonrepair` (ISC).
