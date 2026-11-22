// Report of one attempt at a season: the case, your decisions, what the
// sources record, process quality, principles, sources and your reflection.
// Built on the device, nothing is uploaded. Missing information is stated as
// missing; nothing is filled in.
//
// The report is first built as a list of blocks in the interface language,
// then rendered one of two ways:
//  * jsPDF, when every character fits its built-in Western European fonts
//    (English, Spanish, French, German, Portuguese, Indonesian, ...).
//  * HTML with embedded fonts, for every other script (Bengali, Arabic, Urdu,
//    Hindi, Chinese, Japanese, Korean, Russian, Turkish). jsPDF cannot shape
//    these scripts, so the desktop app turns the HTML into a PDF with the
//    built-in Chromium engine; browsers open the system print dialog
//    ("Save as PDF"); the phone apps share the HTML file.
import { episodesOf } from '@shared/episodes.js';
import { contentClassOf, isAiGenerated, consequenceKind } from '@shared/contentClass.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import evidenceData from '@shared/evidenceData.js';
import { libraryNow } from './library.js';
import { saveFile } from './files.js';
import { isNativeApp } from './api.js';
import { contentLangOf } from './caseLocale.js';
import { t, getLocale } from '../i18n/index.js';
import { formatDateTime, formatDecimal, formatInteger } from '../i18n/format.js';

// ---------- 1. the report as blocks ----------
/**
 * Returns [{ type: 'kicker'|'title'|'sub'|'heading'|'para'|'episode', text,
 *            muted?, bold?, indent?, accent?, small?, lang? }].
 * `lang` marks text that comes from the season (it may be in another language).
 */
