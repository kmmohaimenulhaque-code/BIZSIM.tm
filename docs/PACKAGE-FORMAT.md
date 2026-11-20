# `.bizsim` package format (schema version 1)

A `.bizsim` file carries **one season or one episode** between devices: a curated season, a season written by live research or the chat builder, or a season someone imported. It travels as a file (share sheet, email, USB, drag and drop) or as a sequence of QR codes. Implementation: [`shared/package.js`](../shared/package.js). Tests: [`tests/package.test.mjs`](../tests/package.test.mjs).

## What a package never contains

API keys, pairing sessions, passwords, provider credentials, progress (runs, profile), settings, collections, notification data, or any other personal data. Packages are built from the output of the import sanitiser (`sanitizeCase`), which has no fields for any of those, so they cannot be included by mistake. The test suite walks every key of exported packages and fails on anything resembling a secret or personal field.

## File

UTF-8 JSON, MIME type `application/vnd.bizsim+json`, extension `.bizsim`, at most 2 MB on disk and 1.5 MB decoded.

```json
{
  "format": "bizsim-package",
  "schemaVersion": 1,
  "id": "9f2c0a1be7d34411aa",
  "createdAt": "2026-11-18T09:12:00.000Z",
  "appVersion": "1.6.0",
  "kind": "season",
  "title": "Hannibal: The Second Punic War",
  "subject": "Carthage",
  "industry": "STRATEGY",
  "period": "218 to 201 BC",
  "seasonEpisodes": 4,
  "classification": "documented",
  "ai": { "generated": false },
  "content": { "case": { "...": "the season, see below" } },
  "integrity": { "algorithm": "SHA-256", "digest": "<64 hex>", "note": "Detects damage only. Not proof of authorship or accuracy." }
}
```

| Field | Type | Rules |
|---|---|---|
| `format` | string | Must be `bizsim-package`. |
| `schemaVersion` | integer | `1`. Higher numbers are refused with “made with a newer BIZSIM”. |
| `id` | string | 8 to 64 lowercase hex characters, random per export. |
| `createdAt` | ISO 8601 string | Export time. |
| `appVersion` | string | Version of the exporting app. Informational. |
| `kind` | string | `season`, `episode`, `ai-case` or `custom-season`. |
| `title`, `subject`, `industry`, `period`, `seasonEpisodes` | metadata | Shown in the import preview. The values inside `content.case` are authoritative. |
| `classification` | string | `documented`, `scriptural`, `live` or `counterfactual` (see “Kinds of season” in About). |
| `ai` | object | `{ generated: true, model, provider, disclosure }` for AI-written seasons, else `{ generated: false }`. |
| `content.case` | object | The season (below). |
| `content.origin` | object, optional | For `kind: "episode"`: `{ caseId, episode }` of the season it came from. |
| `integrity` | object | `algorithm: "SHA-256"`, `digest`: SHA-256 (hex) of the canonical JSON of `content` (object keys sorted, `undefined` dropped). |

Unknown top-level fields are ignored and listed as a warning in the preview.

### The season (`content.case`)

The same structure the app plays: `id`, `title`, `company`, `tagline`, `yearLabel`, `yearSort`, `era`, `domain`, `pillar`, `scale`, `difficulty` (1 to 3), `minutes`, `classification`, `contentClass`, `evidenceNote`, `source`, `aiGenerated`, `model`, `provider`, `generatedAt`, `situation { headline, context[], role, stakes }`, `concept { framework, explanation, principles[] }`, `evidence[] { label, value, note, sourceId }`, `sources[] { id, title, publisher, url, type, date }`, `checkpoints[]` (decisions: `id`, `episode`, `title`, `dateLabel`, `prompt`, `context`, `complexity`, `live`, `options[]`, `outcome { text, sourceIds[] }`), `episodes[] { n, title, dateLabel, live, insight { text, principles[] } }`, `outcome { summary, secondOrder[], baseRate, lessons[] }`, `analysis`, `scenarios[]`, `evidenceChecks`, `evidenceCheckedAt`.

Options: `id`, `label`, `summary`, `consequence`, `tradeoffs`, `risks`, `historical` (at most one per decision), `quality` (1 to 3), `impact { position, finance, resilience }` (−20 to 20), `dims` (−100 to 100), `principles[]`.

An episode package is a season trimmed to one episode: its decisions are renumbered to episode 1, only the sources they cite are kept, and its id is `<seasonId>.ep<n>`.

## Import rules

Every package is untrusted. Import runs these steps and stops at the first failure, with a plain-language reason:

1. Size limit; valid JSON; `format` matches; `schemaVersion` supported; required fields present (`id`, `createdAt`, `kind`, `content`, `integrity`); `id` pattern; `kind` known.
2. **Integrity**: the digest is recomputed and must match. A mismatch means the file was damaged or incompletely transferred.
3. **Sanitising** (`sanitizeCase`): only known fields of the right type survive; text loses control and bidi-override characters and is length-capped; links must be `http(s)`; numbers are clamped; ids are pattern-checked and must be unique; outcomes and evidence may only cite sources present in the package; at most one historical option per decision; size caps on every list.
4. **Preview**: title, subject, kind, episode and decision counts, sources, classification, AI disclosure and any cleaning warnings.
5. **Duplicates**: a built-in season is opened, not imported; an identical copy is reported as already present; a different version with the same id asks the user to **Keep both** (the import gets a new id) or **Replace mine** (with confirmation). Nothing is written until the user chooses. Progress on earlier versions stays in history.

All imported text is rendered as text by React; nothing in a package is ever executed or inserted as HTML.

**The checksum is not a signature.** Anyone can create a package with a valid digest. It proves neither who made a package nor that its content is true, and the app says so in the preview.

## QR transfer

The package JSON is gzip-compressed (fflate), base64url-encoded and split into frames of 280 characters:

```
BZP1|<pid>|<index>|<total>|<check>|<chunk>
```

* `pid`: first 12 hex characters of the package id, identifies the transfer.
* `index` (0-based) and `total`: at most 400 frames.
* `check`: first 6 hex characters of SHA-256 of `pid|index|total|chunk`. A misread frame fails this check and is simply scanned again.

The receiver accepts frames in any order, ignores repeats, reports frames from a different package, lists missing frames, saves partial progress so a transfer can be **resumed** after closing the dialog, and can be **cancelled** to start over. When all frames are present they are joined, decompressed (size-limited) and imported through the same steps as a file. If a season needs too many codes, use the `.bizsim` file instead.

Progress transfer (whole-device data) uses a different prefix, `BZS1`, and its own dialog.

## Opening packages

* All platforms: *My cases → Import a season* (file picker, camera, photos, or pasted text).
* Web and desktop: drag a `.bizsim` file onto the window.
* Desktop app: double-click a `.bizsim` file (file association registered by the installers; macOS `open-file`, Windows and Linux command-line argument).
* Android: “Open with BIZSIM” for files shared with MIME type `application/vnd.bizsim+json`. Many file managers send `.bizsim` as a generic type, so the in-app file picker is the reliable route.
* iPhone/iPad: document type `org.bizsim.package` is declared; opening from Files is supported by the project but has not been tested on a device.
