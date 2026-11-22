// Interface language picker for Settings. Native names, searchable by native
// name, English name or code. No flags: languages are not countries.
import { useEffect, useMemo, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { LOCALES, LOCALE_BY_CODE, STATUS_LABEL } from '@shared/locales.js';
import { useTranslation, setLocale, followSystemLanguage, savedLocaleCode, useLocale, getLocale, prefetchLanguages } from '../i18n/index.js';
import { toast } from './ui.jsx';

const fold = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export function matchesLanguage(l, q) {
  const n = fold(q).trim();
  if (!n) return true;
  return [l.native, l.english, l.code, l.intl].some((v) => fold(v).includes(n));
}

export function LanguagePanel() {
  const { t } = useTranslation();
  const locale = useLocale();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const saved = savedLocaleCode();
  // In a browser, cache every language now so switching later also works offline.
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine !== false) prefetchLanguages();
  }, []);
  const cur = LOCALE_BY_CODE[locale] || LOCALE_BY_CODE.en;
  const list = useMemo(() => LOCALES.filter((l) => matchesLanguage(l, q)), [q]);
  const statusText = (l) => t(`language.status.${l.status}`, { defaultValue: STATUS_LABEL[l.status] });

  const choose = async (code) => {
    if (busy) return;
    setBusy(true);
    try {
      if (code == null) await followSystemLanguage();
      else await setLocale(code);
      toast(t('language.changed', { name: (LOCALE_BY_CODE[getLocale()] || cur).native }));
    } catch {
      toast(t('language.failed', { name: cur.native }), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="lang-h" id="language">
      <h2 id="lang-h" className="section-title row gap-2">
        <Languages size={18} aria-hidden="true" /> {t('language.title')}
      </h2>
      <div className="lang-current" aria-live="polite">
        <span className="meta-caps">{t('language.current')}</span>
        <span className="lang-current-name" lang={cur.intl} dir={cur.dir}>
          {cur.native}
        </span>
        <span className="meta">
          {cur.native !== cur.english && <span lang="en">{cur.english} · </span>}
          {statusText(cur)}
        </span>
      </div>
      <div className="field">
        <label htmlFor="lang-q">{t('language.search')}</label>
        <input id="lang-q" className="input" type="search" dir="auto" autoComplete="off" spellCheck={false} placeholder={t('language.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="lang-list" role="radiogroup" aria-label={t('language.listLabel')} aria-busy={busy}>
        {!q && (
          <button type="button" role="radio" aria-checked={saved == null} className="lang-option" onClick={() => choose(null)} disabled={busy}>
            <span className="lang-names">
              <span className="lang-native">{t('language.system')}</span>
              {saved == null && <span className="meta">{t('language.systemNow', { name: cur.native })}</span>}
            </span>
            {saved == null && <Check size={18} aria-hidden="true" className="lang-check" />}
          </button>
        )}
        {list.map((l) => {
          const on = saved === l.code;
          return (
            <button type="button" key={l.code} role="radio" aria-checked={on} className="lang-option" onClick={() => choose(l.code)} disabled={busy}>
              <span className="lang-names">
                <span className="lang-native" lang={l.intl} dir={l.dir}>
                  {l.native}
                </span>
                <span className="meta">
                  {l.native !== l.english && <span lang="en">{l.english} · </span>}
                  <span dir="ltr">{l.code}</span> · {statusText(l)}
                </span>
              </span>
              {on && <Check size={18} aria-hidden="true" className="lang-check" />}
            </button>
          );
        })}
        {list.length === 0 && <p className="meta">{t('language.noMatch', { q })}</p>}
      </div>
      <p className="meta">{t('language.note')}</p>
      <p className="meta">{t('language.machineNote')}</p>
      {locale === 'en-GB' && <p className="meta">{t('language.variantNote')}</p>}
    </section>
  );
}
