// Voice reader built on Piper, a free, open-source (MIT) neural text-to-speech
// engine that runs entirely on the device via WebAssembly. Only male voices
// whose training data is public domain or CC0 are offered, so they are free for
// any use. The engine files ship with the app; a voice model (~60 MB) downloads
// once from Hugging Face and is then cached on the device. If Piper cannot run
// (very old browser), a system male voice is used instead.
import { useSyncExternalStore } from 'react';
import ortWasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import { t } from '../i18n/index.js';

export const VOICES = [
  { id: 'en_US-john-medium', name: 'John', note: 'US English · public-domain recordings (LibriVox)' },
  { id: 'en_US-norman-medium', name: 'Norman', note: 'US English · public-domain recordings (LibriVox)' },
  { id: 'en_US-bryce-medium', name: 'Bryce', note: 'US English · public domain' },
  { id: 'en_US-joe-medium', name: 'Joe', note: 'US English · CC0' },
];
const VOICE_KEY = 'bizsim.voice';
export function currentVoice() {
  let id = null;
  try {
    id = localStorage.getItem(VOICE_KEY);
  } catch {
    /* ignore */
  }
  return VOICES.find((v) => v.id === id) || VOICES[0];
}
export function setVoice(id) {
  try {
    localStorage.setItem(VOICE_KEY, id);
  } catch {
    /* ignore */
  }
  stop();
}
export const VOICE_NAME = 'Piper (open source, on-device)';

const listeners = new Set();
let state = { status: 'idle', owner: null, progress: null, part: 0, parts: 0, engine: null, error: null };
const set = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export function useVoice() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

let session = null;
let sessionVoice = null;
let audio = null;
let runId = 0;
let paused = false;

async function piperSession() {
  const voice = currentVoice().id;
  if (session && sessionVoice === voice) return session;
  const tts = await import('@mintplex-labs/piper-tts-web');
  tts.TtsSession._instance = null; // load the newly chosen voice
  sessionVoice = voice;
  const base = `${location.origin}${import.meta.env.BASE_URL || '/'}`.replace(/\/$/, '');
  session = await tts.TtsSession.create({
    voiceId: voice,
    progress: (p) => {
      if (p.total) set({ progress: Math.round((p.loaded / p.total) * 100) });
    },
    wasmPaths: {
      onnxWasm: { wasm: new URL(ortWasmUrl, location.href).href }, // bundled with the app
      piperData: `${base}/piper/piper_phonemize.data`,
      piperWasm: `${base}/piper/piper_phonemize.wasm`,
    },
  });
  return session;
}

/** Split into speakable chunks of whole sentences (~360 characters). */
export function chunkText(text) {
  const clean = text.replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [clean];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length > 360 && cur) {
      out.push(cur.trim());
      cur = '';
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function playBlob(blob, id) {
  return new Promise((resolve, reject) => {
    if (id !== runId) return resolve();
    const url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('voice.playbackFailed')));
    };
    audio.play().catch(reject);
  });
}

function systemVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  const en = voices.filter((v) => /^en/i.test(v.lang));
  return en.find((v) => /\b(male|david|daniel|alex|fred|guy|george|ryan|mark|james|aaron|arthur)\b/i.test(v.name) && !/female/i.test(v.name)) || en[0] || null;
}

function speakSystem(chunks, id) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) return reject(new Error(t('voice.noEngine')));
    set({ engine: 'system', status: 'playing' });
    let i = 0;
    const next = () => {
      if (id !== runId) return resolve();
      if (i >= chunks.length) return resolve();
      const u = new SpeechSynthesisUtterance(chunks[i]);
      const v = systemVoice();
      if (v) u.voice = v;
      u.pitch = 0.85;
      u.onend = () => {
        i++;
        set({ part: i });
        next();
      };
      u.onerror = (e) => reject(new Error(e.error || 'Speech failed'));
      window.speechSynthesis.speak(u);
    };
    next();
  });
}

/** Read text aloud. `owner` identifies the button that started it. */
export async function speak(text, owner) {
  stop();
  const id = ++runId;
  paused = false;
  const chunks = chunkText(text);
  set({ status: 'loading', owner, progress: null, part: 0, parts: chunks.length, error: null });
  try {
    let s;
    try {
      s = await piperSession();
    } catch (e) {
      console.warn('Piper unavailable, using system voice:', e);
      await speakSystem(chunks, id);
      if (id === runId) set({ status: 'idle', owner: null });
      return;
    }
    set({ engine: 'piper' });
    let pending = s.predict(chunks[0]);
    for (let i = 0; i < chunks.length; i++) {
      const blob = await pending;
      if (id !== runId) return;
      pending = i + 1 < chunks.length ? s.predict(chunks[i + 1]) : null; // synthesise ahead while playing
      set({ status: paused ? 'paused' : 'playing', part: i + 1 });
      await playBlob(blob, id);
      if (id !== runId) return;
    }
    set({ status: 'idle', owner: null, part: 0 });
  } catch (e) {
    if (id === runId) set({ status: 'error', error: e.message || t('voice.failed') });
  }
}

export function pause() {
  if (state.engine === 'system') window.speechSynthesis?.pause();
  else audio?.pause();
  paused = true;
  set({ status: 'paused' });
}

export function resume() {
  if (state.engine === 'system') window.speechSynthesis?.resume();
  else audio?.play();
  paused = false;
  set({ status: 'playing' });
}

export function stop() {
  runId++;
  paused = false;
  if (audio) {
    audio.pause();
    audio = null;
  }
  window.speechSynthesis?.cancel();
  set({ status: 'idle', owner: null, part: 0, parts: 0, error: null });
}
