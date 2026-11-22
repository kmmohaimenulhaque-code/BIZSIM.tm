// Chat builder: describe the season you want in plain language and BIZSIM
// builds it (grounded in Wikipedia, checked by the same quality gates as every
// other season), saves it to My cases and links any of your own principles.
import { episodesOf } from '@shared/episodes.js';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Sparkles, Play, Square, RotateCcw, MessageSquare, AlertTriangle, BookOpen } from 'lucide-react';
import { useJob, startJob, stopJob, clearJob } from '../lib/jobs.js';
import { useChatItems, setChatItems } from '../lib/chatStore.js';
import { useStatus } from '../lib/useStatus.js';
import { useLibrary } from '../lib/library.js';
import { Badge, Button, Callout } from './ui.jsx';
import { useTranslation, Trans, getLocale } from '../i18n/index.js';
import { LOCALE_BY_CODE } from '@shared/locales.js';
import { contentLangOf } from '../lib/caseLocale.js';
import { languageName } from '../i18n/format.js';

export default function ChatBuilder() {
  const { t } = useTranslation();
  const EXAMPLES = t('chat.examples', { returnObjects: true });
  const status = useStatus();
  const lib = useLibrary();
  const items = useChatItems();
  const job = useJob('chat');
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const busy = Boolean(job && !job.done);
  const lastStatus = [...(job?.events || [])].reverse().find((e) => e.event === 'status');
  const progress = job?.starting ? t('chat.sending') : lastStatus?.data?.text || t('chat.understanding');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [items.length, progress]);
  useEffect(() => {
    if (job?.done && job.error && !job.reported) {
      job.reported = true;
      setChatItems((list) => [...list, { role: 'assistant', error: job.error }]);
    }
  }, [job?.done, job?.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = (msg) => {
    const content = msg.trim();
    if (!content || busy) return;
    const next = [...items, { role: 'user', text: content }];
    setChatItems(next);
    setText('');
    // The model sees the conversation, with built seasons summarised.
    const messages = next.map((m) => ({
      role: m.role,
      // Sent to the model, so kept in English whatever the interface language.
      content: m.season ? `Built season: ${m.season.title} (${m.season.company}, ${m.season.yearLabel}). Episodes: ${(m.season.checkpoints ? episodesOf(m.season) : m.season.episodes || []).map((e) => e.title).join('; ')}` : m.text || m.error || '',
    }));
    const userPrinciples = lib.customPrinciples.map((p) => ({ id: p.id, name: p.name, idea: p.idea }));
    startJob('chat', '/api/jobs/chat', { messages, userPrinciples, locale: getLocale() });
  };

  const stop = () => {
    stopJob('chat');
    setChatItems((list) => [...list, { role: 'assistant', error: t('chat.stopped') }]);
  };

  const noAi = status && !status.ai?.enabled;

  return (
    <div className="stack gap-4">
      <Callout icon={MessageSquare}>
        {t('chat.intro')}
        {LOCALE_BY_CODE[getLocale()]?.language !== 'en' ? ` ${t('chat.introLang', { language: languageName(getLocale()) })}` : ''}
      </Callout>
      {noAi && (
        <Callout tone="warning" icon={AlertTriangle}>
          <Trans i18nKey={status?.desktop === false ? 'chat.needsKeyPhone' : 'chat.needsKey'} components={{ link: <Link to="/settings" className="link" /> }} />
        </Callout>
      )}

      <div className="chat-log" aria-live="polite">
        {items.length === 0 && (
          <div className="stack gap-2">
            <span className="meta">{t('chat.try')}</span>
            <div className="chat-examples">
              {(Array.isArray(EXAMPLES) ? EXAMPLES : []).map((e) => (
                <button key={e} type="button" className="chip" disabled={busy || noAi} onClick={() => send(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.text && <p dir="auto">{m.text}</p>}
            {m.plan && m.plan.length > 0 && (
              <ol className="chat-plan">
                {m.plan.map((p) => (
                  <li key={p.subject}>
                    <strong>{p.subject}</strong>
                    {p.period ? <span className="meta"> · {p.period}</span> : null}
                    {p.angle && <div className="meta">{p.angle}</div>}
                  </li>
                ))}
              </ol>
            )}
            {m.season && (
              <div className="chat-season stack gap-2" lang={contentLangOf(m.season)}>
                <div className="row gap-2 wrap">
                  <Badge tone="ai" icon={Sparkles}>
                    {t('chat.newSeason')}
                  </Badge>
                  <span className="meta num">{m.season.yearLabel}</span>
                </div>
                <strong className="h3">{m.season.title}</strong>
                <span className="meta">{m.season.company}</span>
                <ol className="chat-eps">
                  {(m.season.checkpoints ? episodesOf(m.season) : m.season.episodes || []).map((k, j) => (
                    <li key={j}>
                      <span className="num meta">{k.dateLabel}</span> {k.title}
                      {k.decisions?.length ? <span className="meta"> · {t('chat.epDecisions', { count: k.decisions.length })}</span> : null}
                    </li>
                  ))}
                </ol>
                {m.linked?.length > 0 && (
                  <span className="meta row gap-1">
                    <BookOpen size={12} aria-hidden="true" /> {t('chat.linked', { names: m.linked.map((id) => lib.principleById[id]?.name).filter(Boolean).join(', ') })}
                  </span>
                )}
                <div className="row gap-2 wrap">
                  <Link to={`/cases/${m.season.id}`} className="btn btn-primary btn-sm">
                    <Play aria-hidden="true" /> {t('chat.play')}
                  </Link>
                  <span className="meta">{m.season.model ? t('chat.writtenBy', { model: m.season.model }) : t('chat.savedTo')}</span>
                </div>
              </div>
            )}
            {m.error && (
              <p className="chat-error row gap-2">
                <AlertTriangle size={14} aria-hidden="true" /> {m.error}
              </p>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-msg assistant">
            <p className="row gap-2">
              <span className="spinner" aria-hidden="true" /> {progress || t('chat.working')}
            </p>
          </div>
        )}
        <div ref={endRef} className="chat-end" />
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="chat-text" className="sr-only">
          {t('chat.inputLabel')}
        </label>
        <textarea
          id="chat-text"
          className="input"
          rows={2}
          maxLength={2000}
          placeholder={items.length ? t('chat.placeholderMore') : t('chat.placeholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(text);
            }
          }}
          disabled={noAi}
        />
        <div className="row gap-2">
          {busy ? (
            <Button type="button" icon={Square} onClick={stop}>
              {t('chat.stop')}
            </Button>
          ) : (
            <Button type="submit" variant="primary" icon={Send} disabled={!text.trim() || noAi}>
              {t('chat.send')}
            </Button>
          )}
          {items.length > 0 && !busy && (
            <Button type="button" variant="ghost" icon={RotateCcw} onClick={() => { setChatItems([]); clearJob('chat'); }}>
              {t('chat.newChat')}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
