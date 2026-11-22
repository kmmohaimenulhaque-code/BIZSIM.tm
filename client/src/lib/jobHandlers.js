// Registers what background jobs do when they report results, so it happens
// even if the screen that started the job is not open.
import { onJobEvent } from './jobs.js';
import { saveGeneratedCase, addResearchHistory } from './store.js';
import './chatStore.js';
import { notifyEvent } from './notify.js';
import { t } from '../i18n/index.js';

onJobEvent('research', (event, d, job) => {
  if (event !== 'result') return;
  if (d.generated?.case) saveGeneratedCase(d.generated.case);
  addResearchHistory({ query: job.meta?.q || d.query, name: d.profile?.name || null, id: d.profile?.id || null, sourcesCount: (d.sources || []).length, generated: Boolean(d.generated) });
  const name = d.profile?.name || job.meta?.q || d.query || '';
  notifyEvent('researchDone', {
    key: `research|${job.id || name}`,
    title: t('notify.research.title'),
    body: d.generated?.case ? t('notify.research.bodySeason', { name }) : t('notify.research.body', { name }),
    link: d.generated?.case ? `/cases/${d.generated.case.id}` : `/research?q=${encodeURIComponent(name)}`,
  });
});