export function reportBlocks(c, run, { lib = libraryNow() } = {}) {
  const out = [];
  const cl = contentLangOf(c);
  const P = (text, o = {}) => out.push({ type: 'para', text, ...o });
  const H = (text) => out.push({ type: 'heading', text });
  const k = contentClassOf(c);

  out.push({ type: 'kicker', text: t('report.kicker') });
  out.push({ type: 'title', text: c.title, lang: cl });
  out.push({ type: 'sub', text: `${c.company} · ${c.yearLabel}`, lang: cl });
  P(t('report.kind', { label: t(`contentClass.${k}.label`), help: t(`contentClass.${k}.help`) }), { muted: true, small: true });
  if (isAiGenerated(c)) P(c.model ? t('report.aiModel', { model: c.model }) : t('report.ai'), { muted: true, small: true });
  const started = formatDateTime(run.startedAt);
  const attempt = run.finishedAt ? t('report.attemptFinished', { started, finished: formatDateTime(run.finishedAt) }) : t('report.attemptOpen', { started });
  P(attempt + (run.replayOf ? ` ${t('report.replay')}` : ''), { muted: true, small: true });

  H(t('report.situation'));
  P(c.situation.headline, { bold: true, lang: cl });
  for (const p of c.situation.context || []) P(p, { lang: cl });
  if (c.situation.stakes) P(`${t('report.stakes')} ${c.situation.stakes}`, { lang: cl });

  H(t('report.decisions'));
  const byId = Object.fromEntries(run.choices.map((ch) => [ch.checkpointId, ch]));
  let made = 0;
  let matched = 0;
  let hist = 0;
  let qsum = 0;
  for (const ep of episodesOf(c)) {
    out.push({ type: 'episode', text: t('report.episode', { roman: ep.roman, title: ep.title }) + (ep.dateLabel ? ` (${ep.dateLabel})` : ''), lang: cl });
    for (const d of ep.decisions) {
      const ch = byId[d.id];
      P(d.prompt, { bold: true, lang: cl });
      if (!ch) {
        P(t('report.notDecided'), { muted: true });
        continue;
      }
      made++;
      qsum += ch.quality || 0;
      const opt = d.options.find((o) => o.id === ch.optionId);
      const h = d.options.find((o) => o.historical);
      P(`${t('report.yourCall')} ${opt?.label || t('report.unknownOption')}`, { indent: true, lang: cl });
      const q = opt?.quality;
      P(q ? t('report.quality', { label: t(`report.q${q}`), q: formatInteger(q) }) : t('report.notRated'), { indent: true, muted: true });
      if (opt?.consequence) P(`${t(`contentClass.consequence.${consequenceKind(c, d, opt)}`)}: ${opt.consequence}`, { indent: true, lang: cl });
      if (d.live || !d.outcome?.text) {
        P(t('report.open'), { indent: true, muted: true });
      } else {
        hist++;
        if (ch.historical) matched++;
        const label = k === 'scriptural' ? t('report.inNarrative') : t('report.historical');
        P(`${label} ${h?.label || t('report.notRecorded')}${ch.historical ? ` ${t('report.youMatched')}` : ''}`, { indent: true, lang: cl });
        const src = (d.outcome.sourceIds || []).map((id) => `[${c.sources.findIndex((s) => s.id === id) + 1}]`).join(' ');
        P(`${t('report.sourcesRecord')} ${d.outcome.text} ${src}`, { indent: true, lang: cl });
        const ev = c.evidenceChecks?.[d.id] || evidenceData.claims[c.id]?.[d.id];
        P(t('report.evidence', { label: t(`evidence.status.${ev ? ev[0] : 'unchecked'}.label`) }), { indent: true, muted: true });
      }
      const ps = (opt?.principles || []).map((id) => lib.principleById[id]?.name).filter(Boolean);
      if (ps.length) P(`${t('report.principles')} ${ps.join('; ')}`, { indent: true, muted: true, lang: 'en' });
    }
    if (ep.insight?.text) P(`${t('report.episodeInsight')} ${ep.insight.text}`, { accent: true, lang: cl });
  }

  H(t('report.summary'));
  P(t('report.made', { made: formatInteger(made), total: formatInteger(c.checkpoints.length) }));
  P(hist ? t('report.matched', { matched: formatInteger(matched), total: formatInteger(hist) }) : t('report.matchedNone'));
  P(made ? t('report.avg', { avg: formatDecimal(qsum / made, 1) }) : t('report.avgNone'));

  if (c.outcome?.lessons?.length) {
    H(t('report.lessons'));
    for (const l of c.outcome.lessons) P(`• ${l.text}`, { lang: cl });
  }

  H(t('report.reflection'));
  if (run.reflection) P(run.reflection, { lang: 'und' });
  else P(t('report.noReflection'), { muted: true });

  H(t('report.sources'));
  c.sources.forEach((s, i) => P(`[${i + 1}] ${s.title}${s.publisher ? `, ${s.publisher}` : ''}. ${s.url}`, { small: true, lang: 'und' }));
  P(t('report.evidenceNote'), { muted: true, small: true });
  return out;
}

