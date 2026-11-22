# BIZSIM 1.7.0: languages

## What's new

- **15 interface languages, plus English (UK).** Settings → Language lists every language by its
  own name (English (US), English (UK), বাংলা, Español, Português (Brasil), Français, العربية, हिन्दी,
  简体中文, 日本語, Deutsch, Русский, Bahasa Indonesia, Türkçe, 한국어, اردو). Search by native name,
  English name or code. No flags.
- **Switches instantly**, no restart and no internet needed in the desktop and phone apps. Your
  progress, cases, keys and settings never change when you switch.
- **Follows your device** the first time: saved choice first, then your system languages, then
  English. "Use the system language" returns to automatic.
- **English (UK)** uses British spelling and day-month-year dates. English with a UK-convention
  region (UK, Ireland, Australia, India, Bangladesh, Pakistan and others) picks it automatically.
- **Right-to-left** layout for Arabic and Urdu, with mirrored navigation and arrows; charts, codes
  and numbers stay left to right.
- **Script-aware typography** for Bengali, Devanagari, Arabic, Urdu and CJK, and number, date,
  currency and list formatting for each language (Bengali digits in Bengali).
- **AI seasons in your language.** Live research and the chat builder write seasons in the
  interface language; names, figures and source titles stay as published. Seasons record the
  language they were written in, and shared `.bizsim` files keep it.
- **Reports in every script.** Non-Latin reports are produced as HTML with embedded fonts and turned
  into PDF on desktop (or printed / shared elsewhere).
- **Notifications** in your language.
- **Season translations, first sample.** M-Pesa Mobile Money is available in Bengali and Spanish.
  Other seasons show their English text inside the translated interface and say so. A filter on
  the season library shows seasons translated into your language.

## Please note

- **All translations are machine-assisted and have not been reviewed by native speakers.** Each
  language shows its status in Settings. Corrections are welcome; see `docs/I18N.md` and
  `docs/i18n/GLOSSARY.md`.
- Only one built-in season is translated (in two languages). The rest are English.
- Some server messages, desktop file dialogs and book principles stay in English. Voices are
  English only.

## For developers

- `npm run i18n:check`, `i18n:validate`, `i18n:missing`, `i18n:coverage`.
- New unit tests (`tests/i18n.test.mjs`, `tests/i18n-client.test.mjs`) and browser checks
  (`tests/e2e/i18n.py`).
- Package format: optional `contentLocale` on the season. See `docs/PACKAGE-FORMAT.md`.
- Fixed: the six-step method bar on the home page overflowed the window at 1280 px (even in English);
  it now wraps.
