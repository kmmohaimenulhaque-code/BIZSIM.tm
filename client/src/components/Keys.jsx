// Settings > "AI keys": paste any API key; BIZSIM recognises the provider,
// verifies the key, finds the models that really answer, and adds the key to an
// ordered fallback chain. Case writing tries the keys top to bottom and, inside
// each key, its models left to right.
//  - On the computer running BIZSIM (desktop app): keys are saved there and
//    also used by phones paired over Wi-Fi.
//  - On a phone or a hosted server: keys stay on this device and are sent only
//    with this device's own requests.
import { useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, Check, Trash2, ExternalLink, ChevronDown, ChevronUp, ShieldCheck, Sparkles, Power, ArrowDownUp, Info } from 'lucide-react';
import { Button, Callout, Badge, toast } from './ui.jsx';
import { getKeys, testKey, changeServerChain, deviceKeys, setDeviceKeys, saveServerKeys } from '../lib/api.js';
import { applyChainOp } from '@shared/keychain.js';
import { refreshStatus, useStatus } from '../lib/useStatus.js';
import { safeUrl } from '../lib/safe.js';

const NAMES = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI',
  nvidia: 'NVIDIA NIM',
  groq: 'Groq',
  xai: 'xAI Grok',
  openrouter: 'OpenRouter',
  custom: 'Custom endpoint',
};
const SIGNUP = [
  ['gemini', 'https://aistudio.google.com/apikey', true],
  ['nvidia', 'https://build.nvidia.com/settings/api-keys', true],
  ['groq', 'https://console.groq.com/keys', true],
  ['anthropic', 'https://console.anthropic.com/settings/keys'],
  ['openai', 'https://platform.openai.com/api-keys'],
  ['openrouter', 'https://openrouter.ai/keys'],
];
const mask = (v) => (v && v.length > 10 ? `${v.slice(0, 6)}...${v.slice(-4)}` : '****');
const LEGACY = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_IMAGE_MODEL', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'OPENAI_IMAGE_MODEL', 'LLM_PROVIDER', 'IMAGE_PROVIDER', '_geminiModel', '_openaiProvider'];

// ---------- keys kept on this device ----------
function deviceList() {
  const k = deviceKeys();
  let list = [];
  try {
    list = JSON.parse(k.AI_KEYS || '[]');
  } catch {
    list = [];
  }
  // Move keys saved by older versions (one per provider) into the chain once.
  if (k.GEMINI_API_KEY || k.ANTHROPIC_API_KEY || k.OPENAI_API_KEY) {
    const add = (entry) => (list = applyChainOp(list, { type: 'add', entry }));
    if (k.ANTHROPIC_API_KEY) add({ id: 'anthropic-legacy', provider: 'anthropic', key: k.ANTHROPIC_API_KEY, models: [k.ANTHROPIC_MODEL].filter(Boolean), enabled: true });
    if (k.OPENAI_API_KEY) add({ id: 'openai-legacy', provider: k._openaiProvider || 'openai', key: k.OPENAI_API_KEY, baseUrl: k.OPENAI_BASE_URL || 'https://api.openai.com/v1', models: [k.OPENAI_MODEL].filter(Boolean), enabled: true });
    if (k.GEMINI_API_KEY) add({ id: 'gemini-legacy', provider: 'gemini', key: k.GEMINI_API_KEY, models: [], enabled: true });
    const next = Object.fromEntries(Object.entries(k).filter(([n]) => !LEGACY.includes(n)));
    next.AI_KEYS = JSON.stringify(list);
    setDeviceKeys(next);
  }
  return list;
}
function saveDeviceList(list) {
  const cur = deviceKeys();
  if (list.length) cur.AI_KEYS = JSON.stringify(list);
  else delete cur.AI_KEYS;
  setDeviceKeys(cur);
}
const viewOf = (list) => list.map((e) => ({ ...e, masked: mask(e.key), key: undefined, origin: 'device' }));

