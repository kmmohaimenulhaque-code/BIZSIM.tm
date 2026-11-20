import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Volume2, Pause, Play, Square, Loader2 } from 'lucide-react';
import { speak, pause, resume, stop, useVoice, currentVoice } from '../lib/voice.js';

/** Play / pause / stop button that reads `getText()` aloud with the male Piper voice. */
export function ListenButton({ id, getText, label = 'Listen' }) {
  const v = useVoice();
  const mine = v.owner === id;
  const status = mine ? v.status : 'idle';

  if (status === 'idle' || status === 'error') {
    return (
      <span className="listen">
        <button type="button" className="btn btn-sm" onClick={() => speak(getText(), id)} title={`Read aloud, ${currentVoice().name} (Piper, open source)`}>
          <Volume2 aria-hidden="true" /> {label}
        </button>
        {mine && v.error && <span className="meta neg">{v.error}</span>}
      </span>
    );
  }
  return (
    <span className="listen row gap-2" role="group" aria-label="Voice reader">
      {status === 'loading' ? (
        <button type="button" className="btn btn-sm" disabled>
          <Loader2 className="spin" aria-hidden="true" />
          {v.progress != null && v.progress < 100 ? `Downloading voice ${v.progress}%` : 'Preparing voice…'}
        </button>
      ) : status === 'paused' ? (
        <button type="button" className="btn btn-sm btn-primary" onClick={resume} aria-label="Resume reading">
          <Play aria-hidden="true" /> Resume
        </button>
      ) : (
        <button type="button" className="btn btn-sm btn-primary" onClick={pause} aria-label="Pause reading">
          <Pause aria-hidden="true" /> Pause
        </button>
      )}
      <button type="button" className="btn btn-sm btn-ghost btn-icon" onClick={stop} aria-label="Stop reading" title="Stop">
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