// ---------- 2a. jsPDF (Western European scripts) ----------
const WINANSI = /[ -~ -ÿ–—‘’“”•…€]/;
const fitsWinAnsi = (s) => [...String(s ?? '').normalize('NFC')].every((ch) => WINANSI.test(ch) || [...ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')].every((x) => WINANSI.test(x)));
function pdfText(s) {
  return [...String(s ?? '').normalize('NFC')]
    .map((ch) => {
      if (WINANSI.test(ch)) return ch;
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      return [...base].every((x) => WINANSI.test(x)) ? base : '?';
    })
    .join('');
}

/** True when the jsPDF fonts can show every character of the report. */
export const canUseBuiltInPdf = (blocks) => blocks.every((b) => fitsWinAnsi(b.text));

export async function renderPdf(blocks, footerTitle) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const Hh = doc.internal.pageSize.getHeight();
  const M = 54;
  let y = M;
  const GOLD = [154, 120, 60];
  const INK = [24, 24, 26];
  const MUTED = [100, 100, 104];
  const ensure = (h) => {
    if (y + h > Hh - M) {
      doc.addPage();
      y = M;
    }
  };
  const para = (text, { size = 10.5, color = INK, bold = false, gap = 6, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(pdfText(text), W - 2 * M - indent)) {
      ensure(size * 1.35);
      doc.text(line, M + indent, y);
      y += size * 1.35;
    }
    y += gap;
  };
  for (const b of blocks) {
    if (b.type === 'kicker') para(b.text.toUpperCase(), { size: 9, color: GOLD, bold: true, gap: 10 });
    else if (b.type === 'title') para(b.text, { size: 20, bold: true, gap: 4 });
    else if (b.type === 'sub') para(b.text, { size: 11, color: MUTED, gap: 10 });
    else if (b.type === 'episode') para(b.text, { size: 12, bold: true, gap: 4 });
    else if (b.type === 'heading') {
      ensure(40);
      y += 8;
      doc.setDrawColor(...GOLD);
      doc.setLineWidth(0.8);
      doc.line(M, y, M + 28, y);
      y += 14;
      para(b.text.toUpperCase(), { size: 9, color: GOLD, bold: true, gap: 4 });
    } else para(b.text, { size: b.small ? 9 : 10.5, color: b.accent ? GOLD : b.muted ? MUTED : INK, bold: b.bold, gap: b.indent ? 2 : 6, indent: b.indent ? 10 : 0 });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(`BIZSIM · ${footerTitle}`).slice(0, 90), M, Hh - 28);
    doc.text(`${i} / ${pages}`, W - M, Hh - 28, { align: 'right' });
  }
  return doc.output('arraybuffer');
}

// ---------- 2b. HTML (every script) ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Only the font the report needs is loaded, as a data URL, so the HTML file
// is self-contained and works offline in any viewer.
const FONT_LOADERS = {
  bengali: () => import('../assets/fonts/noto-sans-bengali-bengali-wght-normal.woff2?inline'),
  devanagari: () => import('../assets/fonts/noto-sans-devanagari-devanagari-wght-normal.woff2?inline'),
  arabic: () => import('../assets/fonts/noto-naskh-arabic-arabic-wght-normal.woff2?inline'),
  urdu: () => import('../assets/fonts/noto-nastaliq-urdu-arabic-400-normal.woff2?inline'),
};
const SCRIPT_TESTS = { bengali: /[ঀ-৿]/, devanagari: /[ऀ-ॿ]/, arabic: /[؀-ۿ]/ };

async function fontFaces(blocks, locale) {
  const text = blocks.map((b) => b.text).join(' ');
  const need = new Set(Object.entries(SCRIPT_TESTS).filter(([, re]) => re.test(text)).map(([k]) => k));
  if (locale === 'ur') need.add('urdu');
  const css = [];
  for (const k of need) {
    try {
      const url = (await FONT_LOADERS[k]()).default;
      css.push(`@font-face{font-family:'BIZSIM ${k}';src:url(${url}) format('woff2');font-display:block}`);
    } catch {
      /* the system font is used instead */
    }
  }
  return { css: css.join('\n'), families: [...need].map((k) => `'BIZSIM ${k}'`) };
}