export function KeysPanel() {
  const [info, setInfo] = useState(null); // { manage, chain, sec, offline? }
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState(null);
  const [secName, setSecName] = useState('');
  const [secEmail, setSecEmail] = useState('');
  const status = useStatus();

  const load = async () => {
    let view;
    try {
      const r = await getKeys();
      view = r.manage ? r : { ...r, chain: viewOf(deviceList()), sec: deviceKeys().SEC_USER_AGENT || '' };
    } catch (e) {
      view = { manage: false, offline: true, chain: viewOf(deviceList()), sec: deviceKeys().SEC_USER_AGENT || '', reason: e.message };
    }
    setInfo(view);
    const email = (view.sec || '').split(/\s+/).find((x) => x.includes('@')) || '';
    setSecName((view.sec || '').replace(email, '').trim());
    setSecEmail(email);
  };
  useEffect(() => {
    load();
  }, []);

  const change = async (op) => {
    try {
      if (info.manage) await changeServerChain(op);
      else saveDeviceList(applyChainOp(deviceList(), op));
      await refreshStatus().catch(() => {});
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const connect = async (e) => {
    e.preventDefault();
    setBusy(true);
    setLast(null);
    try {
      const r = await testKey(key.trim(), advanced ? baseUrl.trim() : '');
      await change({ type: 'add', entry: r.entry });
      setLast(r);
      setKey('');
      toast(`${r.name} added: ${r.models.length > 1 ? `${r.models.length} models with automatic fallback` : r.textModel}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveSec = async (e) => {
    e.preventDefault();
    const v = secName.trim() && secEmail.trim() ? `${secName.trim()} ${secEmail.trim()}` : null;
    if (info.manage) await saveServerKeys({ SEC_USER_AGENT: v });
    else {
      const cur = deviceKeys();
      if (v) cur.SEC_USER_AGENT = v;
      else delete cur.SEC_USER_AGENT;
      setDeviceKeys(cur);
    }
    await load();
    toast(v ? 'SEC EDGAR enabled' : 'SEC EDGAR contact removed');
  };

  if (!info) return null;
  const chain = info.chain || [];
  const editable = chain.filter((e) => e.origin !== 'environment');
  const firstOn = chain.find((e) => e.enabled !== false);

  return (
    <section className="panel panel-pad stack gap-4" aria-labelledby="keys-h">
      <h2 id="keys-h" className="section-title row gap-2">
        <KeyRound size={16} aria-hidden="true" /> AI keys
      </h2>
      <p className="muted">
        Optional. All 200 seasons play without a key. A key adds AI live seasons, the chat season builder and AI illustrations. Paste any key: BIZSIM recognises the provider, checks which models really answer and adds them to your fallback chain.
      </p>
      <Callout icon={ShieldCheck}>
        {info.manage
          ? 'Keys are saved on this computer only (in the BIZSIM data folder) and are also used by phones you pair over Wi-Fi. They are never shown in full again.'
          : 'Keys are saved on this device only and sent with your own requests to the BIZSIM server you are connected to. They are never stored on the server.'}
      </Callout>
      {info.offline && (
        <Callout tone="warning" icon={Info}>
          AI features run on a BIZSIM server. Pair this phone with the desktop app (Settings, Connect to a computer) or set a server address, then add keys here. Seasons, progress and the principles library all work offline.
        </Callout>
      )}
      {!info.manage && !info.offline && chain.length === 0 && status?.ai?.enabled && (
        <Callout icon={Check}>
          The BIZSIM server you are connected to already has AI set up ({status.ai.provider}, {status.ai.model}). Add your own key only if you want this device to use it first.
        </Callout>
      )}

      {chain.length > 0 && (
        <div className="stack gap-2">
          <div className="row between wrap gap-2">
            <span className="meta row gap-2">
              <ArrowDownUp size={14} aria-hidden="true" /> Fallback order: top to bottom, then each key's models left to right.
            </span>
            {editable.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => change({ type: 'sort' })}>
                Auto-order
              </Button>
            )}
          </div>
          <ol className="key-chain">
            {chain.map((k, i) => {
              const ro = k.origin === 'environment';
              const idx = editable.findIndex((e) => e.id === k.id);
              return (
                <li key={k.id} className={`key-row${k.enabled === false ? ' off' : ''}`}>
                  <span className="key-rank num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="stack gap-1 grow" style={{ minWidth: 0 }}>
                    <span className="row gap-2 wrap">
                      <strong>{NAMES[k.provider] || k.provider}</strong>
                      {k === firstOn && <Badge tone="success">Primary</Badge>}
                      {k.enabled === false && <Badge>Paused</Badge>}
                      {ro && <Badge title="Set in bizsim.env or .env">From settings file</Badge>}
                    </span>
                    <span className="meta num">{k.masked}</span>
                    <span className="key-models">
                      {(k.models?.length ? k.models : ['auto (newest Flash)']).map((m, j) => (
                        <span key={m} className="key-model" title={j === 0 ? 'Tried first' : `Fallback ${j}`}>
                          {m}
                        </span>
                      ))}
                    </span>
                  </span>
                  {!ro && (
                    <span className="row gap-1 key-actions">
                      <Button size="sm" variant="ghost" icon={ChevronUp} aria-label="Move up" disabled={idx <= 0} onClick={() => change({ type: 'move', id: k.id, dir: -1 })} />
                      <Button size="sm" variant="ghost" icon={ChevronDown} aria-label="Move down" disabled={idx < 0 || idx >= editable.length - 1} onClick={() => change({ type: 'move', id: k.id, dir: 1 })} />
                      <Button size="sm" variant="ghost" icon={Power} aria-label={k.enabled === false ? 'Resume key' : 'Pause key'} onClick={() => change({ type: 'toggle', id: k.id })} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${NAMES[k.provider] || k.provider} key`} onClick={() => change({ type: 'remove', id: k.id }).then(() => toast('Key removed'))} />
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <form className="stack gap-3" onSubmit={connect}>
        <label htmlFor="api-key" className="field">
          <span style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>{chain.length ? 'Add another key (it becomes a fallback)' : 'Paste an API key'}</span>
        </label>
        <div className="row gap-2 wrap">
          <div className="grow" style={{ position: 'relative', minWidth: 220 }}>
            <input
              id="api-key"
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder="AIza...  nvapi-...  sk-ant-...  gsk_...  sk-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              style={{ paddingRight: 44 }}
            />
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setShow(!show)} aria-label={show ? 'Hide key' : 'Show key'} style={{ position: 'absolute', right: 2, top: 2, minHeight: 40 }}>
              {show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          <Button type="submit" variant="primary" icon={Check} loading={busy} disabled={key.trim().length < 8 || busy || info.offline}>
            {busy ? 'Checking models' : 'Add key'}
          </Button>
        </div>
        <button type="button" className="link meta" style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', justifySelf: 'start' }} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>
          <ChevronDown size={14} aria-hidden="true" style={{ transform: advanced ? 'rotate(180deg)' : 'none' }} /> Other provider or local model (OpenAI-compatible)
        </button>
        {advanced && (
          <div className="field">
            <label htmlFor="base-url">Endpoint URL</label>
            <input id="base-url" className="input" inputMode="url" placeholder="e.g. http://localhost:11434/v1 (Ollama) or https://api.together.xyz/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <span className="hint">For local models such as Ollama, any text works as the key.</span>
          </div>
        )}
        {last && (
          <Callout icon={Sparkles}>
            <strong>{last.name}</strong> is ready. Models in fallback order: <span className="num">{(last.models?.length ? last.models : [last.textModel]).join(', ')}</span>
            {last.imageModel ? (
              <>
                {' '}
                . Images: <span className="num">{last.imageModel}</span>
              </>
            ) : null}
            {last.provider === 'gemini' && '. BIZSIM moves to newer Gemini models automatically.'}
            {last.provider === 'nvidia' && '. These are NVIDIA free-endpoint models, fastest first.'}
          </Callout>
        )}
        <div className="meta row wrap gap-3">
          <span>Get a key:</span>
          {SIGNUP.map(([p, url, free]) => (
            <a key={p} className="link" href={safeUrl(url)} target="_blank" rel="noreferrer">
              {NAMES[p]}
              {free ? ' (free tier)' : ''} <ExternalLink aria-hidden="true" />
            </a>
          ))}
        </div>
      </form>

      <form className="stack gap-3" onSubmit={saveSec} style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--s4)' }}>
        <div>
          <div style={{ fontWeight: 500, fontSize: 'var(--t-13)' }}>SEC EDGAR (US company financials)</div>
          <p className="meta">No key needed. The SEC only asks for a name and contact email with each request.</p>
        </div>
        <div className="row gap-2 wrap">
          <input className="input grow" style={{ minWidth: 160 }} aria-label="Your name" placeholder="Your name" value={secName} onChange={(e) => setSecName(e.target.value)} />
          <input className="input grow" style={{ minWidth: 200 }} aria-label="Your email" type="email" placeholder="you@example.com" value={secEmail} onChange={(e) => setSecEmail(e.target.value)} />
          <Button type="submit">Save</Button>
        </div>
      </form>
    </section>
  );
}
