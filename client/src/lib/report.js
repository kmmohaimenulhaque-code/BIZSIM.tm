// PDF report of one attempt at a season: the case, your decisions, what the
// sources record, process quality, principles, sources and your reflection.
// Built on the device (jsPDF), nothing is uploaded. Missing information is
// stated as missing; nothing is filled in.
import { episodesOf } from '@shared/episodes.js';
import { CONTENT_CLASSES, contentClassOf, isAiGenerated, consequenceKind, CONSEQUENCE_LABEL } from '@shared/contentClass.js';
import { EVIDENCE } from '@shared/evidenceCheck.js';
import evidenceData from '@shared/evidenceData.js';
import { libraryNow } from './library.js';
import { saveFile } from './files.js';

const QUALITY = { 1: 'Weak process', 2: 'Sound process', 3: 'Strong process' };

// The built-in PDF fonts cover Western European text (WinAnsi). Anything else
// is transliterated where possible so the report never shows broken glyphs.
const WINANSI = /[ -~ -ÿ–—‘’“”•…€]/;
function pdfText(s) {
  return [...String(s ?? '').normalize('NFC')]
    .map((ch) => {
      if (WINANSI.test(ch)) return ch;
      const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
      return [...base].every((c) => WINANSI.test(c)) ? base : '?';
    })
    .join('');
}

export async function buildReport(c, run) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  const lib = libraryNow();
  let y = M;
  const GOLD = [154, 120, 60];
  const INK = [24, 24, 26];
  const MUTED = [100, 100, 104];

  const ensure = (h) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const para = (text, { size = 10.5, color = INK, bold = false, gap = 6, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(text), W - 2 * M - indent);
    for (const line of lines) {
      ensure(size * 1.35);
      doc.text(line, M + indent, y);
      y += size * 1.35;
    }
    y += gap;
  };
  const heading = (text) => {
    ensure(40);
    y += 8;
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.line(M, y, M + 28, y);
    y += 14;
    para(text.toUpperCase(), { size: 9, color: GOLD, bold: true, gap: 4 });
  };

  // ---------- cover ----------
  para('BIZSIM · SEASON REPORT', { size: 9, color: GOLD, bold: true, gap: 10 });
  para(c.title, { size: 20, bold: true, gap: 4 });
  para(`${c.company} · ${c.yearLabel}`, { size: 11, color: MUTED, gap: 10 });
  const k = contentClassOf(c);
  para(`Kind of account: ${CONTENT_CLASSES[k].label}. ${CONTENT_CLASSES[k].help}`, { size: 9.5, color: MUTED });
  if (isAiGenerated(c)) para(`AI disclosure: this season was written by an AI model${c.model ? ` (${c.model})` : ''} from the cited sources. Check important facts in the sources.`, { size: 9.5, color: MUTED });
  para(`Attempt started ${new Date(run.startedAt).toLocaleString()}${run.finishedAt ? `, finished ${new Date(run.finishedAt).toLocaleString()}` : ' (not finished)'}${run.replayOf ? '. This was a replay.' : '.'}`, { size: 9.5, color: MUTED, gap: 12 });

  heading('The situation');
  para(c.situation.headline, { bold: true });
  for (const p of c.situation.context || []) para(p);
  if (c.situation.stakes) para(`Stakes: ${c.situation.stakes}`);

  // ---------- decisions ----------
  heading('Your decisions');
  const byId = Object.fromEntries(run.choices.map((ch) => [ch.checkpointId, ch]));
  let made = 0;
  let matched = 0;
  let hist = 0;
  let qsum = 0;
  for (const ep of episodesOf(c)) {
    para(`Episode ${ep.roman}: ${ep.title}${ep.dateLabel ? ` (${ep.dateLabel})` : ''}`, { size: 12, bold: true, gap: 4 });
    for (const d of ep.decisions) {
      const ch = byId[d.id];
      para(d.prompt, { bold: true, gap: 3 });
      if (!ch) {
        para('Not decided in this attempt.', { color: MUTED });
        continue;
      }
      made++;
      qsum += ch.quality || 0;
      const opt = d.options.find((o) => o.id === ch.optionId);
      const h = d.options.find((o) => o.historical);
      para(`Your call: ${opt?.label || 'Unknown option'}`, { indent: 10, gap: 2 });
      para(`Process quality: ${QUALITY[opt?.quality] || 'Not rated'} (${opt?.quality ?? '?'} of 3).`, { indent: 10, gap: 2, color: MUTED });
      if (opt?.consequence) para(`${CONSEQUENCE_LABEL[consequenceKind(c, d, opt)]}: ${opt.consequence}`, { indent: 10, gap: 2 });
      if (d.live || !d.outcome?.text) {
        para('Outcome: none recorded. This decision is still open, so there is no documented result.', { indent: 10, color: MUTED });
      } else {
        hist++;
        if (ch.historical) matched++;
        para(`${k === 'scriptural' ? 'In the narrative' : 'Historical choice'}: ${h?.label || 'Not recorded'}${ch.historical ? ' (you matched it)' : ''}.`, { indent: 10, gap: 2 });
        const src = (d.outcome.sourceIds || []).map((id) => `[${c.sources.findIndex((s) => s.id === id) + 1}]`).join(' ');
        para(`What the sources record: ${d.outcome.text} ${src}`, { indent: 10, gap: 2 });
        const ev = c.evidenceChecks?.[d.id] || evidenceData.claims[c.id]?.[d.id];
        para(`Evidence status: ${ev ? EVIDENCE[ev[0]].label : EVIDENCE.unchecked.label}.`, { indent: 10, color: MUTED });
      }
      const ps = (opt?.principles || []).map((id) => lib.principleById[id]?.name).filter(Boolean);
      if (ps.length) para(`Principles at work: ${ps.join('; ')}.`, { indent: 10, color: MUTED });
    }
    if (ep.insight?.text) para(`Episode insight: ${ep.insight.text}`, { color: GOLD, gap: 10 });
  }

  heading('Summary');
  para(`Decisions made: ${made} of ${c.checkpoints.length}.`, { gap: 2 });
  para(hist ? `Matched history: ${matched} of ${hist} documented decisions. Matching history is not a grade: history was sometimes wrong.` : 'Matched history: not applicable (no documented outcomes in this attempt).', { gap: 2 });
  para(made ? `Average process quality: ${(qsum / made).toFixed(1)} of 3, judged on what was known at the time, not on how things turned out.` : 'Average process quality: no decisions yet.');

  if (c.outcome?.lessons?.length) {
    heading('Season lessons');
    for (const l of c.outcome.lessons) para(`• ${l.text}`);
  }

  heading('Your reflection');
  para(run.reflection || 'No reflection written for this attempt.', { color: run.reflection ? INK : MUTED });

  heading('Sources');
  c.sources.forEach((s, i) => para(`[${i + 1}] ${s.title}${s.publisher ? `, ${s.publisher}` : ''}. ${s.url}`, { size: 9, gap: 3 }));
  para('Evidence statuses come from an automated check that looks for each claim’s dates, figures and names in the cited source text. A match shows the source states the same details; it does not prove the history.', { size: 8.5, color: MUTED });

  // footers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(`BIZSIM · ${c.title}`).slice(0, 90), M, H - 28);
    doc.text(`${i} / ${pages}`, W - M, H - 28, { align: 'right' });
  }
  return doc.output('arraybuffer');
}

export async function downloadReport(c, run) {
  const buf = await buildReport(c, run);
  const name = `bizsim-report-${String(c.company || c.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.pdf`;
  return saveFile(name, new Uint8Array(buf), 'application/pdf');
}
