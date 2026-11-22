// Notification centre: the inbox, and every notification setting in one place.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Check, Trash2, Plus } from 'lucide-react';
import { Button, Callout, Empty, toast } from '../components/ui.jsx';
import { CATEGORY } from '@shared/notifyPlan.js';

const CATEGORY_IDS = Object.keys(CATEGORY);
const hhmm = (v) => {
  const [h, m] = String(v || '00:00').split(':').map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  return formatTime(d);
};
import { useStore, uid } from '../lib/store.js';
import { notifySettings, permissionState, enableNotifications, disableAllNotifications, updateNotifySettings, markRead, clearInbox, removeFromInbox, useInbox } from '../lib/notify.js';
import { isNativeApp } from '../lib/api.js';
import { relTime } from '../lib/format.js';
import { useTranslation } from '../i18n/index.js';
import { weekdayNames, formatList, formatTime } from '../i18n/format.js';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  useStore((s) => s.notify);
  const s = notifySettings();
  const inbox = useInbox();
  const [perm, setPerm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [time, setTime] = useState('18:00');

  useEffect(() => {
    document.title = t('notify.page.docTitle');
  }, [t, i18n.language]);
  useEffect(() => {
    permissionState().then(setPerm);
  }, []);
  const unread = inbox.filter((n) => !n.read).length;

  const turnOn = async () => {
    setBusy(true);
    try {
      const p = await enableNotifications();
      setPerm(p);
      if (p === 'granted') toast(t('notify.page.on'));
      else if (p === 'unsupported') toast(t('notify.page.unsupported'), 'error');
      else toast(t('notify.page.notAllowed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  const set = (patch) => updateNotifySettings(patch);

  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">{t('notify.page.eyebrow')}</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          {t('notify.page.title')}
        </h1>
        <p className="lead">{t('notify.page.lead')}</p>
      </header>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-inbox">
        <div className="row between wrap gap-2">
          <h2 id="nc-inbox" className="section-title">
            {unread ? t('notify.page.inboxUnread', { count: unread }) : t('notify.page.inbox')}
          </h2>
          {inbox.length > 0 && (
            <div className="row gap-2">
              <Button size="sm" variant="ghost" icon={Check} onClick={() => markRead(null)} disabled={!unread}>
                {t('notify.page.markAll')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => {
                  if (window.confirm(t('notify.page.confirmClear'))) clearInbox();
                }}
              >
                {t('notify.page.clear')}
              </Button>
            </div>
          )}
        </div>
        {inbox.length ? (
          <ul className="inbox">
            {inbox.map((n) => (
              <li key={n.id} className="inbox-item" data-read={n.read ? 'true' : 'false'}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-2 meta">
                    {!n.read && <span className="dot" aria-label={t('notify.page.unread')} />}
                    <span>{CATEGORY[n.category] ? t(`notify.category.${n.category}.label`) : 'BIZSIM'}</span>
                    <span>· {relTime(n.at)}</span>
                  </div>
                  {n.link ? (
                    <Link to={n.link} className="collection-title" dir="auto" onClick={() => markRead(n.id)}>
                      {n.title}
                    </Link>
                  ) : (
                    <span className="collection-title" dir="auto">
                      {n.title}
                    </span>
                  )}
                  <p className="muted" dir="auto" style={{ margin: 0 }}>
                    {n.body}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('notify.page.remove', { title: n.title })} onClick={() => removeFromInbox(n.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={Bell} title={t('notify.page.emptyTitle')}>
            {s.enabled ? t('notify.page.emptyOn') : t('notify.page.emptyOff')}
          </Empty>
        )}
      </section>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-set">
        <h2 id="nc-set" className="section-title">
          {t('notify.page.settings')}
        </h2>
        {!s.enabled ? (
          <>
            {perm === 'denied' && <Callout tone="warning">{isNativeApp() ? t('notify.page.blockedNative') : t('notify.page.blockedWeb')}</Callout>}
            {perm === 'unsupported' && <Callout tone="warning">{t('notify.page.noSystem')}</Callout>}
            <div>
              <Button variant="primary" icon={Bell} loading={busy} onClick={perm === 'unsupported' ? () => set({ enabled: true }) : turnOn}>
                {t('notify.page.turnOn')}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button icon={BellOff} onClick={() => disableAllNotifications().then(() => toast(t('notify.page.allOff')))}>
              {t('notify.page.turnOff')}
            </Button>
          </div>
        )}
        <p className="meta">
          {isNativeApp() ? t('notify.page.nativeNote') : t('notify.page.webNote')} {t('notify.page.languageNote')}
        </p>

        <fieldset className="stack gap-2" disabled={!s.enabled} style={{ border: 0, padding: 0, margin: 0, opacity: s.enabled ? 1 : 0.55 }}>
          <legend className="meta-caps" style={{ marginBottom: 'var(--s2)' }}>
            {t('notify.page.what')}
          </legend>
          {CATEGORY_IDS.map((k) => (
            <label key={k} className="row gap-3 collection-check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={s.categories[k] !== false} onChange={(e) => set({ categories: { [k]: e.target.checked } })} style={{ marginBlockStart: 4 }} />
              <span className="grow">
                <strong>{t(`notify.category.${k}.label`)}</strong>
                <span className="meta" style={{ display: 'block' }}>
                  {t(`notify.category.${k}.help`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="notify-grid" disabled={!s.enabled} style={{ opacity: s.enabled ? 1 : 0.55 }}>
          <legend className="sr-only">{t('notify.page.timing')}</legend>
          <div className="field">
            <label htmlFor="n-time">{t('notify.page.dailyTime')}</label>
            <input id="n-time" type="time" className="input" value={s.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-freq">{t('notify.page.cotd')}</label>
            <select id="n-freq" className="input" value={s.frequency} onChange={(e) => set({ frequency: e.target.value })}>
              <option value="daily">{t('notify.page.daily')}</option>
              <option value="weekdays">{t('notify.page.weekdays')}</option>
              <option value="weekly">{t('notify.page.weekly')}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="n-qs">{t('notify.page.quietFrom')}</label>
            <input id="n-qs" type="time" className="input" value={s.quietStart} onChange={(e) => e.target.value && set({ quietStart: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-qe">{t('notify.page.quietUntil')}</label>
            <input id="n-qe" type="time" className="input" value={s.quietEnd} onChange={(e) => e.target.value && set({ quietEnd: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-goal">{t('notify.page.goal')}</label>
            <input id="n-goal" type="number" min={0} max={50} className="input" value={s.weeklyGoal} onChange={(e) => set({ weeklyGoal: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          </div>
        </fieldset>
        <p className="meta">{t('notify.page.noStreaks')}</p>
      </section>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-custom">
        <h2 id="nc-custom" className="section-title">
          {t('notify.page.yours')}
        </h2>
        {s.custom.length > 0 && (
          <ul className="inbox">
            {s.custom.map((r) => (
              <li key={r.id} className="inbox-item">
                <div className="grow">
                  <span className="collection-title" dir="auto">
                    {r.text}
                  </span>
                  <span className="meta">
                    {hhmm(r.time)} · {r.days?.length ? formatList(r.days.map((d) => weekdayNames('short')[d])) : t('notify.page.everyDay')}
                  </span>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={t('notify.page.deleteReminder', { text: r.text })} onClick={() => set({ custom: s.custom.filter((x) => x.id !== r.id) })} />
              </li>
            ))}
          </ul>
        )}
        <form
          className="row wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            set({ custom: [...s.custom, { id: `r-${uid().slice(0, 6)}`, text: text.trim().slice(0, 140), time, days: [] }].slice(0, 20) });
            setText('');
            toast(t('notify.page.added'));
          }}
        >
          <label htmlFor="r-text" className="sr-only">
            {t('notify.page.reminderText')}
          </label>
          <input id="r-text" className="input grow" dir="auto" placeholder={t('notify.page.reminderPlaceholder')} value={text} maxLength={140} onChange={(e) => setText(e.target.value)} disabled={!s.enabled} />
          <label htmlFor="r-time" className="sr-only">
            {t('notify.page.time')}
          </label>
          <input id="r-time" type="time" className="input" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} disabled={!s.enabled} />
          <Button type="submit" icon={Plus} disabled={!s.enabled || !text.trim()}>
            {t('notify.page.add')}
          </Button>
        </form>
      </section>
    </div>
  );
}