export async function renderHtml(blocks, { locale = getLocale(), title = 'BIZSIM' } = {}) {
  const l = LOCALE_BY_CODE[locale] || LOCALE_BY_CODE.en;
  const fonts = await fontFaces(blocks, locale);
  const stack = [...(locale === 'ur' ? ["'BIZSIM urdu'"] : []), ...fonts.families.filter((f) => f !== "'BIZSIM urdu'"), 'system-ui', '-apple-system', "'Segoe UI'", "'Noto Sans'", 'Roboto', "'PingFang SC'", "'Hiragino Sans'", "'Microsoft YaHei'", "'Yu Gothic'", "'Malgun Gothic'", 'sans-serif'].join(',');
  const lineHeight = l.script === 'urdu' ? 2.1 : l.script && l.script !== 'cjk' ? 1.75 : 1.55;
  const body = blocks
    .map((b) => {
      const lang = b.lang && b.lang !== l.intl ? ` lang="${esc(b.lang)}" dir="auto"` : '';
      const cls = [b.type, b.muted && 'muted', b.bold && 'bold', b.indent && 'indent', b.accent && 'accent', b.small && 'small'].filter(Boolean).join(' ');
      if (b.type === 'title') return `<h1${lang}>${esc(b.text)}</h1>`;
      if (b.type === 'heading') return `<h2>${esc(b.text)}</h2>`;
      if (b.type === 'episode') return `<h3${lang}>${esc(b.text)}</h3>`;
      return `<p class="${cls}"${lang}>${esc(b.text)}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html>
<html lang="${esc(l.intl)}" dir="${l.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:">
<title>${esc(title)}</title>
<style>
${fonts.css}
@page{size:A4;margin:18mm}
html{font-family:${stack};color:#18181a;background:#fff;line-height:${lineHeight}}
body{max-width:760px;margin:24px auto;padding:0 20px;font-size:11pt}
.kicker{color:#9a783c;font-weight:700;font-size:9pt;letter-spacing:.06em}
h1{font-size:20pt;margin:.2em 0}
.sub{color:#646468;margin-top:0}
h2{color:#9a783c;font-size:10pt;margin:1.6em 0 .4em;padding-top:.6em;border-top:1px solid #9a783c}
h3{font-size:12pt;margin:1.2em 0 .3em}
p{margin:.25em 0 .5em;overflow-wrap:anywhere}
.bold{font-weight:700}.muted{color:#646468}.accent{color:#9a783c}.small{font-size:9pt}
.indent{margin-inline-start:12px;margin-block:.15em}
footer{margin-top:2em;color:#646468;font-size:8pt}
html[lang|="${esc(l.intl)}"] .kicker{letter-spacing:${l.script ? '0' : '.06em'}}
</style>
</head>
<body>
${body}
<footer>BIZSIM · ${esc(title)}</footer>
</body>
</html>`;
}

// ---------- 3. download ----------
const fileStem = (c) => `bizsim-report-${String(c.company || c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'season'}`;

/** Print an HTML report from a hidden frame (browsers: "Save as PDF"). */
function printHtml(html) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('sandbox', 'allow-modals allow-same-origin');
    frame.style.cssText = 'position:fixed;inset-inline-start:-10000px;top:0;width:800px;height:600px;border:0';
    frame.srcdoc = html;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        resolve('printed');
      } catch (e) {
        reject(e);
      } finally {
        setTimeout(() => frame.remove(), 60_000);
      }
    };
    document.body.appendChild(frame);
  });
}

/**
 * Create and deliver the report. Returns 'downloaded' | 'shared' | 'printed' | 'cancelled'.
 */
export async function downloadReport(c, run) {
  const blocks = reportBlocks(c, run);
  const stem = fileStem(c);
  if (canUseBuiltInPdf(blocks)) {
    const buf = await renderPdf(blocks, c.title);
    return saveFile(`${stem}.pdf`, new Uint8Array(buf), 'application/pdf');
  }
  const html = await renderHtml(blocks, { title: c.title });
  const desktop = typeof window !== 'undefined' ? window.bizsimDesktop : null;
  if (desktop?.htmlToPdf) {
    const pdf = await desktop.htmlToPdf(html);
    return saveFile(`${stem}.pdf`, new Uint8Array(pdf), 'application/pdf');
  }
  if (isNativeApp()) return saveFile(`${stem}.html`, html, 'text/html');
  return printHtml(html);
}

/** Which format the report will be delivered in, for the button label. */
export function reportFormat(c, run) {
  if (canUseBuiltInPdf(reportBlocks(c, run))) return 'pdf';
  if (typeof window !== 'undefined' && window.bizsimDesktop?.htmlToPdf) return 'pdf';
  return isNativeApp() ? 'html' : 'print';
}

