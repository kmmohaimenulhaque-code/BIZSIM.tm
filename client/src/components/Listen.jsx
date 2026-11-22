import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Volume2, Pause, Play, Square, Loader2 } from 'lucide-react';
import { speak, pause, resume, stop, useVoice, currentVoice } from '../lib/voice.js';
import { useTranslation } from '../i18n/index.js';

/** Play / pause / stop button that reads `getText()` aloud with the male Piper voice. */
export function ListenButton({ id, getText, label, lang = 'en' }) {
  const { t } = useTranslation();
  const v = useVoice();
  // The bundled voices read English only; hide the button for text in other languages.
  if (!String(lang).toLowerCase().startsWith('en')) return null;
  const mine = v.owner === id;
  const status = mine ? v.status : 'idle';

  if (status === 'idle' || status === 'error') {
    return (
      <span className="listen">
        <button type="button" className="btn btn-sm" onClick={() => speak(getText(), id)} title={t('voice.readAloud', { name: currentVoice().name })}>
          <Volume2 aria-hidden="true" /> {label || t('voice.listen')}
        </button>
        {mine && v.error && <span className="meta neg">{v.error}</span>}
      </span>
    );
  }
  return (
    <span className="listen row gap-2" role="group" aria-label={t('voice.reader')}>
      {status === 'loading' ? (
        <button type="button" className="btn btn-sm" disabled>
          <Loader2 className="spin" aria-hidden="true" />
          {v.progress != null && v.progress < 100 ? t('voice.downloading', { progress: v.progress }) : t('voice.preparing')}
        </button>
      ) : status === 'paused' ? (
        <button type="button" className="btn btn-sm btn-primary" onClick={resume} aria-label={t('voice.resumeReading')}>
          <Play aria-hidden="true" /> {t('voice.resume')}
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-primary" onClick={pause} aria-label={t('voice.pauseReading')}>
          <Pause aria-hidden="true" /> {t('voice.pause')}
        </button>
      )}
      <button type="button" className="btn btn-sm btn-ghost btn-icon" onClick={stop} aria-label={t('voice.stopReading')} title={t('voice.stop')}>
        <Square aria-hidden="true" />
      </button>
      {v.parts > 1 && status !== 'loading' && (
        <span className="meta num" aria-live="polite">
          {v.part}/{v.parts}
        </span>
      )}
    </span>
  );
}

/** Stops reading when the user navigates away. */
export function StopVoiceOnNavigate() {
  const loc = useLocation();
  useEffect(() => () => stop(), [loc.pathname]);
  return null;
}
