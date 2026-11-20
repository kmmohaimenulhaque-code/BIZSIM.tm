import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, llmModel, requestKeys, KEY_NAMES } from './config.js';
import { testKey, saveSettings, loadSavedSettings, describeKeys, updateChain, PROVIDERS } from './ai/keys.js';
import { runResearch, STAGES } from './research/pipeline.js';
import { chatTurn } from './ai/chatBuilder.js';
import { startJob, getJob, streamJob } from './jobs.js';
import { searchImages, generateImage, imageGenerationEnabled } from './images/index.js';
import { llmEnabled } from './ai/llm.js';
import { currentGeminiModel } from './ai/geminiModels.js';
import { rateLimiter, redactSecrets } from './lib/http.js';
import { CASES } from '../../shared/cases/index.js';
import { BOOKS, PRINCIPLES } from '../../shared/books.js';
import { CATALOGUE } from '../../shared/catalogue.js';
import { enableShare, disableShare, shareState, initPairingStore, revokeDevice, revokeAll, newPairingCode } from './share.js';
import { open as openSealed } from '../../shared/sealed.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

export function createApp({ clientDist = config.clientDist } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '200kb' }));

  app.use((req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body) => json(body && typeof body.error === 'string' ? { ...body, error: redactSecrets(body.error) } : body);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  // CORS for the API, so mobile (Capacitor) and other front-ends can call it.
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    // The Wi-Fi listener sets its own, narrower CORS policy (see share.js).
    if (req.viaLan) {
      if (req.lanOrigin) res.setHeader('Access-Control-Allow-Origin', req.lanOrigin);
      return next();
    }
    const allowAll = config.corsOrigins.includes('*');
    if (origin && (allowAll || config.corsOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-BizSim-Keys, X-BizSim-Admin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Device keys: a user's own API keys sent with their requests (never stored on the server).
  // Over Wi-Fi they arrive sealed with the pairing session key (shared/sealed.js);
  // plain key headers are refused there by share.js. Keys are never logged.
  app.use('/api', (req, res, next) => {
    let json = null;
    if (req.viaLan) {
      const sealed = req.headers['x-bizsim-sealed-keys'];
      if (sealed && req.pairSession) json = openSealed(req.pairSession.key, String(sealed));
      if (sealed && json == null) return res.status(400).json({ error: 'Could not read the keys sent by this device. Pair again.' });
    } else if (req.headers['x-bizsim-keys']) {
      try {
        json = decodeURIComponent(Buffer.from(String(req.headers['x-bizsim-keys']), 'base64').toString('utf8'));
      } catch {
        json = null;
      }
    }
    if (!json) return next();
    let keys = {};
    try {
      const parsed = JSON.parse(json);
      for (const k of KEY_NAMES) if (typeof parsed?.[k] === 'string' && parsed[k].length < (k === 'AI_KEYS' ? 24000 : 400)) keys[k] = parsed[k];
    } catch {
      keys = {};
    }
    requestKeys.run(keys, next);
  });

  // A web page open in the user's browser can send requests to localhost. Only
  // the BIZSIM page itself (same origin, a localhost Host header, so DNS
  // rebinding fails) may use the management endpoints.
  const sameOriginLocal = (req) => {
    const host = String(req.headers.host || '');
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) return false;
    const origin = req.headers.origin;
    if (origin && origin !== `http://${host}`) return false;
    const site = req.headers['sec-fetch-site'];
    return !site || site === 'same-origin' || site === 'none';
  };

  // Who may change the keys saved on this server: the computer itself, or an admin token.
  const canManage = (req) => {
    if (config.adminToken && req.headers['x-bizsim-admin'] === config.adminToken) return true;
    if (!sameOriginLocal(req)) return false;
    const ip = req.ip || '';
    const loop = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
    return loop && !req.viaLan;
  };

  app.get('/api/keys', (req, res) => {
    res.json({ manage: canManage(req), providers: PROVIDERS, ...(canManage(req) ? describeKeys() : {}) });
  });

  app.post('/api/keys/test', rateLimiter({ windowMs: 60_000, max: 12 }), async (req, res) => {
    try {
      res.json(await testKey({ key: req.body?.key, baseUrl: req.body?.baseUrl }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/keys', async (req, res) => {
    if (!canManage(req)) return res.status(403).json({ error: 'Keys can only be saved on the server from the computer it runs on.' });
    try {
      await saveSettings(req.body?.settings || {});
      res.json({ ok: true, ...describeKeys() });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/keys/chain', async (req, res) => {
    if (!canManage(req)) return res.status(403).json({ error: 'Keys can only be changed on the computer BIZSIM runs on.' });
    try {
      res.json({ ok: true, ...(await updateChain(req.body?.op)) });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/status', (req, res) => {
    res.json({
      name: 'BIZSIM',
      version: pkg.version,
      ai: {
        enabled: llmEnabled(),
        provider: config.llm.provider,
        model: (config.llm.provider === 'gemini' && config.llm.model === 'auto' && currentGeminiModel('text', config.llm.chain[0]?.key)) || llmModel(),
        fallbacks: Math.max(0, config.llm.chain.reduce((n, e) => n + Math.max(1, e.models.length), 0) - 1),
      },
      images: { search: 'Wikipedia', generation: imageGenerationEnabled() ? config.images.provider : null },
      sec: Boolean(config.secUserAgent),
      desktop: process.env.BIZSIM_DESKTOP === '1',
      stages: STAGES,
    });
  });

  // Wi-Fi sharing controls, only from the computer itself (desktop app).
  const loopbackOnly = (req, res, next) => {
    const ip = req.socket.remoteAddress || '';
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) && !req.viaLan;
    if (!local || !sameOriginLocal(req) || process.env.BIZSIM_DESKTOP !== '1') return res.status(403).json({ error: 'Only available in the desktop app on this computer' });
    next();
  };
  app.get('/api/share', loopbackOnly, (req, res) => res.json(shareState()));
  app.post('/api/share', loopbackOnly, async (req, res) => {
    try {
      res.json(req.body?.enabled ? await enableShare(app, config.dataDir) : await disableShare());
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post('/api/share/code', loopbackOnly, (req, res) => {
    newPairingCode();
    res.json(shareState());
  });
  app.post('/api/share/revoke', loopbackOnly, (req, res) => {
    if (req.body?.all) revokeAll();
    else if (typeof req.body?.id === 'string') revokeDevice(req.body.id);
    res.json(shareState());
  });

  app.get('/api/cases', (req, res) => res.json(CASES));
  app.get('/api/library', (req, res) => res.json({ books: BOOKS, principles: PRINCIPLES }));
  app.get('/api/catalogue', (req, res) => res.json(CATALOGUE));

  const researchLimit = rateLimiter({ windowMs: 60_000, max: 8 });

  // Server-Sent Events: stream real stage progress and sources as they arrive.
  app.get('/api/research/stream', researchLimit, async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    req.on('close', () => {
      closed = true;
    });
    const emit = (event, data) => {
      if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15000);
    try {
      await runResearch(req.query.q, emit, { generate: req.query.generate !== '0' });
    } catch (e) {
      emit('failure', { message: redactSecrets(e.message || 'Research failed') });
    } finally {
      clearInterval(ping);
      emit('end', {});
      res.end();
    }
  });

  // Background jobs: research and the chat builder keep running when the app
  // disconnects, and the app can reconnect and replay what it missed.
  app.post('/api/jobs/research', researchLimit, (req, res) => {
    const q = String(req.body?.q || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'Enter a company name.' });
    try {
      const job = startJob('research', { q }, (emit) => runResearch(q, emit, { generate: req.body?.generate !== false }));
      res.json({ id: job.id });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });
  app.post('/api/jobs/chat', rateLimiter({ windowMs: 60_000, max: 10 }), (req, res) => {
    if (!llmEnabled()) return res.status(400).json({ error: 'The chat builder needs an AI key. Add one in Settings > AI keys.' });
    try {
      const job = startJob('chat', {}, (emit) => chatTurn({ messages: req.body?.messages, userPrinciples: req.body?.userPrinciples }, emit));
      res.json({ id: job.id });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });
  app.get('/api/jobs/:id/events', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'This task is no longer on the server (it may have restarted). Please run it again.' });
    streamJob(job, req.query.from, req, res);
  });

  // Chat season builder: natural language in, playable seasons out (streamed).
  const chatLimit = rateLimiter({ windowMs: 60_000, max: 10 });
  app.post('/api/chat', chatLimit, async (req, res) => {
    if (!llmEnabled()) return res.status(400).json({ error: 'The chat builder needs an AI key. Add one in Settings > AI keys.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    let closed = false;
    res.on('close', () => {
      closed = true;
    });
    const emit = (event, data) => {
      if (!closed) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15000);
    try {
      await chatTurn({ messages: req.body?.messages, userPrinciples: req.body?.userPrinciples }, emit);
    } catch (e) {
      emit('failure', { message: redactSecrets(e.message || 'The chat builder failed') });
    } finally {
      clearInterval(ping);
      emit('end', {});
      res.end();
    }
  });

  app.post('/api/research', researchLimit, async (req, res) => {
    try {
      res.json(await runResearch(req.body?.query, undefined, { generate: req.body?.generate !== false }));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/images/search', async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(await searchImages(req.query.q));
    } catch (e) {
      res.status(502).json({ error: e.message });
    }
  });

  app.post('/api/images/generate', rateLimiter({ windowMs: 60_000, max: 4 }), async (req, res) => {
    try {
      res.json(await generateImage(req.body?.prompt));
    } catch (e) {
      res.status(imageGenerationEnabled() ? 502 : 412).json({ error: e.message });
    }
  });

  app.use('/generated', express.static(path.join(config.dataDir, 'generated'), { maxAge: '30d', immutable: true }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built client (single-page app).
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  return app;
}

export async function startServer({ port = config.port, host = config.host, clientDist } = {}) {
  await loadSavedSettings();
  initPairingStore(config.dataDir);
  const app = createApp({ clientDist });
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.once('error', reject);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const server = await startServer();
  const { port } = server.address();
  console.log(`BIZSIM server running on http://localhost:${port}`);
  console.log(`  AI case synthesis: ${llmEnabled() ? `${config.llm.provider} (${llmModel()})` : 'off (add a key in Settings, or set GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY or AI_KEYS)'}`);
  console.log(`  Image generation:  ${imageGenerationEnabled() ? config.images.provider : 'off (Wikipedia images only)'}`);
  console.log(`  SEC EDGAR:         ${config.secUserAgent ? 'on' : 'off, set SEC_USER_AGENT="Your Name your@email.com"'}`);
}
