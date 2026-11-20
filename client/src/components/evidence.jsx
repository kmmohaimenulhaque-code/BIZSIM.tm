// Per-claim evidence status, from the build-time source check (curated
// seasons) or the check run when an AI season was written (live research and
// chat builder). See shared/evidenceCheck.js for what the check can and cannot show.
import { EVIDENCE, sourceKind, KIND_LABEL, KIND_HELP } from '@shared/evidenceCheck.js';
import { contentClassOf, CONTENT_CLASSES, isAiGenerated, evidenceNoteOf } from '@shared/contentClass.js';
import evidenceData from '@shared/evidenceData.js';
import { Badge, Callout } from './ui.jsx';
import { EVIDENCE_ICON, evidenceTone } from './trust.jsx';
import { fmtDate } from '../lib/format.js';

/** [status, matched, total] for one claim (a decision id or 'ev<i>'). */
export function evidenceFor(c, key, sourceIds) {
  const e = c.evidenceChecks?.[key] || evidenceData.claims[c.id]?.[key];
  if (e) return e;
  return [sourceIds && sourceIds.length ? 'unchecked' : 'insufficient', 0, 0];
}

export function EvidenceTag({ c, claimKey, sourceIds }) {
  const [status, matched, total] = evidenceFor(c, claimKey, sourceIds);
  const d = EVIDENCE[status];
  const Icon = EVIDENCE_ICON[status];
  const detail = total ? ` (${matched} of ${total} specific details found in the source)` : '';
  return (
    <Badge tone={evidenceTone(status)} icon={Icon} title={`${d.label}${detail}. ${d.help}`}>
      <span aria-hidden="true">{d.short}</span>
      <span className="sr-only">
        Evidence: {d.label}
        {detail}
      </span>
    </Badge>
  );
}

export function SourceKindTag({ s }) {
  const k = sourceKind(s);
  return (
    <span className="meta" title={KIND_HELP[k]}>
      {KIND_LABEL[k]}
    </span>
  );
}

function seasonTally(c) {
  const claims = c.evidenceChecks || evidenceData.claims[c.id] || {};
  const t = { verified: 0, available: 0, inaccessible: 0, insufficient: 0, unchecked: 0 };
  for (const [s] of Object.values(claims)) t[s] = (t[s] || 0) + 1;
  return { t, n: Object.values(claims).length };
}

/** "How this season was checked": classification, AI disclosure, evidence method. */
export function TrustPanel({ c }) {
  const k = contentClassOf(c);
  const note = evidenceNoteOf(c);
  const { t, n } = seasonTally(c);
  const checkedAt = c.evidenceCheckedAt || (evidenceData.claims[c.id] ? evidenceData.checkedAt : null);
  return (
    <details className="trust-panel">
      <summary>
        <span className="section-title">How this season was checked</span>
      </summary>
      <div className="stack gap-3 mt-3">
        <p className="body">
          <strong>{CONTENT_CLASSES[k].label}.</strong> {CONTENT_CLASSES[k].help}
        </p>
        {note && <Callout tone="warning">{note}</Callout>}
        {isAiGenerated(c) && (
          <p className="body">
            <strong>AI disclosure.</strong> This season was written by an AI model{c.model ? ` (${c.model})` : ''}
            {c.generatedAt ? ` on ${fmtDate(c.generatedAt)}` : ''} from the sources listed, which it was instructed to cite for every outcome. Models can still misread or misstate sources.
          </p>
        )}
        {n > 0 ? (
          <>
            <p className="body">
              <strong>Evidence check.</strong> {t.verified} of {n} outcomes and evidence items had their specific dates, figures and names found in the cited source text
              {t.available ? `; ${t.available} could not be confirmed this way and are marked “Not verified”` : ''}
              {t.inaccessible ? `; ${t.inaccessible} cite a source that could not be reached` : ''}
              {t.insufficient ? `; ${t.insufficient} cite no source` : ''}.{checkedAt ? ` Checked ${fmtDate(checkedAt)}.` : ''}
            </p>
            <p className="meta">An automated check shows whether the sources state the same details. It does not prove that the history is true, and sources can be wrong or disputed. Follow the source links for the full account.</p>
          </>
        ) : (
          <p className="meta">The claims in this season have not been compared with their sources automatically.</p>
        )}
        <ul className="evidence-legend">
          {['verified', 'available', 'inaccessible', 'insufficient'].map((s) => {
            const Icon = EVIDENCE_ICON[s];
            return (
              <li key={s}>
                <Badge tone={evidenceTone(s)} icon={Icon}>
                  {EVIDENCE[s].short}
                </Badge>{' '}
                <span className="meta">
                  {EVIDENCE[s].label}: {EVIDENCE[s].help}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
