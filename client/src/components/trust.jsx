// How much to trust what a season says: its kind of account, whether AI wrote
// it, and how each claim compares with its cited sources.
import { BookOpen, Sparkles, ShieldCheck, ShieldQuestion, ShieldAlert, ShieldOff, CircleDashed, ScrollText, Radio, GitBranch } from 'lucide-react';
import { CONTENT_CLASSES, contentClassOf, isAiGenerated, evidenceNoteOf } from '@shared/contentClass.js';
import { Badge } from './ui.jsx';

const CLASS_ICON = { documented: BookOpen, scriptural: ScrollText, live: Radio, counterfactual: GitBranch };
const CLASS_TONE = { documented: undefined, scriptural: 'accent', live: 'warning', counterfactual: 'warning' };

export function ContentClassBadge({ c, short = false }) {
  const k = contentClassOf(c);
  const d = CONTENT_CLASSES[k];
  return (
    <Badge tone={CLASS_TONE[k]} icon={CLASS_ICON[k]} title={d.help}>
      {short ? d.short : d.label}
    </Badge>
  );
}

export function AiBadge({ c }) {
  if (!isAiGenerated(c)) return null;
  return (
    <Badge tone="ai" icon={Sparkles} title={`Written by an AI model${c.model ? ` (${c.model})` : ''} from the cited sources. Check important facts in the sources.`}>
      AI-written
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

export { evidenceNoteOf };

export const EVIDENCE_ICON = { verified: ShieldCheck, available: ShieldQuestion, inaccessible: ShieldOff, insufficient: ShieldAlert, unchecked: CircleDashed };
const EVIDENCE_TONE = { verified: 'success', available: undefined, inaccessible: 'warning', insufficient: 'warning', unchecked: undefined };

export function evidenceTone(status) {
  return EVIDENCE_TONE[status];
}
