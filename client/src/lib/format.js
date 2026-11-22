// Display helpers used across the app. All text and formats follow the
// selected language (see client/src/i18n). Values are never changed.
import { t } from '../i18n/index.js';
import { formatDate, formatRelative, formatCurrency, formatSigned } from '../i18n/format.js';

export const domainLabel = (d) => t(`taxonomy.domain.${d}`, { defaultValue: d });
export const eraLabel = (e) => t(`taxonomy.era.${e}`, { defaultValue: e });
export const difficultyLabel = (n) => t(`taxonomy.difficulty.${n}`, { defaultValue: t('taxonomy.difficulty.2') });
export const pillarName = (p) => t(`taxonomy.pillar.${p}.name`, { defaultValue: p });

export const relTime = (iso) => (iso ? formatRelative(iso) : '');
export const fmtDate = (iso) => (iso ? formatDate(iso) : t('common.undated'));

/** Large amounts in their own currency, compact (e.g. "$1.2B", "1,2 Mrd. $"). */
export const compactMoney = (v, unit = 'USD') => formatCurrency(v, unit, { compact: Math.abs(v) >= 1e6 });

export const signed = (n) => formatSigned(n);
