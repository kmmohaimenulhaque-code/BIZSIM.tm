// Per-claim evidence status, from the build-time source check (curated
// seasons) or the check run when an AI season was written (live research and
// chat builder). See shared/evidenceCheck.js for what the check can and cannot show.
import { sourceKind } from '@shared/evidenceCheck.js';
import { contentClassOf, isAiGenerated } from '@shared/contentClass.js';
import evidenceData from '@shared/evidenceData.js';
import { Badge, Callout } from './ui.jsx';
import { EVIDENCE_ICON, evidenceTone, evidenceNoteOf } from './trust.jsx';
import { fmtDate } from '../lib/format.js';
import { useTranslation } from '../i18n/index.js';

/** [status, matched, total] for one claim (a decision id or 'ev<i>'). */
export function evidenceFor(c, key, sourceIds) {
  const e = c.evidenceChecks?.[key] || evidenceData.claims[c.id]?.[key];
  if (e) return e;
  return [sourceIds && sourceIds.length ? 'unchecked' : 'insufficient', 0, 0];
}

export function EvidenceTag({ c, claimKey, sourceIds }) {
  const { t } = useTranslation();
  const [status, matched, total] = evidenceFor(c, claimKey, sourceIds);
  const Icon = EVIDENCE_ICON[status];
  const label = t(`evidence.status.${status}.label`);
  const detail = total ? t('evidence.detail', { matched, total }) : '';
  return (
    <Badge tone={evidenceTone(status)} icon={Icon} title={t('evidence.tagTitle', { label, detail, help: t(`evidence.status.${status}.help`) })}>
      <span aria-hidden="true">{t(`evidence.status.${status}.short`)}</span>
      <span className="sr-only">{t('evidence.srLabel', { label, detail })}</span>
    </Badge>
  );
}

export function SourceKindTag({ s }) {
  const { t } = useTranslation();
  const k = sourceKind(s);
  return (
    <span className="meta" title={t(`evidence.kindHelp.${k}`)}>
      {t(`evidence.kind.${k}`)}
    </span>
  );
}

function seasonTally(c) {
  const claims = c.evidenceChecks || evidenceData.claims[c.id] || {};
  const tally = { verified: 0, available: 0, inaccessible: 0, insufficient: 0, unchecked: 0 };
  for (const [s] of Object.values(claims)) tally[s] = (tally[s] || 0) + 1;
  return { tally, n: Object.values(claims).length };
}

/** "How this season was checked": classification, AI disclosure, evidence method. */
export function TrustPanel({ c }) {
  const { t } = useTranslation();
  const k = contentClassOf(c);
  const note = evidenceNoteOf(c);
  const { tally, n } = seasonTally(c);
  const checkedAt = c.evidenceCheckedAt || (evidenceData.claims[c.id] ? evidenceData.checkedAt : null);
  return (
    <details className="trust-panel">
      <summary>
        <span className="section-title">{t('evidence.panel.title')}</span>
      </summary>
      <div className="stack gap-3 mt-3">
        <p className="body">
          <strong>{t(`contentClass.${k}.label`)}.</strong> {t(`contentClass.${k}.help`)}
        </p>
        {note && <Callout tone="warning">{note}</Callout>}
        {isAiGenerated(c) && (
          <p className="body">
            <strong>{t('evidence.panel.aiTitle')}</strong>{' '}
            {t('evidence.panel.ai', {
              model: c.model ? t('evidence.panel.aiModel', { model: c.model }) : '',
              date: c.generatedAt ? t('evidence.panel.aiDate', { date: fmtDate(c.generatedAt) }) : '',
            })}
          </p>
        )}
        {n > 0 ? (
          <>
            <p className="body">
              <strong>{t('evidence.panel.checkTitle')}</strong> {t('evidence.panel.checkVerified', { verified: tally.verified, total: n })}
              {tally.available ? t('evidence.panel.checkAvailable', { count: tally.available }) : ''}
              {tally.inaccessible ? t('evidence.panel.checkInaccessible', { count: tally.inaccessible }) : ''}
              {tally.insufficient ? t('evidence.panel.checkInsufficient', { count: tally.insufficient }) : ''}.{checkedAt ? t('evidence.panel.checkedOn', { date: fmtDate(checkedAt) }) : ''}
            </p>
            <p className="meta">{t('evidence.panel.disclaimer')}</p>
          </>
        ) : (
          <p className="meta">{t('evidence.panel.notChecked')}</p>
        )}
        <ul className="evidence-legend">
          {['verified', 'available', 'inaccessible', 'insufficient'].map((s) => {
            const Icon = EVIDENCE_ICON[s];
            return (
              <li key={s}>
                <Badge tone={evidenceTone(s)} icon={Icon}>
                  {t(`evidence.status.${s}.short`)}
                </Badge>{' '}
                <span className="meta">
                  {t(`evidence.status.${s}.label`)}: {t(`evidence.status.${s}.help`)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
