// How much to trust what a season says: its kind of account, whether AI wrote
// it, and how each claim compares with its cited sources.
import { BookOpen, Sparkles, ShieldCheck, ShieldQuestion, ShieldAlert, ShieldOff, CircleDashed, ScrollText, Radio, GitBranch } from 'lucide-react';
import { contentClassOf, isAiGenerated, evidenceNoteOf as noteKey } from '@shared/contentClass.js';
import { Badge } from './ui.jsx';
import { useTranslation, t as tr } from '../i18n/index.js';

const CLASS_ICON = { documented: BookOpen, scriptural: ScrollText, live: Radio, counterfactual: GitBranch };
const CLASS_TONE = { documented: undefined, scriptural: 'accent', live: 'warning', counterfactual: 'warning' };

export function ContentClassBadge({ c, short = false }) {
  const { t } = useTranslation();
  const k = contentClassOf(c);
  return (
    <Badge tone={CLASS_TONE[k]} icon={CLASS_ICON[k]} title={t(`contentClass.${k}.help`)}>
      {t(`contentClass.${k}.${short ? 'short' : 'label'}`)}
    </Badge>
  );
}

export function AiBadge({ c }) {
  const { t } = useTranslation();
  if (!isAiGenerated(c)) return null;
  return (
    <Badge tone="ai" icon={Sparkles} title={c.model ? t('contentClass.aiWrittenHintModel', { model: c.model }) : t('contentClass.aiWrittenHint')}>
      {t('contentClass.aiWritten')}
    </Badge>
  );
}

export function TrustBadges({ c, short = false }) {
  return (
    <>
      <ContentClassBadge c={c} short={short} />
      <AiBadge c={c} />
    </>
  );
}

/** Caution note for seasons with thin or traditional sources, in the current language. */
export function evidenceNoteOf(c) {
  if (!c) return null;
  if (c.evidenceNote) return c.evidenceNote;
  return noteKey(c) ? tr(`contentClass.notes.${c.id}`, { defaultValue: noteKey(c) }) : null;
}

export const EVIDENCE_ICON = { verified: ShieldCheck, available: ShieldQuestion, inaccessible: ShieldOff, insufficient: ShieldAlert, unchecked: CircleDashed };
const EVIDENCE_TONE = { verified: 'success', available: undefined, inaccessible: 'warning', insufficient: 'warning', unchecked: undefined };

export function evidenceTone(status) {
  return EVIDENCE_TONE[status];
}
