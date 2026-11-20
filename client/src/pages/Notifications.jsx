// Notification centre: the inbox, and every notification setting in one place.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Check, Trash2, Plus } from 'lucide-react';
import { Button, Callout, Empty, toast } from '../components/ui.jsx';
import { CATEGORY } from '@shared/notifyPlan.js';
import { useStore, uid } from '../lib/store.js';
import { notifySettings, permissionState, enableNotifications, disableAllNotifications, updateNotifySettings, markRead, clearInbox, removeFromInbox, useInbox } from '../lib/notify.js';
import { isNativeApp } from '../lib/api.js';
import { relTime } from '../lib/format.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NotificationsPage() {
  useStore((s) => s.notify);
  const s = notifySettings();
  const inbox = useInbox();
  const [perm, setPerm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [time, setTime] = useState('18:00');

  useEffect(() => {
    document.title = 'Notifications · BIZSIM';
    permissionState().then(setPerm);
  }, []);
  const unread = inbox.filter((n) => !n.read).length;

  const turnOn = async () => {
    setBusy(true);
    try {
      const p = await enableNotifications();
      setPerm(p);
      if (p === 'granted') toast('Notifications on');
      else if (p === 'unsupported') toast('This browser cannot show notifications. The notification centre below still works.', 'error');
      else toast('Notifications were not allowed. You can allow them in your device settings.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const set = (patch) => updateNotifySettings(patch);

  return (
    <div className="stack gap-6" style={{ maxWidth: 860 }}>
      <header className="stack gap-3">
        <div className="eyebrow eyebrow-rule">System</div>
        <h1 className="display" style={{ fontSize: 'var(--t-36)' }}>
          Notifications
        </h1>
        <p className="lead">A daily case to try, reminders to finish what you started, and a note when background work is done. Off until you turn it on. Everything is scheduled on this device; nothing is sent to a server.</p>
      </header>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-inbox">
        <div className="row between wrap gap-2">
          <h2 id="nc-inbox" className="section-title">
            Inbox{unread ? ` · ${unread} unread` : ''}
          </h2>
          {inbox.length > 0 && (
            <div className="row gap-2">
              <Button size="sm" variant="ghost" icon={Check} onClick={() => markRead(null)} disabled={!unread}>
                Mark all read
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                onClick={() => {
                  if (window.confirm('Clear every notification from the inbox?')) clearInbox();
                }}
              >
                Clear
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
                    {!n.read && <span className="dot" aria-label="Unread" />}
                    <span>{CATEGORY[n.category]?.label || 'BIZSIM'}</span>
                    <span>· {relTime(n.at)}</span>
                  </div>
                  {n.link ? (
                    <Link to={n.link} className="collection-title" onClick={() => markRead(n.id)}>
                      {n.title}
                    </Link>
                  ) : (
                    <span className="collection-title">{n.title}</span>
                  )}
                  <p className="muted" style={{ margin: 0 }}>
                    {n.body}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove “${n.title}”`} onClick={() => removeFromInbox(n.id)} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon={Bell} title="No notifications">
            {s.enabled ? 'New notifications will appear here.' : 'Turn notifications on below to get a daily case and reminders.'}
          </Empty>
        )}
      </section>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-set">
        <h2 id="nc-set" className="section-title">
          Settings
        </h2>
        {!s.enabled ? (
          <>
            {perm === 'denied' && <Callout tone="warning">Notifications are blocked for BIZSIM. Allow them in your {isNativeApp() ? 'phone settings (Apps, BIZSIM, Notifications)' : 'browser or system settings'}, then try again.</Callout>}
            {perm === 'unsupported' && <Callout tone="warning">This browser cannot show system notifications. You can still turn them on to use the in-app notification centre.</Callout>}
            <div>
              <Button variant="primary" icon={Bell} loading={busy} onClick={perm === 'unsupported' ? () => set({ enabled: true }) : turnOn}>
                Turn on notifications
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button icon={BellOff} onClick={() => disableAllNotifications().then(() => toast('All notifications off'))}>
              Turn off all notifications
            </Button>
          </div>
        )}
        <p className="meta">
          {isNativeApp()
            ? 'On this phone, notifications are scheduled by the system and arrive even when BIZSIM is closed.'
            : 'On computers and in browsers, notifications appear while BIZSIM is open. Anything missed while it was closed shows up in the inbox next time.'}
        </p>

        <fieldset className="stack gap-2" disabled={!s.enabled} style={{ border: 0, padding: 0, margin: 0, opacity: s.enabled ? 1 : 0.55 }}>
          <legend className="meta-caps" style={{ marginBottom: 'var(--s2)' }}>
            What to notify
          </legend>
          {Object.entries(CATEGORY).map(([k, d]) => (
            <label key={k} className="row gap-3 collection-check" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={s.categories[k] !== false} onChange={(e) => set({ categories: { [k]: e.target.checked } })} style={{ marginTop: 4 }} />
              <span className="grow">
                <strong>{d.label}</strong>
                <span className="meta" style={{ display: 'block' }}>
                  {d.help}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="notify-grid" disabled={!s.enabled} style={{ opacity: s.enabled ? 1 : 0.55 }}>
          <legend className="sr-only">Timing</legend>
          <div className="field">
            <label htmlFor="n-time">Daily time</label>
            <input id="n-time" type="time" className="input" value={s.time} onChange={(e) => e.target.value && set({ time: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-freq">Case of the Day</label>
            <select id="n-freq" className="input" value={s.frequency} onChange={(e) => set({ frequency: e.target.value })}>
              <option value="daily">Every day</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Mondays only</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="n-qs">Quiet from</label>
            <input id="n-qs" type="time" className="input" value={s.quietStart} onChange={(e) => e.target.value && set({ quietStart: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-qe">Quiet until</label>
            <input id="n-qe" type="time" className="input" value={s.quietEnd} onChange={(e) => e.target.value && set({ quietEnd: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="n-goal">Weekly goal (seasons)</label>
            <input id="n-goal" type="number" min={0} max={50} className="input" value={s.weeklyGoal} onChange={(e) => set({ weeklyGoal: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
          </div>
        </fieldset>
        <p className="meta">There are no streaks to lose. Skip a day whenever you like.</p>
      </section>

      <section className="panel panel-pad stack gap-4" aria-labelledby="nc-custom">
        <h2 id="nc-custom" className="section-title">
          Your reminders
        </h2>
        {s.custom.length > 0 && (
          <ul className="inbox">
            {s.custom.map((r) => (
              <li key={r.id} className="inbox-item">
                <div className="grow">
                  <span className="collection-title">{r.text}</span>
                  <span className="meta">
                    {r.time} · {r.days?.length ? r.days.map((d) => DAYS[d]).join(', ') : 'every day'}
                  </span>
                </div>
                <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete reminder “${r.text}”`} onClick={() => set({ custom: s.custom.filter((x) => x.id !== r.id) })} />
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
            toast('Reminder added');
          }}
        >
          <label htmlFor="r-text" className="sr-only">
            Reminder text
          </label>
          <input id="r-text" className="input grow" placeholder="e.g. Play one episode before dinner" value={text} maxLength={140} onChange={(e) => setText(e.target.value)} disabled={!s.enabled} />
          <label htmlFor="r-time" className="sr-only">
            Time
          </label>
          <input id="r-time" type="time" className="input" style={{ width: 130 }} value={time} onChange={(e) => setTime(e.target.value)} disabled={!s.enabled} />
          <Button type="submit" icon={Plus} disabled={!s.enabled || !text.trim()}>
            Add
          </Button>
        </form>
      </section>
    </div>
  );
}
